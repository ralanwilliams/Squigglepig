import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { roomsDb, type Db } from './helpers/db';

// supabase/rooms.sql, run in a real (in-process) Postgres: the server side of
// rooms, as the app calls it.
//
// Bug: someone trying an expired room was told it was full. A room idle past
// its 10 minutes is closed for everyone — joining it, coming back to it,
// starting a game in it, touching it or leaving it doesn't open it again —
// even before the once-a-minute sweep deletes it; and only players still in
// a room count towards its 12 places.

let db: Db;
before(async () => {
  db = await roomsDb();
});

// A room made by `host`, and `others` joined, each as their own guest.
async function room(host: string, others: string[] = []) {
  const ids: Record<string, string> = {};
  ids[host] = await db.guest();
  await db.as(ids[host]);
  const made = await db.rpc('create_room', [host]);
  assert.equal(made.status, 'ok');
  for (const name of others) {
    ids[name] = await db.guest();
    await db.as(ids[name]);
    assert.equal((await db.rpc('join_room', [made.room, name, false])).status, 'ok', name);
  }
  return { code: made.room as string, ids };
}

const idle = (code: string, minutes = 11) =>
  db.exec(`update public.rooms set last_active_at = now() - make_interval(mins => $2) where code = $1`, [code, minutes]);
const exists = async (code: string) => !!(await db.one('select 1 as x from public.rooms where code = $1', [code]));

describe('joining', () => {
  test('a room has up to 12 players; the 13th is told it is full', async () => {
    const names = Array.from({ length: 11 }, (_, i) => `P${i + 2}`);
    const { code } = await room('P1', names);
    const late = await db.guest();
    await db.as(late);
    assert.equal((await db.rpc('join_room', [code, 'P13', false])).status, 'room_full');
  });

  test('a place freed in the lobby can be taken', async () => {
    const names = Array.from({ length: 11 }, (_, i) => `Q${i + 2}`);
    const { code, ids } = await room('Q1', names);
    await db.as(ids.Q5);
    await db.rpc('leave_room', [code]);
    const late = await db.guest();
    await db.as(late);
    assert.equal((await db.rpc('join_room', [code, 'Q13', false])).status, 'ok');
  });

  test('a game in progress is closed to newcomers', async () => {
    const { code, ids } = await room('Ann', ['Bo', 'Cy']);
    await db.as(ids.Ann);
    assert.equal(await db.rpc('start_game', [code]), true);
    const late = await db.guest();
    await db.as(late);
    assert.equal((await db.rpc('join_room', [code, 'Di', false])).status, 'in_progress');
  });

  test('no such room', async () => {
    await db.as(await db.guest());
    assert.equal((await db.rpc('join_room', ['ZZZZ', 'Ann', false])).status, 'not_found');
  });
});

describe('an expired room (idle 10 minutes) is closed, for everyone', () => {
  test('joining it: there is no such room — not "full", even when it was', async () => {
    const names = Array.from({ length: 11 }, (_, i) => `R${i + 2}`);
    const { code } = await room('R1', names);
    await idle(code);
    await db.as(await db.guest());
    assert.equal((await db.rpc('join_room', [code, 'R13', false])).status, 'not_found');
    assert.equal(await exists(code), false, 'and it is gone');
  });

  test('coming back to it (the app reopening into it): it has closed', async () => {
    const { code, ids } = await room('Sam', ['Tia', 'Ugo']);
    await idle(code);
    await db.as(ids.Tia);
    assert.equal((await db.rpc('join_room', [code, 'Tia', true])).status, 'not_found');
  });

  test('its state: closed', async () => {
    const { code, ids } = await room('Vi', ['Wes', 'Xan']);
    await idle(code);
    await db.as(ids.Wes);
    assert.equal((await db.rpc('room_state', [code, false])).status, 'closed');
  });

  test('a touch does not bring it back', async () => {
    const { code, ids } = await room('Yan', ['Zed', 'Abe']);
    await idle(code);
    await db.as(ids.Zed);
    await db.rpc('touch_room', [code]);
    const row = await db.one<{ idle: boolean }>(`select public.room_is_idle(last_active_at) as idle from public.rooms where code = $1`, [code]);
    assert.equal(row?.idle, true);
  });

  test('starting a game in it: no', async () => {
    const { code, ids } = await room('Fin', ['Gil', 'Hap']);
    await idle(code);
    await db.as(ids.Fin);
    assert.equal(await db.rpc('start_game', [code]), false);
    const row = await db.one<{ phase: string; idle: boolean }>(
      `select phase, public.room_is_idle(last_active_at) as idle from public.rooms where code = $1`,
      [code]
    );
    assert.equal(row?.phase, 'lobby');
    assert.equal(row?.idle, true);
  });

  test('someone leaving does not bring it back', async () => {
    const { code, ids } = await room('Ivy', ['Jax', 'Kai']);
    await idle(code);
    await db.as(ids.Jax);
    await db.rpc('leave_room', [code]);
    const row = await db.one<{ idle: boolean }>(`select public.room_is_idle(last_active_at) as idle from public.rooms where code = $1`, [code]);
    assert.equal(row?.idle, true);
  });

  test('a room idle 9 minutes is still open, and a touch keeps it so', async () => {
    const { code, ids } = await room('Cal', ['Dee', 'Eli']);
    await idle(code, 9);
    await db.as(ids.Dee);
    assert.equal((await db.rpc('room_state', [code, false])).status, 'ok');
    await db.rpc('touch_room', [code]);
    const row = await db.one<{ idle: boolean }>(`select public.room_is_idle(last_active_at) as idle from public.rooms where code = $1`, [code]);
    assert.equal(row?.idle, false);
  });
});

describe('the sweep (close_idle_rooms)', () => {
  test('closes idle rooms, tells their phones, and leaves busy ones', async () => {
    const quiet = await room('Fay', ['Gus', 'Hal']);
    const busy = await room('Ike', ['Jo', 'Kim']);
    await idle(quiet.code);
    await db.exec('delete from realtime.sent');
    await db.as(null);
    await db.rpc('close_idle_rooms');
    assert.equal(await exists(quiet.code), false);
    assert.equal(await exists(busy.code), true);
    const told = await db.one<{ n: number }>(`select count(*)::int as n from realtime.sent where event = 'room-closed' and topic = $1`, [`room:${quiet.code}`]);
    assert.equal(told?.n, 1);
  });

  test("one room whose phones can't be told doesn't stop the others closing", async () => {
    const a = await room('Lu', ['Mo', 'Ned']);
    const b = await room('Oz', ['Pia', 'Quin']);
    await idle(a.code);
    await db.exec('update public.rooms set last_active_at = now() - interval \'12 minutes\' where code = $1', [b.code]);
    // Telling room a's phones fails.
    await db.exec(`
      create or replace function realtime.send(payload jsonb, event text, topic text, private boolean default true)
      returns void language plpgsql as $$
      begin
        if topic = 'room:${a.code}' then raise exception 'realtime is down'; end if;
        insert into realtime.sent (topic, event, payload) values (topic, event, payload);
      end $$;`);
    await db.as(null);
    await db.rpc('close_idle_rooms');
    assert.equal(await exists(a.code), false);
    assert.equal(await exists(b.code), false);
  });
});

describe('leaving and game end', () => {
  test('leaving in the lobby frees the name; the last one out closes the room', async () => {
    const { code, ids } = await room('Ray', ['Sue', 'Ty']);
    for (const n of ['Ray', 'Sue', 'Ty']) {
      await db.as(ids[n]);
      await db.rpc('leave_room', [code]);
    }
    assert.equal(await exists(code), false);
  });

  test('leaving mid-game keeps the score row until the game ends; then the room is open again', async () => {
    const { code, ids } = await room('Uma', ['Val', 'Wyn', 'Xia']);
    await db.as(ids.Uma);
    await db.rpc('start_game', [code]);
    await db.as(ids.Xia);
    await db.rpc('leave_room', [code]);
    await db.as(ids.Uma);
    let st = await db.rpc('room_state', [code, false]);
    assert.equal(st.members.find((m: { name: string }) => m.name === 'Xia')?.leftAt > 0, true);
    await db.rpc('end_game', [code]);
    st = await db.rpc('room_state', [code, false]);
    assert.equal(st.phase, 'lobby');
    assert.deepEqual(st.members.map((m: { name: string }) => m.name).sort(), ['Uma', 'Val', 'Wyn']);
    await db.as(await db.guest());
    assert.equal((await db.rpc('join_room', [code, 'Yul', false])).status, 'ok');
  });
});

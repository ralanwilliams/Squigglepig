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
    await db.as(quiet.ids.Gus);
    await db.rpc('set_push_token', ['ExponentPushToken[Gus]']);
    await idle(quiet.code);
    await db.exec('delete from realtime.sent');
    await db.exec('delete from net.posts');
    await db.as(null);
    await db.rpc('close_idle_rooms');
    assert.equal(await exists(quiet.code), false);
    assert.equal(await exists(busy.code), true);
    const told = await db.one<{ n: number }>(`select count(*)::int as n from realtime.sent where event = 'room-closed' and topic = $1`, [`room:${quiet.code}`]);
    assert.equal(told?.n, 1);
    // And by notification, replacing the room's last one ("come back", say).
    const post = await db.one<{ body: any }>('select body from net.posts');
    assert.equal(post?.body[0].body, 'The room closed after 10 minutes with nobody doing anything in it.');
    assert.equal(post?.body[0].tag, `room-${quiet.code}`);
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

// Players away from a game are kept up with it: told it has started, every
// turn, when their chain is up for judging, when it's over and when someone
// leaves. Each notification replaces the last on the phone (one per room).
describe('notifications', () => {
  // A game under way in a room of `names`, every phone with a push token, the
  // notifications sent so far forgotten.
  async function game(names: string[]) {
    const r = await room(names[0], names.slice(1));
    for (const n of names) {
      await db.as(r.ids[n]);
      await db.rpc('set_push_token', [`ExponentPushToken[${n}]`]);
    }
    await db.as(r.ids[names[0]]);
    assert.equal(await db.rpc('start_game', [r.code]), true);
    await db.exec('delete from net.posts');
    return r;
  }
  const sent = async () =>
    ((await db.pg.query<{ body: any }>('select body from net.posts order by id')).rows ?? []).flatMap((r) => r.body);

  test("each carries the room as its tag and collapse id, so it replaces the room's last one", async () => {
    const { code, ids } = await game(['Ama', 'Ben', 'Cat']);
    await db.rpc('nudge', [code, 'draw', [ids.Ben]]);
    const [msg] = await sent();
    assert.equal(msg.to, 'ExponentPushToken[Ben]');
    assert.equal(msg.body, "It's your turn to draw!");
    assert.equal(msg.tag, `room-${code}`);
    assert.equal(msg.collapseId, `room-${code}`);
  });

  test('every turn, not once per absence, but never more than one every 5 seconds', async () => {
    const { code, ids } = await game(['Dot', 'Eve', 'Fox']);
    await db.rpc('nudge', [code, 'draw', [ids.Eve]]);
    await db.rpc('nudge', [code, 'guess', [ids.Eve]]); // a moment later: thinned out
    assert.equal((await sent()).length, 1);
    await db.exec(`update public.room_members set nudged_at = now() - interval '6 seconds' where user_id = $1`, [ids.Eve]);
    await db.rpc('nudge', [code, 'guess', [ids.Eve]]);
    assert.deepEqual((await sent()).map((m) => m.body), ["It's your turn to draw!", "It's your turn to guess!"]);
  });

  test('a chain up for judging, and the game over', async () => {
    const { code, ids } = await game(['Gus', 'Hal', 'Ida']);
    await db.rpc('nudge', [code, 'judge', [ids.Hal]]);
    await db.rpc('nudge', [code, 'over', [ids.Ida]]);
    assert.deepEqual((await sent()).map((m) => m.body), [
      'Your chain is up! Come back and judge it.',
      'The game is over! Come back to see who won.',
    ]);
  });

  test('nobody is told by their own phone, or once they have left', async () => {
    const { code, ids } = await game(['Jan', 'Kit', 'Lou', 'Max']);
    await db.as(ids.Max);
    await db.rpc('leave_room', [code]);
    await db.exec('delete from net.posts');
    await db.as(ids.Jan);
    await db.rpc('nudge', [code, 'draw', [ids.Jan, ids.Max]]);
    assert.equal((await sent()).length, 0);
  });

  test('someone leaving during a game tells the others how many are still playing', async () => {
    const { code, ids } = await game(['Ned', 'Oli', 'Pat', 'Quy']);
    await db.as(ids.Quy);
    await db.rpc('leave_room', [code]);
    const msgs = await sent();
    assert.deepEqual(msgs.map((m) => m.to).sort(), ['ExponentPushToken[Ned]', 'ExponentPushToken[Oli]', 'ExponentPushToken[Pat]']);
    assert.ok(msgs.every((m) => m.body === 'Quy left the game - 3 players still playing.' && m.tag === `room-${code}`));
  });

  // Bug: with every player away (the app closed on every phone), no phone was
  // keeping the game's clock, so nothing told anyone anything until someone
  // came back. Now the server notices, and tells them all the game is paused.
  describe('everyone away', () => {
    const awayFor = (code: string, seconds: number) =>
      db.exec(`update public.room_members set away_at = now() - make_interval(secs => $2) where room = $1 and away_at is not null`, [
        code,
        seconds,
      ]);
    const allAway = async (code: string, ids: Record<string, string>) => {
      for (const id of Object.values(ids)) {
        await db.as(id);
        await db.rpc('step_away', [code]);
      }
      await db.as(null);
    };

    test('after 15 seconds, everyone is told the game is paused, and what waits for them, once', async () => {
      const { code, ids } = await game(['Rae', 'Sol', 'Tam']);
      await db.rpc('save_snapshot', [code, { phase: 'draw', stage: 1 }]);
      await allAway(code, ids);
      await db.rpc('tell_paused_rooms');
      assert.equal((await sent()).length, 0, 'not straight away: someone may be switching apps');
      await awayFor(code, 20);
      await db.rpc('tell_paused_rooms');
      const msgs = await sent();
      assert.equal(msgs.length, 3);
      assert.ok(msgs.every((m) => m.body === "Everyone's away, so the game is paused. Come back to draw!" && m.tag === `room-${code}`));
      await db.rpc('tell_paused_rooms');
      assert.equal((await sent()).length, 3, 'once');
    });

    test('told again the next time they are all away, not while anyone is back', async () => {
      const { code, ids } = await game(['Uli', 'Vic', 'Wim']);
      await allAway(code, ids);
      await awayFor(code, 20);
      await db.rpc('tell_paused_rooms');
      assert.equal((await sent()).length, 3);
      // A couple of minutes on…
      await db.exec(`update public.rooms set paused_told_at = now() - interval '2 minutes' where code = $1`, [code]);
      await db.as(ids.Vic);
      await db.rpc('touch_room', [code]); // Vic is back
      await awayFor(code, 60);
      await db.as(null);
      await db.rpc('tell_paused_rooms');
      assert.equal((await sent()).length, 3, 'Vic is here');
      await db.as(ids.Vic);
      await db.rpc('step_away', [code]);
      await awayFor(code, 20);
      await db.as(null);
      await db.rpc('tell_paused_rooms');
      assert.equal((await sent()).length, 6);
    });

    test('never in the lobby, or with a player who has never said they are away (2.9.0)', async () => {
      const lobby = await room('Xyz', ['Yul', 'Zoe']);
      await allAway(lobby.code, lobby.ids);
      await awayFor(lobby.code, 20);
      const { code, ids } = await game(['Ada', 'Bea', 'Cid']);
      for (const n of ['Ada', 'Bea']) {
        await db.as(ids[n]);
        await db.rpc('step_away', [code]);
      }
      await awayFor(code, 20);
      await db.as(null);
      await db.rpc('tell_paused_rooms');
      assert.equal((await sent()).length, 0);
    });

    test('coming back (or reopening the app into the room) says so', async () => {
      const { code, ids } = await game(['Dex', 'Eli', 'Fen']);
      await db.as(ids.Eli);
      await db.rpc('step_away', [code]);
      assert.ok((await db.one(`select away_at from public.room_members where user_id = $1`, [ids.Eli])).away_at);
      await db.rpc('join_room', [code, 'Eli', true]);
      assert.equal((await db.one(`select away_at from public.room_members where user_id = $1`, [ids.Eli])).away_at, null);
    });
  });
});

// A game needs 3 players: one that drops under 3 when someone taps Leave game
// can't go on, at whatever point it's reached. Before, the trough's timer ran
// down to the final scores (every one 0); a later round played on with blank
// turns. Now it ends for everyone at once, and the room closes, saying why.
describe('too few players left to play on', () => {
  test('the room closes, everyone still in it is told why, and a phone coming back is told too', async () => {
    const { code, ids } = await room('Gia', ['Hux', 'Ivo']);
    for (const n of ['Gia', 'Hux', 'Ivo']) {
      await db.as(ids[n]);
      await db.rpc('set_push_token', [`ExponentPushToken[${n}]`]);
    }
    await db.as(ids.Gia);
    await db.rpc('start_game', [code]);
    await db.exec('delete from net.posts');
    await db.exec('delete from realtime.sent');
    await db.as(ids.Ivo);
    await db.rpc('leave_room', [code]);
    assert.equal(await exists(code), false, 'closed');
    const told = await db.one<{ payload: { reason: string } }>(
      `select payload from realtime.sent where event = 'room-closed' and topic = $1`,
      [`room:${code}`]
    );
    assert.equal(told?.payload.reason, 'players');
    const msgs = ((await db.pg.query<{ body: any }>('select body from net.posts')).rows ?? []).flatMap((r) => r.body);
    assert.deepEqual(msgs.map((m) => m.to).sort(), ['ExponentPushToken[Gia]', 'ExponentPushToken[Hux]']);
    assert.ok(msgs.every((m) => m.body.startsWith("There aren't enough players left to keep playing.")));
    await db.as(ids.Hux);
    assert.deepEqual(await db.rpc('room_state', [code, false]), { status: 'closed', reason: 'players' });
    assert.equal((await db.rpc('join_room', [code, 'Hux', true])).status, 'not_found');
  });

  test('3 or more carrying on play on, and in the lobby anyone can go', async () => {
    const four = await room('Jon', ['Kai', 'Lea', 'Mia']);
    await db.as(four.ids.Jon);
    await db.rpc('start_game', [four.code]);
    await db.as(four.ids.Mia);
    await db.rpc('leave_room', [four.code]);
    assert.equal(await exists(four.code), true);
    const lobby = await room('Nat', ['Oz2', 'Pip']);
    await db.as(lobby.ids.Pip);
    await db.rpc('leave_room', [lobby.code]);
    await db.as(lobby.ids.Oz2);
    await db.rpc('leave_room', [lobby.code]);
    assert.equal(await exists(lobby.code), true, 'Nat is still waiting for players');
  });

  test('why it closed is forgotten after 15 minutes', async () => {
    await db.exec(`insert into public.closed_rooms (code, reason, closed_at) values ('QQQQ', 'players', now() - interval '16 minutes')`);
    await db.as(null);
    await db.rpc('close_idle_rooms');
    assert.equal(await db.one(`select 1 as x from public.closed_rooms where code = 'QQQQ'`), undefined);
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

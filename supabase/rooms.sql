-- Rooms that outlast a closed app.
--
-- A player is IN a room from the moment they create or join it until they tap
-- Leave game, or the room closes after IDLE (10 minutes) without anyone doing
-- anything in it. Closing the app, locking the phone or losing signal only
-- makes them "away": the live channel (Realtime Presence) says who has the app
-- open right now, these tables say who is in the room at all.
--
-- Every player is a Supabase user: the app signs in anonymously on first
-- launch (no sign-up screen), so each phone has a stable id that membership
-- and push tokens hang off. Turn this on first: Authentication → Sign In /
-- Providers → "Allow anonymous sign-ins".
--
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Safe to run again. It also turns on two extensions: pg_cron (closes idle
-- rooms every minute) and pg_net (sends push notifications through Expo).
--
-- The app never reads or writes these tables directly. Everything goes
-- through the functions below, which check who is asking (auth.uid()).

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ---- Tables ----------------------------------------------------------------

-- One row per open room. `phase` is all the server needs to know about the
-- game: 'lobby' (joinable) or 'playing' (closed to newcomers). The game itself
-- runs on the players' phones; the one keeping its clock saves a `snapshot`
-- of it at every step, so if everyone closes the app the first one back picks
-- it up. The snapshot (prompts, drawings, guesses, scores) is deleted when the
-- game ends or the room closes. `paused_told_at` is when everyone in its game
-- was last told they're all away and it's paused (tell_paused_rooms).
create table if not exists public.rooms (
  code text primary key check (code ~ '^[A-Z0-9]{4}$'),
  phase text not null default 'lobby' check (phase in ('lobby', 'playing')),
  created_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  snapshot jsonb,
  paused_told_at timestamptz
);
alter table public.rooms add column if not exists paused_told_at timestamptz;

-- Who is in each room. `left_at` is set when someone taps Leave game during a
-- game: they stay listed (their score still shows) until the game ends. In the
-- lobby, leaving deletes the row. `nudged_at` is when an away player was last
-- sent a notification about the game (nudge), so a burst of them is thinned
-- out. (`nudged` is what 2.9.0's copy of these functions kept instead, once
-- per absence; nothing reads it now, and it stays so that copy still runs.)
-- `away_at` is when the player's app last went off screen (step_away), until
-- they're back (touch_room): when everyone in a game is away, they're all told
-- it's paused. (2.9.0 never says, so it never counts as away.)
create table if not exists public.room_members (
  room text not null references public.rooms (code) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 24),
  joined_at timestamptz not null default clock_timestamp(),
  left_at timestamptz,
  nudged boolean not null default false,
  nudged_at timestamptz,
  away_at timestamptz,
  primary key (room, user_id)
);
alter table public.room_members add column if not exists nudged_at timestamptz;
alter table public.room_members add column if not exists away_at timestamptz;
create unique index if not exists room_members_name on public.room_members (room, lower(name));
create index if not exists room_members_user on public.room_members (user_id);

-- A room that closed because too few players were left in its game to play on
-- (close_room 'players'), for 15 minutes: a phone coming back to it is told
-- why (room_state), not that it went idle. Just the code and the reason.
create table if not exists public.closed_rooms (
  code text primary key,
  reason text not null,
  closed_at timestamptz not null default now()
);

-- The phone's Expo push token, while notifications are on. One per player
-- (one phone per anonymous user). Refreshed every time the app opens; tokens
-- nobody has refreshed in 90 days are deleted (tidy_guests below).
create table if not exists public.push_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  token text not null check (token ~ '^Expo(nent)?PushToken\[.+\]$'),
  updated_at timestamptz not null default now()
);

alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.push_tokens enable row level security;
alter table public.closed_rooms enable row level security;
revoke all on public.rooms, public.room_members, public.push_tokens, public.closed_rooms from anon, authenticated;

-- ---- Helpers (not callable from the app) -----------------------------------

-- Whether the caller is in the room a Realtime topic ('room:ABCD') belongs to.
-- The channel policies below use it, so only members can listen or send.
create or replace function public.is_room_member(topic text)
returns boolean language sql stable security definer set search_path = '' as $$
  select topic like 'room:%' and exists (
    select 1 from public.room_members m
    where m.room = substr(topic, 6) and m.user_id = auth.uid() and m.left_at is null
  );
$$;

-- A name with what can't be seen taken out, as the app does before sending
-- it (src/lib/text.ts, cleanText): every kind of space becomes a plain one;
-- control characters, zero-width and direction marks and blank filler letters
-- go; emoji glue (joiners, variation selectors, tag letters) stays only
-- inside emoji and the scripts that need it. Without this, "Sam" and "Sam"
-- with an invisible mark in it would be two names that look the same.
create or replace function public.clean_name(p text)
returns text language plpgsql immutable set search_path = '' as $$
declare
  s text := normalize(coalesce(p, ''), NFC);
  was text;
begin
  s := regexp_replace(s, '[\u0009-\u000D\u0085\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]', ' ', 'g');
  s := regexp_replace(s, '[\u0001-\u0008\u000E-\u001F\u007F-\u0084\u0086-\u009F\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180B-\u180F\u200B\u200E\u200F\u202A-\u202E\u2060-\u206F\u2800\u3164\uFEFF\uFFA0\uFFF0-\uFFFB\U0001D173-\U0001D17A\U000E0001]', '', 'g');
  -- Then the glue and joiners, over and over until nothing more goes: taking
  -- one away can leave another next to plain ASCII ("Sam" + joiner + selector
  -- loses the joiner, and then the selector sits after the m).
  loop
    was := s;
    -- Variation selectors and tag letters only after a letter that isn't ASCII.
    s := regexp_replace(s, '^[\uFE00-\uFE0F\U000E0020-\U000E007F]+', '');
    s := regexp_replace(s, '(?<=[\u0001-\u007F])[\uFE00-\uFE0F\U000E0020-\U000E007F]+', '', 'g');
    -- Joiners only one at a time, between two letters that aren't ASCII.
    s := regexp_replace(s, '[\u200C\u200D]+([\u200C\u200D])', '\1', 'g');
    s := regexp_replace(s, '^[\u200C\u200D]+|[\u200C\u200D]+$', '', 'g');
    s := regexp_replace(s, '(?<=[\u0001-\u007F])[\u200C\u200D]+', '', 'g');
    s := regexp_replace(s, '[\u200C\u200D]+(?=[\u0001-\u007F])', '', 'g');
    exit when s = was;
  end loop;
  return btrim(regexp_replace(s, ' {2,}', ' ', 'g'));
end $$;

-- Send one notification to each of `users` who has a push token, through
-- Expo's push service (which hands it to Apple or Google). pg_net sends it
-- after the transaction commits, so a rolled-back change never notifies.
-- A room's notifications all carry the room as their tag (Android) and
-- collapse id (iOS), so each new one replaces the last on the phone instead
-- of piling up: one notification per room, always the latest news.
create or replace function public.push(p_users uuid[], p_title text, p_body text, p_data jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  msgs jsonb;
begin
  select jsonb_agg(jsonb_build_object(
    'to', t.token, 'title', p_title, 'body', p_body, 'data', p_data,
    'sound', 'default', 'priority', 'high', 'channelId', 'rooms')
    || case when p_data ? 'room'
         then jsonb_build_object('tag', 'room-' || (p_data ->> 'room'), 'collapseId', 'room-' || (p_data ->> 'room'))
         else '{}'::jsonb end)
  into msgs
  from public.push_tokens t
  where t.user_id = any(p_users);
  if msgs is null then return; end if;
  perform net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    body := msgs,
    headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
  );
end $$;

-- Whether a room has gone 10 minutes without anyone doing anything in it.
-- Such a room is closed: close_idle_rooms deletes it on its next run (within
-- a minute), and until then nobody can join it, come back to it, start a
-- game in it or keep it open (join_room, room_state, start_game, touch_room,
-- leave_room_as), so it's never half there.
create or replace function public.room_is_idle(p_last_active timestamptz)
returns boolean language sql stable set search_path = '' as $$
  select p_last_active < now() - interval '10 minutes';
$$;

-- Close a room: tell the phones still connected, and the players' phones by
-- notification (replacing whatever the room last told them), then delete it
-- (its members and snapshot go too). Why: 'idle' (10 minutes with nobody
-- doing anything in it), or 'players' (too few left in its game to play on:
-- leave_room_as), which closed_rooms keeps a while so a phone coming back
-- can say so. Telling them is best effort: if the message can't go, the room
-- still closes (and the app notices next time it asks).
drop function if exists public.close_room(text);
create or replace function public.close_room(p_code text, p_reason text default 'idle')
returns void language plpgsql security definer set search_path = '' as $$
begin
  begin
    perform realtime.send(jsonb_build_object('reason', p_reason), 'room-closed', 'room:' || p_code, true);
  exception when others then
    raise warning 'room-closed for % not sent: %', p_code, sqlerrm;
  end;
  perform public.push(
    array(select user_id from public.room_members where room = p_code and left_at is null),
    'Room ' || p_code,
    case p_reason
      when 'players' then 'There aren''t enough players left to keep playing. Create a new game to play again.'
      else 'The room closed after 10 minutes with nobody doing anything in it.'
    end,
    jsonb_build_object('room', p_code, 'kind', 'closed')
  );
  if p_reason = 'players' then
    insert into public.closed_rooms (code, reason) values (p_code, p_reason)
    on conflict (code) do update set reason = excluded.reason, closed_at = now();
  end if;
  delete from public.rooms where code = p_code;
end $$;

-- Take `who` out of a room: in the lobby they're gone; mid-game they're marked
-- as left (still on the scoreboard), and if that leaves fewer than 3 in the
-- game it can't go on: it ends for everyone, and the room closes, telling
-- them why (close_room 'players'). The last one out closes the room; anyone
-- else leaving counts as something done in it, unless it has already closed
-- for being idle.
create or replace function public.leave_room_as(p_code text, p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  r public.rooms;
  v_left int;
begin
  select * into r from public.rooms where code = p_code for update;
  if not found then return; end if;
  if r.phase = 'lobby' then
    delete from public.room_members where room = p_code and user_id = p_user;
  else
    update public.room_members set left_at = now()
    where room = p_code and user_id = p_user and left_at is null;
    if found then
      select count(*) into v_left from public.room_members where room = p_code and left_at is null;
      if v_left between 1 and 2 then -- under 3: MIN_PLAYERS in src/state/rules.ts
        perform public.close_room(p_code, 'players');
        return;
      end if;
    end if;
  end if;
  if not exists (select 1 from public.room_members where room = p_code and left_at is null) then
    delete from public.rooms where code = p_code;
  else
    update public.rooms set last_active_at = now() where code = p_code and not public.room_is_idle(last_active_at);
  end if;
end $$;

-- ---- What the app calls ----------------------------------------------------

-- Make a room with a fresh code and put the caller in it. Leaves any other
-- room first: a player is in one room at a time.
create or replace function public.create_room(p_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- also src/lib/text.ts
  v_name text := public.clean_name(p_name);
  v_code text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if char_length(v_name) not between 1 and 24 then return jsonb_build_object('status', 'bad_name'); end if;
  perform public.leave_room_as(m.room, auth.uid())
  from public.room_members m where m.user_id = auth.uid() and m.left_at is null;
  loop
    v_code := '';
    for i in 1..4 loop
      v_code := v_code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;
    begin
      insert into public.rooms (code) values (v_code);
      exit;
    exception when unique_violation then
      -- That code is in use: roll another.
    end;
  end loop;
  delete from public.closed_rooms where code = v_code; -- a room of the same name before
  insert into public.room_members (room, user_id, name) values (v_code, auth.uid(), v_name);
  return jsonb_build_object('status', 'ok', 'room', v_code, 'name', v_name);
end $$;

-- Join a room by its code, or come back to one you're already in (from the
-- background, or a reopened app). A room that has been idle 10 minutes is
-- closed, for everyone ('not_found'): it goes now, if the sweep hasn't got
-- to it yet. Newcomers can only join in the lobby, and only while fewer than
-- 12 players are in it ('room_full'; MAX_PLAYERS in src/state/rules.ts says
-- the same). The room row is locked first, so two people joining at once
-- can't both take the last place.
-- A returning member keeps the name they joined with: the game's scores are
-- kept by name. With p_rejoin (the app reopening into its saved room) it only
-- comes back: if the caller isn't in that room any more it's 'not_found',
-- never a join of a new room that happens to have the same code.
drop function if exists public.join_room(text, text);
create or replace function public.join_room(p_code text, p_name text, p_rejoin boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  -- Codes are capitals, whatever case they're typed in.
  v_code text := upper(btrim(p_code));
  v_name text := public.clean_name(p_name);
  max_players constant int := 12;
  r public.rooms;
  m public.room_members;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if v_code !~ '^[A-Z0-9]{4}$' then return jsonb_build_object('status', 'not_found'); end if;
  select * into r from public.rooms where code = v_code for update;
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  if public.room_is_idle(r.last_active_at) then
    perform public.close_room(v_code);
    return jsonb_build_object('status', 'not_found');
  end if;
  select * into m from public.room_members where room = v_code and user_id = auth.uid();
  if found and m.left_at is null then
    update public.room_members set away_at = null where room = v_code and user_id = auth.uid() and away_at is not null;
    update public.rooms set last_active_at = now() where code = v_code;
    return jsonb_build_object('status', 'ok', 'room', v_code, 'name', m.name);
  end if;
  if p_rejoin then return jsonb_build_object('status', 'not_found'); end if;
  if found or r.phase <> 'lobby' then return jsonb_build_object('status', 'in_progress'); end if;
  if (select count(*) from public.room_members where room = v_code and left_at is null) >= max_players then
    return jsonb_build_object('status', 'room_full');
  end if;
  if char_length(v_name) not between 1 and 24 then return jsonb_build_object('status', 'bad_name'); end if;
  if exists (select 1 from public.room_members where room = v_code and lower(name) = lower(v_name)) then
    return jsonb_build_object('status', 'name_taken');
  end if;
  begin
    insert into public.room_members (room, user_id, name) values (v_code, auth.uid(), v_name);
  exception when unique_violation then
    return jsonb_build_object('status', 'name_taken'); -- someone took it a moment ago
  end;
  -- In: now out of any other room (only now, so a failed join leaves the
  -- player where they were).
  perform public.leave_room_as(o.room, auth.uid())
  from public.room_members o where o.user_id = auth.uid() and o.room <> v_code and o.left_at is null;
  update public.rooms set last_active_at = now() where code = v_code;
  return jsonb_build_object('status', 'ok', 'room', v_code, 'name', v_name);
end $$;

-- Leave game.
create or replace function public.leave_room(p_code text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.leave_room_as(upper(btrim(p_code)), auth.uid());
end $$;

-- The room as the caller's app needs it: its phase, everyone in it (oldest
-- first) and, when asked, the last snapshot of the game. 'closed' if the room
-- is gone (or idle long enough to be on its way) or the caller isn't in it
-- any more, with the reason if it closed because too few players were left
-- to play on (closed_rooms).
create or replace function public.room_state(p_code text, p_snapshot boolean default false)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_code text := upper(btrim(p_code));
  r public.rooms;
begin
  select * into r from public.rooms where code = v_code;
  if not found or public.room_is_idle(r.last_active_at) or not public.is_room_member('room:' || v_code) then
    return jsonb_build_object('status', 'closed') || coalesce(
      (select jsonb_build_object('reason', c.reason) from public.closed_rooms c where c.code = v_code),
      '{}'::jsonb
    );
  end if;
  return jsonb_build_object(
    'status', 'ok',
    'phase', r.phase,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.user_id,
        'name', m.name,
        'joinedAt', (extract(epoch from m.joined_at) * 1000)::bigint,
        'leftAt', (extract(epoch from m.left_at) * 1000)::bigint
      ) order by m.joined_at, m.name)
      from public.room_members m where m.room = v_code
    ), '[]'::jsonb),
    'snapshot', case when p_snapshot then r.snapshot end
  );
end $$;

-- Someone did something in the room (or opened the app into it): it isn't
-- idle, and they're not away (step_away). A room already idle 10 minutes is
-- closed, and stays closed.
create or replace function public.touch_room(p_code text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_code text := upper(btrim(p_code));
begin
  if not public.is_room_member('room:' || v_code) then return; end if;
  update public.room_members set away_at = null where room = v_code and user_id = auth.uid() and away_at is not null;
  update public.rooms set last_active_at = now() where code = v_code and not public.room_is_idle(last_active_at);
end $$;

-- The caller's app went off screen (another app, a locked phone): they're
-- away until they're back (touch_room). Not activity. When everyone in a game
-- is, they're all told it's paused (tell_paused_rooms).
create or replace function public.step_away(p_code text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.room_members set away_at = now()
  where room = upper(btrim(p_code)) and user_id = auth.uid() and left_at is null;
end $$;

-- Start a game: the room closes to newcomers. Needs 3 players in the room
-- (away ones count), and a room that hasn't closed for being idle.
create or replace function public.start_game(p_code text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_code text := upper(btrim(p_code));
begin
  if not public.is_room_member('room:' || v_code) then return false; end if;
  if (select count(*) from public.room_members where room = v_code and left_at is null) < 3 then
    return false;
  end if;
  update public.rooms set phase = 'playing', snapshot = null, last_active_at = now()
  where code = v_code and not public.room_is_idle(last_active_at);
  return found;
end $$;

-- The game is over: back to the lobby, open to newcomers again. Players who
-- left during it go now (before the phase changes, so nobody is told they
-- "exited"), and the snapshot with everyone's drawings is deleted.
create or replace function public.end_game(p_code text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_code text := upper(btrim(p_code));
begin
  if not public.is_room_member('room:' || v_code) then return; end if;
  delete from public.room_members where room = v_code and left_at is not null;
  update public.rooms set phase = 'lobby', snapshot = null where code = v_code;
end $$;

-- The copy of the game so far, from the phone keeping its clock. Not
-- activity: the clock moving the game on by itself doesn't keep a room open.
create or replace function public.save_snapshot(p_code text, p_state jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_code text := upper(btrim(p_code));
begin
  if not public.is_room_member('room:' || v_code) then return; end if;
  if octet_length(p_state::text) > 4000000 then return; end if;
  update public.rooms set snapshot = p_state where code = v_code and phase = 'playing';
end $$;

-- Tell away players how the game is going: it has started, it's their turn,
-- their chain is up for judging, or it's over. Whoever moves the game on
-- names who is away (it can see who has the app open). Every one replaces the
-- last on the phone (push), so they're told each time; a player can't be
-- sent more than one every 5 seconds, so no phone in the room can flood
-- another with them.
create or replace function public.nudge(p_code text, p_kind text, p_users uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_code text := upper(btrim(p_code));
  v_body text;
  v_to uuid[];
begin
  v_body := case p_kind
    when 'start' then 'The game has started! Come back to add your prompts.'
    when 'draw' then 'It''s your turn to draw!'
    when 'guess' then 'It''s your turn to guess!'
    when 'judge' then 'Your chain is up! Come back and judge it.'
    when 'over' then 'The game is over! Come back to see who won.'
  end;
  if v_body is null or not public.is_room_member('room:' || v_code) then return; end if;
  with picked as (
    update public.room_members set nudged_at = now()
    where room = v_code and user_id = any(p_users) and user_id <> auth.uid()
      and left_at is null
      and (nudged_at is null or nudged_at < now() - interval '5 seconds')
    returning user_id
  )
  select array_agg(user_id) into v_to from picked;
  if v_to is null then return; end if;
  perform public.push(v_to, 'Room ' || v_code, v_body, jsonb_build_object('room', v_code, 'kind', p_kind));
end $$;

-- This phone's push token, or null to stop notifications.
create or replace function public.set_push_token(p_token text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return; end if;
  if p_token is null or p_token = '' then
    delete from public.push_tokens where user_id = auth.uid();
  else
    insert into public.push_tokens (user_id, token) values (auth.uid(), p_token)
    on conflict (user_id) do update set token = excluded.token, updated_at = now();
  end if;
end $$;

-- ---- Comings and goings ----------------------------------------------------

-- Whenever the room's list changes, every phone in it is told to fetch the
-- list again. In the lobby, everyone else also gets a notification (the app
-- hides it if it's open on the screen): "Sam has entered - 4 players in the
-- room." So do the others when someone taps Leave game during a game and at
-- least 3 carry on: "Sam left the game - 3 players still playing." (With
-- fewer, the room closes, and that's what they're told: leave_room_as.) A
-- room being closed takes its members with it; nobody is told about those.
create or replace function public.room_members_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_code text := coalesce(new.room, old.room);
  v_phase text;
  v_who text;
  v_verb text;
  v_count int;
begin
  select phase into v_phase from public.rooms where code = v_code;
  if not found then return null; end if;
  perform realtime.send('{}'::jsonb, 'members', 'room:' || v_code, true);
  if tg_op = 'UPDATE' then
    if v_phase = 'playing' and old.left_at is null and new.left_at is not null then
      select count(*) into v_count from public.room_members where room = v_code and left_at is null;
      if v_count < 3 then return null; end if;
      perform public.push(
        array(select user_id from public.room_members where room = v_code and left_at is null),
        'Room ' || v_code,
        format('%s left the game - %s %s still playing.', new.name, v_count, case when v_count = 1 then 'player' else 'players' end),
        jsonb_build_object('room', v_code, 'kind', 'left')
      );
    end if;
    return null;
  end if;
  if v_phase <> 'lobby' then return null; end if;
  if tg_op = 'INSERT' then
    v_who := new.name;
    v_verb := 'entered';
  else
    v_who := old.name;
    v_verb := 'exited';
  end if;
  select count(*) into v_count from public.room_members where room = v_code and left_at is null;
  perform public.push(
    array(select user_id from public.room_members
          where room = v_code and left_at is null and user_id <> coalesce(new.user_id, old.user_id)),
    'Room ' || v_code,
    format('%s has %s - %s %s in the room.', v_who, v_verb, v_count, case when v_count = 1 then 'player' else 'players' end),
    jsonb_build_object('room', v_code, 'kind', 'members')
  );
  return null;
end $$;

drop trigger if exists room_members_changed on public.room_members;
create trigger room_members_changed
  after insert or delete or update of left_at, name on public.room_members
  for each row execute function public.room_members_changed();

-- ---- Housekeeping ----------------------------------------------------------

-- Close every room nobody has done anything in for 10 minutes (close_room:
-- tell the phones still connected, then delete it). One that can't be told
-- doesn't hold up the rest. Rooms closed for too few players are forgotten
-- after 15 minutes.
create or replace function public.close_idle_rooms()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_code text;
begin
  for v_code in select code from public.rooms where public.room_is_idle(last_active_at) loop
    perform public.close_room(v_code);
  end loop;
  delete from public.closed_rooms where closed_at < now() - interval '15 minutes';
end $$;

-- A game whose players have all been away for 15 seconds (step_away) is
-- paused: no phone is keeping its clock (it picks up where it was when
-- someone's back). Each of them is told what's waiting for them, from the
-- game's snapshot, once each time it happens. The 15 seconds let a player
-- going from one app to another, or switching phones, pass without a word. (A
-- player on 2.9.0 never says they're away, so a game with one in it isn't
-- told.)
create or replace function public.tell_paused_rooms()
returns void language plpgsql security definer set search_path = '' as $$
declare
  g record;
begin
  for g in
    select r.code, r.snapshot ->> 'phase' as phase
    from public.rooms r
    join public.room_members m on m.room = r.code and m.left_at is null
    where r.phase = 'playing' and not public.room_is_idle(r.last_active_at)
    group by r.code
    having count(*) filter (where m.away_at is null) = 0
      and max(m.away_at) < now() - interval '15 seconds'
      and (r.paused_told_at is null or r.paused_told_at < max(m.away_at))
  loop
    update public.rooms set paused_told_at = now() where code = g.code;
    perform public.push(
      array(select user_id from public.room_members where room = g.code and left_at is null),
      'Room ' || g.code,
      'Everyone''s away, so the game is paused. ' || case g.phase
        when 'prompts' then 'Come back to fill the trough!'
        when 'view' then 'Come back to see your prompt!'
        when 'draw' then 'Come back to draw!'
        when 'caption' then 'Come back to guess!'
        when 'reveal' then 'Come back for the reveal!'
        else 'Come back to play!'
      end,
      jsonb_build_object('room', g.code, 'kind', 'paused')
    );
  end loop;
end $$;

-- Old push tokens, and guest ids that haven't opened the app in 180 days and
-- have nothing attached. (A guest who comes back after that simply gets a new
-- id; there's nothing else tied to it.)
create or replace function public.tidy_guests()
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.push_tokens where updated_at < now() - interval '90 days';
  delete from auth.users u
  where u.is_anonymous
    and u.created_at < now() - interval '180 days'
    and not exists (select 1 from auth.sessions s where s.user_id = u.id and s.updated_at > now() - interval '180 days')
    and not exists (select 1 from public.push_tokens t where t.user_id = u.id)
    and not exists (select 1 from public.room_members m where m.user_id = u.id);
end $$;

select cron.schedule('squigglepig-close-idle-rooms', '* * * * *', 'select public.close_idle_rooms()');
select cron.schedule('squigglepig-tidy-guests', '17 4 * * *', 'select public.tidy_guests()');
-- Every 10 seconds where pg_cron can (1.5 on), every minute where it can't.
do $$
begin
  perform cron.schedule('squigglepig-tell-paused-rooms', '10 seconds', 'select public.tell_paused_rooms()');
exception when others then
  perform cron.schedule('squigglepig-tell-paused-rooms', '* * * * *', 'select public.tell_paused_rooms()');
end $$;

-- ---- Who may call what -----------------------------------------------------

revoke execute on function
  public.clean_name(text),
  public.is_room_member(text),
  public.push(uuid[], text, text, jsonb),
  public.room_is_idle(timestamptz),
  public.close_room(text, text),
  public.leave_room_as(text, uuid),
  public.create_room(text),
  public.join_room(text, text, boolean),
  public.leave_room(text),
  public.room_state(text, boolean),
  public.touch_room(text),
  public.step_away(text),
  public.start_game(text),
  public.end_game(text),
  public.save_snapshot(text, jsonb),
  public.nudge(text, text, uuid[]),
  public.set_push_token(text),
  public.room_members_changed(),
  public.close_idle_rooms(),
  public.tell_paused_rooms(),
  public.tidy_guests()
from public, anon, authenticated;

-- Signed-in players (anonymous ones included) only.
grant execute on function
  public.is_room_member(text),
  public.create_room(text),
  public.join_room(text, text, boolean),
  public.leave_room(text),
  public.room_state(text, boolean),
  public.touch_room(text),
  public.step_away(text),
  public.start_game(text),
  public.end_game(text),
  public.save_snapshot(text, jsonb),
  public.nudge(text, text, uuid[]),
  public.set_push_token(text)
to authenticated;

-- ---- The live channel ------------------------------------------------------

-- Each room's channel ('room:ABCD') is private: only its members can listen
-- (broadcasts and presence) or send. Someone who isn't in the room, or who
-- left the game, can't read along or slip into a game in progress.
drop policy if exists "room members receive" on realtime.messages;
create policy "room members receive" on realtime.messages
  for select to authenticated using (public.is_room_member(realtime.topic()));
drop policy if exists "room members send" on realtime.messages;
create policy "room members send" on realtime.messages
  for insert to authenticated with check (public.is_room_member(realtime.topic()));

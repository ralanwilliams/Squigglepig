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
-- runs on the players' phones; the host saves a `snapshot` of it at every
-- step, so if everyone closes the app the first one back picks it up. The
-- snapshot (prompts, drawings, guesses, scores) is deleted when the game ends
-- or the room closes.
create table if not exists public.rooms (
  code text primary key check (code ~ '^[A-Z0-9]{4}$'),
  phase text not null default 'lobby' check (phase in ('lobby', 'playing')),
  created_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  snapshot jsonb
);

-- Who is in each room. `left_at` is set when someone taps Leave game during a
-- game: they stay listed (their score still shows) until the game ends. In the
-- lobby, leaving deletes the row. `nudged` is set when an away player has been
-- sent a "game started" or "your turn" notification, so they get one, not one
-- per turn; doing anything in the room clears it.
create table if not exists public.room_members (
  room text not null references public.rooms (code) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 24),
  joined_at timestamptz not null default clock_timestamp(),
  left_at timestamptz,
  nudged boolean not null default false,
  primary key (room, user_id)
);
create unique index if not exists room_members_name on public.room_members (room, lower(name));
create index if not exists room_members_user on public.room_members (user_id);

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
revoke all on public.rooms, public.room_members, public.push_tokens from anon, authenticated;

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
create or replace function public.push(p_users uuid[], p_title text, p_body text, p_data jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  msgs jsonb;
begin
  select jsonb_agg(jsonb_build_object(
    'to', t.token, 'title', p_title, 'body', p_body, 'data', p_data,
    'sound', 'default', 'priority', 'high', 'channelId', 'rooms'))
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

-- Take `who` out of a room: in the lobby they're gone; mid-game they're marked
-- as left (still on the scoreboard). The last one out closes the room.
create or replace function public.leave_room_as(p_code text, p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  r public.rooms;
begin
  select * into r from public.rooms where code = p_code for update;
  if not found then return; end if;
  if r.phase = 'lobby' then
    delete from public.room_members where room = p_code and user_id = p_user;
  else
    update public.room_members set left_at = now()
    where room = p_code and user_id = p_user and left_at is null;
  end if;
  if not exists (select 1 from public.room_members where room = p_code and left_at is null) then
    delete from public.rooms where code = p_code;
  else
    update public.rooms set last_active_at = now() where code = p_code;
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
  insert into public.room_members (room, user_id, name) values (v_code, auth.uid(), v_name);
  return jsonb_build_object('status', 'ok', 'room', v_code, 'name', v_name);
end $$;

-- Join a room by its code, or come back to one you're already in (from the
-- background, or a reopened app). Newcomers can only join in the lobby.
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
  r public.rooms;
  m public.room_members;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if v_code !~ '^[A-Z0-9]{4}$' then return jsonb_build_object('status', 'not_found'); end if;
  select * into r from public.rooms where code = v_code for update;
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  select * into m from public.room_members where room = v_code and user_id = auth.uid();
  if found and m.left_at is null then
    update public.room_members set nudged = false where room = v_code and user_id = auth.uid();
    update public.rooms set last_active_at = now() where code = v_code;
    return jsonb_build_object('status', 'ok', 'room', v_code, 'name', m.name);
  end if;
  if p_rejoin then return jsonb_build_object('status', 'not_found'); end if;
  if found or r.phase <> 'lobby' then return jsonb_build_object('status', 'in_progress'); end if;
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
-- first) and, when asked, the host's last snapshot of the game. 'closed' if
-- the room is gone or the caller isn't in it any more.
create or replace function public.room_state(p_code text, p_snapshot boolean default false)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_code text := upper(btrim(p_code));
  r public.rooms;
begin
  select * into r from public.rooms where code = v_code;
  if not found or not public.is_room_member('room:' || v_code) then
    return jsonb_build_object('status', 'closed');
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
-- idle, and they're back, so they can be nudged again later.
create or replace function public.touch_room(p_code text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_code text := upper(btrim(p_code));
begin
  if not public.is_room_member('room:' || v_code) then return; end if;
  update public.rooms set last_active_at = now() where code = v_code;
  update public.room_members set nudged = false where room = v_code and user_id = auth.uid() and nudged;
end $$;

-- Start a game: the room closes to newcomers. Needs 3 players in the room
-- (away ones count).
create or replace function public.start_game(p_code text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_code text := upper(btrim(p_code));
begin
  if not public.is_room_member('room:' || v_code) then return false; end if;
  if (select count(*) from public.room_members where room = v_code and left_at is null) < 3 then
    return false;
  end if;
  update public.rooms set phase = 'playing', snapshot = null, last_active_at = now() where code = v_code;
  return true;
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

-- The host's copy of the game so far. Not activity: the host's clock moving
-- the game on by itself doesn't keep a room open.
create or replace function public.save_snapshot(p_code text, p_state jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_code text := upper(btrim(p_code));
begin
  if not public.is_room_member('room:' || v_code) then return; end if;
  if octet_length(p_state::text) > 4000000 then return; end if;
  update public.rooms set snapshot = p_state where code = v_code and phase = 'playing';
end $$;

-- Tell away players the game has started, or that it's their turn. The host
-- names who is away (it can see who has the app open); each is told once,
-- until they're back.
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
  end;
  if v_body is null or not public.is_room_member('room:' || v_code) then return; end if;
  with picked as (
    update public.room_members set nudged = true
    where room = v_code and user_id = any(p_users) and user_id <> auth.uid()
      and left_at is null and not nudged
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
-- room." A room being closed takes its members with it; nobody is told about
-- those.
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
  if v_phase <> 'lobby' or tg_op = 'UPDATE' then return null; end if;
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

-- Close every room nobody has done anything in for 10 minutes: tell the
-- phones still connected, then delete it (its members and snapshot go too).
create or replace function public.close_idle_rooms()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_code text;
begin
  for v_code in select code from public.rooms where last_active_at < now() - interval '10 minutes' loop
    perform realtime.send(jsonb_build_object('reason', 'idle'), 'room-closed', 'room:' || v_code, true);
    delete from public.rooms where code = v_code;
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

-- ---- Who may call what -----------------------------------------------------

revoke execute on function
  public.clean_name(text),
  public.is_room_member(text),
  public.push(uuid[], text, text, jsonb),
  public.leave_room_as(text, uuid),
  public.create_room(text),
  public.join_room(text, text, boolean),
  public.leave_room(text),
  public.room_state(text, boolean),
  public.touch_room(text),
  public.start_game(text),
  public.end_game(text),
  public.save_snapshot(text, jsonb),
  public.nudge(text, text, uuid[]),
  public.set_push_token(text),
  public.room_members_changed(),
  public.close_idle_rooms(),
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

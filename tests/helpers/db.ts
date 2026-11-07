import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

// supabase/rooms.sql in a throwaway Postgres (PGlite: real Postgres, in
// process, nothing to install), so the room functions the app calls can be
// tested as they run on the server. Supabase's own pieces the file leans on
// are stood in for: the auth schema (users, sessions, auth.uid() — here the
// user is whoever `as()` last set), Realtime (realtime.send is recorded in a
// table the tests read; realtime.messages and realtime.topic() exist for the
// channel policies), pg_net (http_post is recorded too) and pg_cron (the
// schedule calls do nothing; the tests run the jobs by hand).
const STUBS = `
create role anon nologin;
create role authenticated nologin;

create schema auth;
create table auth.users (
  id uuid primary key,
  is_anonymous boolean not null default true,
  created_at timestamptz not null default now()
);
create table auth.sessions (user_id uuid references auth.users (id) on delete cascade, updated_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('test.uid', true), '')::uuid
$$;

create schema realtime;
create table realtime.messages (id serial primary key, topic text);
create table realtime.sent (id serial primary key, topic text, event text, payload jsonb);
create function realtime.topic() returns text language sql stable as $$ select ''::text $$;
create function realtime.send(payload jsonb, event text, topic text, private boolean default true)
returns void language sql as $$
  insert into realtime.sent (topic, event, payload) values (topic, event, payload)
$$;

create schema net;
create table net.posts (id serial primary key, url text, body jsonb);
create function net.http_post(url text, body jsonb default null, headers jsonb default null)
returns bigint language sql as $$
  insert into net.posts (url, body) values (url, body) returning id::bigint
$$;

create schema cron;
create function cron.schedule(name text, schedule text, command text)
returns bigint language sql as $$ select 1::bigint $$;
`;

// The file as it's run in the Supabase dashboard, minus the extensions
// (stood in for above).
const roomsSql = () =>
  readFileSync(new URL('../../supabase/rooms.sql', import.meta.url), 'utf8').replace(
    /^create extension[^;]*;/gim,
    ''
  );

export type Db = {
  pg: PGlite;
  // Act as this user (their auth.uid()) from now on; null signs out.
  as: (user: string | null) => Promise<void>;
  // Call one of the room functions, as the app does through supabase.rpc.
  rpc: <T = any>(fn: string, args?: unknown[]) => Promise<T>;
  // A new guest, as signInAnonymously makes one.
  guest: () => Promise<string>;
  one: <T = any>(sql: string, params?: unknown[]) => Promise<T | undefined>;
  exec: (sql: string, params?: unknown[]) => Promise<void>;
};

let guests = 0;

export async function roomsDb(): Promise<Db> {
  const pg = new PGlite();
  await pg.exec(STUBS);
  await pg.exec(roomsSql());
  const db: Db = {
    pg,
    async as(user) {
      await pg.query(`select set_config('test.uid', $1, false)`, [user ?? '']);
    },
    async rpc(fn, args = []) {
      const marks = args.map((_, i) => `$${i + 1}`).join(', ');
      const res = await pg.query<{ out: any }>(`select public.${fn}(${marks}) as out`, args as any[]);
      return res.rows[0]?.out;
    },
    async guest() {
      guests += 1;
      const id = `00000000-0000-4000-8000-${String(guests).padStart(12, '0')}`;
      await pg.query('insert into auth.users (id) values ($1)', [id]);
      return id;
    },
    async one(sql, params = []) {
      const res = await pg.query(sql, params as any[]);
      return res.rows[0] as any;
    },
    async exec(sql, params = []) {
      await pg.query(sql, params as any[]);
    },
  };
  return db;
}

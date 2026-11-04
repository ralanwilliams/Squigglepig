-- One-row table for the keep-alive ping (.github/workflows/supabase-keepalive.yml).
--
-- Supabase pauses a free project after 7 days without database reads. Games
-- read the database now (rooms.sql), but a quiet week with nobody playing
-- would still pause it, so the workflow reads this row through the REST API
-- every few days.
--
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Safe to run again.

create table if not exists public.keepalive (
  id int primary key,
  note text not null default 'Read by the keep-alive workflow. Do not delete.'
);

insert into public.keepalive (id) values (1) on conflict (id) do nothing;

-- Readable with the publishable key (the anon role); nobody can write to it.
alter table public.keepalive enable row level security;
grant select on public.keepalive to anon;
drop policy if exists "keepalive is readable" on public.keepalive;
create policy "keepalive is readable" on public.keepalive for select to anon using (true);

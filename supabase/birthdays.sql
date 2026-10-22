-- Birthdays the app celebrates: on each one it wears the birthday theme, the
-- name iced on the cake the pig holds up (src/theme/skins/birthday.ts). The
-- app reads this table at launch and whenever it comes back to the
-- foreground, and keeps the last list it got on the phone, so adding or
-- removing a row needs no app update.
--
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Safe to run again. After that, edit the rows in Table Editor → birthdays.

create table if not exists public.birthdays (
  id bigint generated always as identity primary key,
  name text not null check (char_length(btrim(name)) between 1 and 24),
  month smallint not null check (month between 1 and 12),
  day smallint not null check (day between 1 and 31)
);

-- Readable with the publishable key (the anon role); nobody can write to it
-- from the app. Edit it in the dashboard, which bypasses these rules.
alter table public.birthdays enable row level security;
grant select on public.birthdays to anon;
drop policy if exists "birthdays are readable" on public.birthdays;
create policy "birthdays are readable" on public.birthdays for select to anon using (true);

-- The first one.
insert into public.birthdays (name, month, day)
select 'Alan', 2, 8
where not exists (select 1 from public.birthdays where name = 'Alan' and month = 2 and day = 8);

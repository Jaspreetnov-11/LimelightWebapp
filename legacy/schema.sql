-- Limelight: compatibility setup for the supplied JSON-based application schema.
-- Run the WHOLE file in Supabase SQL Editor.
-- IMPORTANT: existing incompatible expenses/holidays/tasks tables are MOVED
-- to limelight_legacy, not deleted. New public tables start empty.
-- Old records are NOT automatically migrated. Existing integrations referring
-- to the old public tables must be reviewed before running this file.
-- ACCESS: preserves the supplied app's anonymous read/write access model.
-- Anyone with the public key can read/change the NEW application tables.
-- Use with non-sensitive demo data only until server-enforced Auth/RLS is added.
-- Optional reporting columns/views are omitted: text-to-date generated columns
-- in the original script are not suitable immutable generation expressions.
-- This file has been statically checked, not executed against your database.

begin;

create schema if not exists limelight_legacy;
revoke all on schema limelight_legacy from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['expenses', 'holidays', 'tasks'] loop
    if to_regclass(format('public.%I', t)) is not null
       and not exists (
         select 1 from information_schema.columns
         where table_schema = 'public' and table_name = t
           and column_name = 'data' and data_type = 'jsonb'
       ) then
      if to_regclass(format('limelight_legacy.%I', t)) is not null then
        raise exception 'Archive table limelight_legacy.% already exists. Nothing committed; review before retrying.', t;
      end if;
      execute format('alter table public.%I set schema limelight_legacy', t);
      execute format('revoke all on table limelight_legacy.%I from public, anon, authenticated', t);
    end if;
  end loop;
end $$;

-- company-wide settings: a single row, id = 1
create table if not exists public.settings (
  id         int primary key default 1 check (id = 1),
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- bump updated_at on every change
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'users', 'attendance', 'leaves', 'regs', 'expenses', 'worklogs', 'tasks',
    'comments', 'announcements', 'acks', 'notifications', 'holidays', 'todos'
  ] loop
    execute format('create table if not exists public.%I (
        id         bigint primary key,
        data       jsonb not null,
        updated_at timestamptz not null default now())', t);
    execute format('create index if not exists %I on public.%I using gin (data jsonb_path_ops)', t || '_data_gin', t);

    execute format('drop trigger if exists touch on public.%I', t);
    execute format('create trigger touch before update on public.%I for each row execute function public.touch_updated_at()', t);

    -- row level security: the app signs in with the anon key, so allow it everything.
    -- (The app enforces roles itself; tighten these policies if you later move to Supabase Auth.)
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_all', t);
    execute format('create policy %I on public.%I for all to anon, authenticated using (true) with check (true)', t || '_all', t);

    -- live updates to every open device
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

drop trigger if exists touch on public.settings;
create trigger touch before update on public.settings for each row execute function public.touch_updated_at();
alter table public.settings enable row level security;
drop policy if exists settings_all on public.settings;
create policy settings_all on public.settings for all to anon, authenticated using (true) with check (true);
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'settings') then
    alter publication supabase_realtime add table public.settings;
  end if;
end $$;


-- Explicit API permissions for the application's supplied access model.
do $$
declare t text;
begin
  foreach t in array array[
    'settings', 'users', 'attendance', 'leaves', 'regs', 'expenses',
    'worklogs', 'tasks', 'comments', 'announcements', 'acks',
    'notifications', 'holidays', 'todos'
  ] loop
    execute format('grant select, insert, update, delete on table public.%I to anon, authenticated', t);
  end loop;
end $$;

notify pgrst, 'reload schema';
commit;

-- All 14 rows should report ready = true.
select expected.table_name,
       exists (
         select 1 from information_schema.columns c
         where c.table_schema = 'public'
           and c.table_name = expected.table_name
           and c.column_name = 'data' and c.data_type = 'jsonb'
       ) as ready
from unnest(array[
  'settings', 'users', 'attendance', 'leaves', 'regs', 'expenses',
  'worklogs', 'tasks', 'comments', 'announcements', 'acks',
  'notifications', 'holidays', 'todos'
]) as expected(table_name);

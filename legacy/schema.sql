-- ============================================================
-- Limelight Workspace — Supabase schema
-- Run once: Supabase dashboard → SQL editor → New query → paste → Run.
-- Safe to re-run (everything is "if not exists").
--
-- Design: one table per collection the app keeps in memory. Each row is one
-- record; the app's object is stored as-is in `data` (jsonb), keyed by the
-- app's numeric id. Frequently-queried fields are exposed as generated
-- columns so you can filter/report on them in SQL without touching the app.
-- ============================================================

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

-- ---------- generated columns for reporting (optional but handy) ----------
alter table public.users
  add column if not exists email      text    generated always as (data->>'email') stored,
  add column if not exists role       text    generated always as (data->>'role') stored,
  add column if not exists department text    generated always as (data->>'department') stored,
  add column if not exists active     boolean generated always as ((data->>'active')::boolean) stored;
create unique index if not exists users_email_key on public.users (email);

alter table public.attendance
  add column if not exists user_id bigint generated always as ((data->>'user_id')::bigint) stored,
  add column if not exists date    date   generated always as ((data->>'date')::date) stored,
  add column if not exists mode    text   generated always as (data->>'mode') stored;
create unique index if not exists attendance_user_date_key on public.attendance (user_id, date);
create index if not exists attendance_date_idx on public.attendance (date);

alter table public.leaves
  add column if not exists user_id   bigint generated always as ((data->>'user_id')::bigint) stored,
  add column if not exists status    text   generated always as (data->>'status') stored,
  add column if not exists from_date date   generated always as ((data->>'from')::date) stored,
  add column if not exists to_date   date   generated always as ((data->>'to')::date) stored;
create index if not exists leaves_user_idx on public.leaves (user_id, status);

alter table public.regs
  add column if not exists user_id bigint generated always as ((data->>'user_id')::bigint) stored,
  add column if not exists status  text   generated always as (data->>'status') stored,
  add column if not exists date    date   generated always as ((data->>'date')::date) stored;

alter table public.expenses
  add column if not exists user_id bigint  generated always as ((data->>'user_id')::bigint) stored,
  add column if not exists status  text    generated always as (data->>'status') stored,
  add column if not exists date    date    generated always as ((data->>'date')::date) stored,
  add column if not exists amount  numeric generated always as ((data->>'amount')::numeric) stored;

alter table public.worklogs
  add column if not exists user_id bigint generated always as ((data->>'user_id')::bigint) stored,
  add column if not exists date    date   generated always as ((data->>'date')::date) stored;
create index if not exists worklogs_date_idx on public.worklogs (date);

alter table public.tasks
  add column if not exists department text generated always as (data->>'department') stored,
  add column if not exists status     text generated always as (data->>'status') stored,
  add column if not exists due        date generated always as (nullif(data->>'due', '')::date) stored;

alter table public.comments
  add column if not exists task_id bigint generated always as ((data->>'task_id')::bigint) stored;
create index if not exists comments_task_idx on public.comments (task_id);

alter table public.notifications
  add column if not exists user_id bigint generated always as ((data->>'user_id')::bigint) stored,
  add column if not exists read    int    generated always as (coalesce((data->>'read')::int, 0)) stored;
create index if not exists notifications_user_idx on public.notifications (user_id, read);

alter table public.todos
  add column if not exists user_id bigint generated always as ((data->>'user_id')::bigint) stored;

alter table public.holidays
  add column if not exists date date generated always as ((data->>'date')::date) stored;

-- ---------- a few reporting views ----------
create or replace view public.v_attendance as
select a.id, a.user_id, u.data->>'name' as name, u.department, a.date, a.mode,
       (a.data->>'in')::timestamptz  as clock_in,
       (a.data->>'out')::timestamptz as clock_out,
       a.data->>'note' as note
from public.attendance a left join public.users u on u.id = a.user_id;

create or replace view public.v_pending_approvals as
select 'leave' as kind, id, user_id, status, updated_at from public.leaves    where status = 'pending'
union all
select 'regularization',  id, user_id, status, updated_at from public.regs      where status = 'pending'
union all
select 'expense',         id, user_id, status, updated_at from public.expenses  where status = 'pending';

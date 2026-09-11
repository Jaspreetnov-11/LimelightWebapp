-- Lighthouse workspace · Supabase schema (tables are prefixed lh_ so they never clash with other apps in the same project)
-- Run this once in Supabase → SQL Editor. Safe to re-run (uses IF NOT EXISTS).

create extension if not exists pgcrypto;

create table if not exists public.lh_employees (
  id text primary key,
  name text not null,
  role text default '',
  dept text default '',
  email text default '',
  phone text default '',
  emp_id text default '',
  joined date,
  dob date,
  managers jsonb default '[]'::jsonb,
  salary numeric default 0,
  access text default 'staff',
  av text, ini text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.lh_departments (
  id text primary key,
  name text not null,
  billable boolean default true,
  daily numeric default 8,
  manager text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.lh_projects (
  id text primary key,
  name text not null,
  client text default '',
  billable boolean default true,
  manager text default '',
  start date,
  alloc numeric default 0,          -- allocated minutes
  status text default 'Approved',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.lh_tasks (
  id text primary key,
  title text not null,
  project text default '',
  assignee text default '',
  assigned_by text default '',
  assigned date,
  deadline date,
  completed date,
  status text default 'pipeline',   -- pipeline | progress | approval | completed | hold
  mins numeric default 0,
  type text default 'Other',
  flag boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.lh_attendance (
  id text primary key,
  emp text not null,
  date date not null,
  clock_in text default '',
  clock_out text default '',
  mode text default 'office',       -- office | wfh | field
  status text default '',           -- present | half | absent | leave
  ot_hours numeric default 0,
  fine_hours numeric default 0,
  note text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (emp, date)
);

create table if not exists public.lh_leaves (
  id text primary key,
  emp text not null,
  from_date date not null,
  to_date date not null,
  reason text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.lh_payments (
  id text primary key,
  emp text not null,
  date date not null,
  amount numeric not null default 0,
  type text default 'Salary',       -- Salary | Advance | Bonus | Reimbursement | Fine
  note text default '',
  assigned_by text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.lh_holidays (
  id text primary key,
  name text not null,
  date date not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.lh_todos (
  id text primary key,
  text text not null,
  done boolean default false,
  owner text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.lh_files (
  id text primary key,
  name text not null,
  project text default '',
  assigned_by text default '',
  size text default '',
  date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.lh_activity (
  id text primary key,
  text text not null,
  at text default '',
  read boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- updated_at trigger
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$ declare t text;
begin
  foreach t in array array['lh_employees','lh_departments','lh_projects','lh_tasks','lh_attendance','lh_leaves','lh_payments','lh_holidays','lh_todos','lh_files','lh_activity'] loop
    execute format('drop trigger if exists touch_%I on public.%I', t, t);
    execute format('create trigger touch_%I before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

-- Row Level Security: any signed-in user of this project can read and write.
-- Tighten later (e.g. staff can only see their own rows) once roles are needed.
do $$ declare t text;
begin
  foreach t in array array['lh_employees','lh_departments','lh_projects','lh_tasks','lh_attendance','lh_leaves','lh_payments','lh_holidays','lh_todos','lh_files','lh_activity'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "authenticated full access" on public.%I', t);
    execute format('create policy "authenticated full access" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- Realtime (so every open browser updates live)
do $$ declare t text;
begin
  foreach t in array array['lh_employees','lh_departments','lh_projects','lh_tasks','lh_attendance','lh_leaves','lh_payments','lh_holidays','lh_todos','lh_files','lh_activity'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null; end;
  end loop;
end $$;

-- Clock-in / clock-out location (added later; safe to re-run)
alter table public.lh_attendance
  add column if not exists in_lat numeric,
  add column if not exists in_lng numeric,
  add column if not exists in_acc numeric,
  add column if not exists in_addr text default '',
  add column if not exists out_lat numeric,
  add column if not exists out_lng numeric,
  add column if not exists out_acc numeric,
  add column if not exists out_addr text default '';

-- Starter departments (only if empty)
insert into public.lh_departments (id, name, billable, daily)
select * from (values
  ('d1','Accounts',false,8),('d2','Admin',false,8),('d3','Content',true,8),('d4','Designing',true,8),
  ('d5','Editing',true,8),('d6','Field-Shoot',true,9),('d7','HR',false,8),('d8','Operations',false,8),
  ('d9','Sales',true,8),('d10','Strategy',true,8)
) as v(id,name,billable,daily)
where not exists (select 1 from public.lh_departments);

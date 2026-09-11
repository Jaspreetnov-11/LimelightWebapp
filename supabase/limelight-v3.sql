-- Limelight PostgreSQL schema preparation (existing Express password/JWT login).
-- This is NOT a Supabase Auth / auth.users migration.
-- Backend currently uses SQLite: do not deploy a database switch until its queries
-- and their callers have been converted and tested for asynchronous PostgreSQL.
-- No SQLite data is copied by this script. No tables or rows are deleted.
-- Existing public.lh_* tables retain their types and data; missing tables/columns
-- are added. Unexpected existing schemas need a separate compatibility review.
-- Run as database owner in Supabase SQL Editor only at backend cutover.
-- Access becomes backend-only: legacy direct-browser access will stop working.
-- Security reference: https://supabase.com/docs/guides/api/securing-your-api

begin;
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

-- Current application stores bcrypt password hashes and text user IDs.
create table if not exists public.lh_users (
  id text primary key,
  email text not null,
  password_hash text not null,
  role text not null default 'staff',
  employee_id text,
  reset_token text,
  reset_expires text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Abort atomically if existing normalized emails conflict; never discard accounts.
create unique index if not exists lh_v3_users_email_normalized
  on public.lh_users (lower(btrim(email)));

alter table public.lh_attendance
  add column if not exists in_lat numeric,
  add column if not exists in_lng numeric,
  add column if not exists in_acc numeric,
  add column if not exists in_addr text default '',
  add column if not exists out_lat numeric,
  add column if not exists out_lng numeric,
  add column if not exists out_acc numeric,
  add column if not exists out_addr text default '';
alter table public.lh_leaves add column if not exists status text default 'approved';
alter table public.lh_files
  add column if not exists url text default '',
  add column if not exists mime_type text default '';

-- Apply the requested role rule to existing PostgreSQL records.
-- Local SQLite users are unaffected and require their own migration.
update public.lh_users
set role = case when lower(btrim(email)) = 'admin@limelight.in' then 'admin' else 'staff' end
where role is distinct from
  case when lower(btrim(email)) = 'admin@limelight.in' then 'admin' else 'staff' end;
update public.lh_employees
set access = case when lower(btrim(email)) = 'admin@limelight.in' then 'admin' else 'staff' end
where access is distinct from
  case when lower(btrim(email)) = 'admin@limelight.in' then 'admin' else 'staff' end;

-- Server must authenticate ownership of accounts; email alone is not proof.
create or replace function public.lh_v3_enforce_user_role()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  new.email := lower(btrim(new.email));
  new.role := case when new.email = 'admin@limelight.in' then 'admin' else 'staff' end;
  return new;
end;
$$;
revoke all on function public.lh_v3_enforce_user_role() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'public.lh_users'::regclass
    and tgname = 'lh_v3_user_role') then
    create trigger lh_v3_user_role before insert or update on public.lh_users
      for each row execute function public.lh_v3_enforce_user_role();
  end if;
end;
$$;

create index if not exists lh_v3_users_employee on public.lh_users(employee_id);
create index if not exists lh_v3_employees_email on public.lh_employees(lower(btrim(email)));
create index if not exists lh_v3_employees_dept on public.lh_employees(dept);
create index if not exists lh_v3_tasks_assignee_status on public.lh_tasks(assignee, status);
create index if not exists lh_v3_tasks_project on public.lh_tasks(project);
create index if not exists lh_v3_tasks_deadline on public.lh_tasks(deadline);
create unique index if not exists lh_v3_attendance_emp_date on public.lh_attendance(emp, date);
create index if not exists lh_v3_attendance_date on public.lh_attendance(date);
create index if not exists lh_v3_leaves_emp_dates on public.lh_leaves(emp, from_date, to_date);
create index if not exists lh_v3_payments_emp_date on public.lh_payments(emp, date);
create index if not exists lh_v3_todos_owner_done on public.lh_todos(owner, done);
create index if not exists lh_v3_files_project on public.lh_files(project);
create index if not exists lh_v3_activity_created on public.lh_activity(created_at desc);

-- The app uses its own JWT, not the Supabase authenticated role.
-- Never expose password hashes, payroll, or employee records directly to browsers.
-- Existing RLS policies cannot grant access after these table grants are revoked.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'lh_users','lh_employees','lh_departments','lh_projects','lh_tasks',
    'lh_attendance','lh_leaves','lh_payments','lh_holidays','lh_todos',
    'lh_files','lh_activity'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on table public.%I to service_role', table_name);
  end loop;
end;
$$;

commit;

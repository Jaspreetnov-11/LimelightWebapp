# Limelight Workspace

Attendance, work reports, leaves, expenses, tasks and announcements for the Limelight team.
Single-file web app (`index.html`) with a Supabase backend.

## Setup (one time)

1. **Create the tables.** Open the Supabase project → **SQL editor** → New query.
   Paste the contents of [`legacy/schema.sql`](legacy/schema.sql) and click **Run**.
   It is safe to run again later.
2. **Add the key.** In the Supabase dashboard go to **Project settings → API** and copy the
   **anon public** key. Open `index.html` and replace `PASTE_YOUR_ANON_KEY_HERE` with it:
   ```js
   const SUPABASE_ANON_KEY = 'eyJ...';
   ```
3. Open `index.html` (or host it on GitHub Pages). The first visit asks you to create the admin account.

## How the backend works

- Every collection the app uses (`users`, `attendance`, `leaves`, `regs`, `expenses`, `worklogs`,
  `tasks`, `comments`, `announcements`, `acks`, `notifications`, `holidays`, `todos`) is a table.
  Each row is one record: `id` + the record as `data` (jsonb). Company settings live in `settings` (one row).
- On load the app fetches everything, then after every action it diffs what changed and upserts /
  deletes only those rows. Other open devices receive the change through Supabase Realtime.
- Passwords are stored as SHA-256 hashes. Accounts created before this change are upgraded on their next sign-in.
- Handy generated columns (`user_id`, `date`, `status`, …) and two views (`v_attendance`,
  `v_pending_approvals`) let you run reports straight from the SQL editor.

## Security note

The app signs in to Supabase with the public anon key and enforces roles itself, so the row-level
security policies allow the anon key full access. That is fine for an internal team tool whose URL is
not public. If you need stricter control, move sign-in to Supabase Auth and tighten the policies in
`schema.sql`.

---

## Lighthouse app (`lighthouse.html`)

A second, standalone version of the workspace in the Limelight look (black stage, yellow accent):
staff list with pending balances, day-wise attendance marking (P / HD / A / L / Fine / Overtime),
payments, payroll, projects, kanban tasks, departments and CSV reports.

- Open `lighthouse.html` directly in a browser. It starts in demo mode (login `admin@lighthouse.io` / `Lighthouse@123`).
- To use Supabase: run [`supabase/lighthouse-schema.sql`](supabase/lighthouse-schema.sql) once in the SQL editor
  (its tables are prefixed `lh_`, so they do not touch the tables used by `index.html`), create a user under
  **Authentication → Users**, then in the app go to **Settings** and paste the anon public key.
- Uses Supabase Auth (email/password, optional Google) and realtime sync across open browsers.

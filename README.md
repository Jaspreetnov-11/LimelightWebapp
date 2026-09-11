# Lighthouse — Limelight Workspace

One repo, one Vercel project, one Supabase project:

- GitHub: https://github.com/Jaspreetnov-11/lighthouse
- Vercel (production): https://lighthouse-limelight.vercel.app — project `lighthouse` (env: DATABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAILS)
- Supabase: project `Lighthouse` (ref lwpueuxyuokszeflgyfv) — Auth for logins, Postgres for data

Staff, GPS attendance, payroll, projects, kanban tasks, departments and reports for the Limelight team.

- **Frontend (View):** Next.js 15 / React 19 (App Router) in `src/`
- **Backend (Model + Controller):** Express on Node.js in `backend/` — REST API under `/api`
- **Database:** SQLite (`node:sqlite`, Node 22.5+) for local/dev, schema in `backend/database/schema.sql`

## Run locally

```bash
npm install
npm run dev
```

`npm run dev` starts both servers: the API on http://localhost:5000 and the web app on http://localhost:3000
(Next.js proxies `/api/*` to the backend). Seeded admin: `admin@lighthouse.io` / `Lighthouse@123`.

Other scripts: `npm run dev:api`, `npm run dev:web`, `npm run build`, `npm start` (Next.js), `npm run start:api`, `npm test`.

## Deploy (Vercel)

The repo deploys as a Next.js project; `/api/*` is served by the Express app through the serverless
entry `api/index.js` (see `vercel.json`). Set `JWT_SECRET` in the project environment.
Note: SQLite on Vercel is ephemeral — point `DATABASE_TYPE`/Supabase keys at a hosted database for production data.

## Folder structure (MVC)

```
backend/                     Node.js / Express — Model + Controller
├── models/                  data access (BaseModel + one model per table)
├── controllers/             request handlers
├── services/                business logic (attendance, payroll, auth, reports)
├── routes/                  REST routes → controllers
├── middleware/              auth (JWT), validation, security, uploads, errors
├── validators/              request schemas
├── database/                schema.sql, init + seed
└── utils/                   calculations, responses, logger

src/                         Next.js — View layer with a client-side MVC split
├── app/                     routes (pages): login, signup, (app)/dashboard, staff, staff/[id],
│                            attendance, projects, tasks, departments, payments, payroll,
│                            reports, alerts, notifications, files, settings
├── models/                  API client + one model object per backend resource
├── controllers/             state & actions: AuthController, DataController, UiController,
│                            useClock (GPS clock-in), useModals (add/edit forms)
├── views/
│   ├── layout/              AppShell (sidebar, topbar, mobile bottom nav)
│   ├── ui/                  reusable components (Panel, Donut, Chip, FormModal, …)
│   └── screens/             one component per screen
└── lib/                     formatting, calculations, downloads

api/index.js                 Vercel serverless entry → backend/app.js
public/                      logo.png, icon.svg, manifest.json (installable PWA)
legacy/                      previous single-file apps (kept for reference)
```

## API overview

`/api/auth` (register, login, me, forgot-password) · `/api/employees` · `/api/departments` · `/api/projects` ·
`/api/tasks` (+ `PATCH /:id/status`) · `/api/attendance` (clock-in/out with GPS, today, stats, update) ·
`/api/leaves` · `/api/payments` · `/api/payroll` (+ `pay-all`) · `/api/holidays` · `/api/todos` ·
`/api/files` (upload/download) · `/api/activity` (+ alerts) · `/api/reports/*` (CSV)

All write routes need `Authorization: Bearer <JWT>`; admin-only routes use `restrictTo('admin')`.

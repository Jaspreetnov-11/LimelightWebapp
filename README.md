# Limelight Workspace

Attendance, work reports, leaves, payroll, expenses, tasks and announcements for the Limelight team.
Features a responsive frontend (`index.html`) backed by a production-grade **MVC (Model-View-Controller) REST API backend** compatible with both local execution and **Vercel** serverless hosting.

---

## 🚀 Running Locally

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the application**:
   ```bash
   npm start
   ```
   This command starts the Express server at **`http://localhost:5000`** and serves:
   - The full REST API at `http://localhost:5000/api`
   - The single-page web app at `http://localhost:5000/`

3. **Run automated verification tests**:
   ```bash
   npm test
   ```

---

## 🌐 Vercel Deployment

The project is structured to deploy directly to **Vercel** from this repository without breaking any existing live URLs:
- **`vercel.json`** routes all `/api/*` endpoints to the serverless function in `api/index.js`.
- Root paths (`/`, `/index.html`, `/logo.png`, etc.) are served statically by Vercel's Edge Network.
- In production on Vercel, the database connects to the managed Supabase PostgreSQL instance (`lh_*` tables), ensuring full persistence across ephemeral serverless invocations.

---

## 🏛️ Backend Architecture (MVC Pattern)

```
LimelightWebapp/
├── api/
│   └── index.js                  # Vercel Serverless Function entrypoint
├── backend/
│   ├── config/
│   │   ├── db.js                 # SQLite (with WAL mode) + Supabase cloud fallback
│   │   └── env.js                # Environment configuration loader
│   ├── database/
│   │   ├── schema.sql            # Normalized DDL schema with explicit indexes
│   │   ├── init.js               # Auto-migration runner on startup
│   │   └── seed.js               # Initial seed dataset (departments, admin, tasks)
│   ├── middleware/
│   │   ├── auth.middleware.js    # JWT authentication & RBAC (admin, manager, staff)
│   │   ├── error.middleware.js   # Global error handling middleware (standardized JSON)
│   │   ├── validate.middleware.js# Generic validation runner (DRY)
│   │   └── upload.middleware.js  # Multer file upload handler
│   ├── utils/
│   │   ├── apiResponse.js        # Standardized API response formatters
│   │   ├── appError.js           # Custom operational error class
│   │   ├── catchAsync.js         # Async error wrapper (eliminates try/catch boilerplate)
│   │   ├── calculations.js       # Shared payroll, working days & hours math
│   │   └── logger.js             # Formatted request/debug logger
│   ├── validators/               # Input validation schemas per section
│   ├── models/                   # Data access layer (M in MVC)
│   ├── services/                 # Business logic layer
│   ├── controllers/              # HTTP request handlers (C in MVC)
│   ├── routes/                   # Routing layer (12 section modules + master router)
│   ├── app.js                    # Express app configuration & middleware pipeline
│   └── server.js                 # Local server entrypoint (port 5000)
├── index.html                    # Frontend web application (pixel-perfect UI preserved)
└── vercel.json                   # Vercel routing configuration
```

---

## 📋 API Section Overview

| Section | Base Route | Key Operations |
|---|---|---|
| **Auth** | `/api/auth` | Register, login (JWT + bcrypt), session `/me`, forgot password |
| **Employees** | `/api/employees` | Full CRUD, search, department filtering, calculated pending balance |
| **Departments**| `/api/departments` | Full CRUD, daily standard hours, billable rules |
| **Projects** | `/api/projects` | Full CRUD, allocated minutes vs. consumed minutes aggregation |
| **Tasks** | `/api/tasks` | Kanban status (`pipeline` → `progress` → `approval` → `completed` → `hold`), hours tracking |
| **Attendance** | `/api/attendance` | Clock-in & Clock-out with GPS coordinates, daily register, monthly stats |
| **Leaves** | `/api/leaves` | Apply, view today's leaves, approvals |
| **Payments** | `/api/payments` | Ledger for Salary, Advance, Bonus, Reimbursement, Fine |
| **Payroll** | `/api/payroll` | Auto monthly payroll formula calculation, batch payout |
| **Holidays** | `/api/holidays` | Company and public holidays |
| **To-Dos** | `/api/todos` | Personal task management with toggle |
| **Files** | `/api/files` | File upload with Multer, metadata, streaming download |
| **Activity** | `/api/activity` | Live audit logs, notifications, overdue task alerts |
| **Reports** | `/api/reports` | CSV exports (Attendance Register, Payroll, Payments, Staff, Tasks, Projects) |

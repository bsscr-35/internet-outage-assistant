# Internet Outage Response & Recovery Assistant

A React/Vite and Express application for reviewing internet outages, affected locations and services, recovery activity, and post-recovery checks. MySQL is the application's only database.

> **Database safety:** the application uses the existing `outage_assistant_demo` database. It does not create, drop, or reseed databases or tables. The original `outage_assistant` database must not be used for testing. Review and apply migrations manually. Legacy operational records remain unowned and hidden until explicitly assigned or deliberately removed.

## Features

- Live dashboard metrics, recent outage records, severity chart, and affected-location count.
- Outage, network component, impact, recovery, verification, report, and location pages backed by API data.
- Account registration/login with salted scrypt password hashes and expiring signed bearer tokens.
- Per-user ownership enforced in backend queries using the authenticated token identity.
- Authenticated outage reporting with optional service-impact records and outage status updates.
- Recovery-action creation and status updates with transactional status-audit and technician execution-log entries.
- Recovery and outage analytics based on relational records; CSV report export.
- Responsive navigation, request loading/error states, and 30-second auto-refresh on data pages.

The existing `service` table contains IDs only. The interface displays service IDs instead of inventing service names.

## Technology and architecture

- **Frontend:** React, Vite, Tailwind CSS, React Router, Axios, Recharts, Lucide.
- **Backend:** Node.js, Express 5, mysql2.
- **Database:** MySQL 8 (`outage_assistant_demo`).

```text
frontend/src/                 React pages, components, auth context, API client
backend/app.js                Express application and REST routes
backend/server.js             Environment loading, listener, database shutdown
backend/controllers/          SQL-backed request handlers
backend/config/               MySQL connection pool
backend/migrations/           Additive MySQL migrations (review/apply manually)
backend/test/                 Node API and MySQL read-only integration tests
```

## Database and configuration

The project expects the existing `outage_assistant_demo` schema and a least-privilege application account. Recovery-action creation and recording service-verification results require table-specific `INSERT` grants; the exact administrator-only commands are documented in [the Windows setup guide](docs/WINDOWS_DEMO_SETUP.md). Do not grant privileges on or test against the original `outage_assistant` database.

Copy the example environment file only if no local `backend/.env` exists. Preserve existing credentials and configure `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME=outage_assistant_demo`, and a secure `JWT_SECRET`. Keep secrets out of source control.

Follow [the Windows setup and end-to-end demo guide](docs/WINDOWS_DEMO_SETUP.md) for installation, environment configuration, startup, tests, and demonstration steps. Any schema migration or permission change is a manual administrator operation.

## Run on macOS

Use two Terminal windows. Do not overwrite an existing `backend/.env`; it contains local credentials.

```sh
cd backend
npm ci
npm test
npm start
```

In the second window:

```sh
cd frontend
npm ci
npm run lint
npm run build
npm run dev
```

Open `http://localhost:5173`. The backend listens at `http://localhost:3000`; verify it at `/api/health` and `/api/db-test`. A successful database test confirms connectivity only. Owner-scoped APIs also require `backend/migrations/003_user_record_ownership.sql`; review and back up the database before applying it as an administrator. The migration adds nullable ownership columns and leaves all existing records unowned and unchanged, so they remain hidden until an administrator confirms their owners. Never run the optional destructive migration `004_remove_unowned_demo_records.sql` without explicit approval.

## REST API

All routes are prefixed with `/api`. Successful list/detail endpoints retain their JSON response shapes (for example `{ "outages": [...] }`). Write endpoints return JSON errors with appropriate HTTP status codes. Authenticated requests use a bearer token in the `Authorization` header.

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/health`, `/db-test` | Public | API and MySQL health |
| `POST` | `/auth/register` | Public, rate-limited | Register a user |
| `POST` | `/auth/login` | Public, rate-limited | Validate credentials and return an expiring token |
| `GET` | `/auth/me` | Authenticated | Return the authenticated account |
| `GET` | `/dashboard/stats` | Authenticated | Database-derived totals for the signed-in user |
| `GET` | `/outages`, `/outages/:id` | Authenticated | List the user's outages or retrieve owned outage details, impacts, and recovery actions |
| `POST` | `/outages` | Authenticated | Create an outage and optional impact record(s) transactionally |
| `PATCH` | `/outages/:id/status` | Authenticated | Update an outage to `ONGOING` or `RESOLVED` |
| `GET` | `/locations`, `/services` | Authenticated | List the user's locations and shared service reference IDs |
| `POST` | `/locations` | Authenticated | Add a location with a unique name/region pair |
| `GET` | `/components`, `/impacts`, `/service-verifications` | Authenticated | Read only records belonging to the signed-in user |
| `POST` | `/components` | Authenticated | Add a component linked to an existing location |
| `POST` | `/outages/:id/impacts` | Authenticated | Record an impact for an existing outage and service; duplicate pairs are rejected |
| `POST` | `/service-verifications` | Authenticated | Record an observed outage-level service and connectivity check |
| `GET` | `/recovery-actions`, `/recovery-logs`, `/recovery-status-audit` | Authenticated | Read recovery records and audit history for the user's outages |
| `GET` | `/outages/:id/recovery-actions` | Authenticated | Retrieve actions only when the outage belongs to the signed-in user |
| `POST` | `/recovery-actions` | Authenticated | Create a `PENDING` action for an existing outage |
| `PATCH` | `/recovery-actions/:id/status` | Authenticated | Update recovery status and append audit/log rows transactionally |
| `GET` | `/reports/summary` | Authenticated | Live severity, recovery, location, and per-incident summaries for the signed-in user |

Outage creation accepts an existing `componentId` (optionally with its `locationId` for a consistency check), an existing `locationId` plus `newComponent`, or `newLocation` (`locationName`, `region`) plus `newComponent` (`componentName`, `componentType`, `criticality`, optional `ipAddress`). Matching existing location/component records are reused; otherwise records are created and linked in the same transaction as the outage and optional impact. A newly created component starts as `DOWN` because its outage is `ONGOING`; the Locations page recalculates its totals from saved outage and impact rows. Creating locations and components requires table-level `INSERT` permission on `location` and `network_component` in `outage_assistant_demo`; see the Windows demo guide. Recovery-action creation accepts `outageId`, `actionType`, `description`, `priority`, and `recommendedAt` (`YYYY-MM-DDTHH:mm`). Recovery updates accept `status` and optional `remarks`. Technician assignment is recorded in `recovery_log.AssignedTo`, not on `recovery_action`.

The existing `service_verification` schema links a check to an outage but has no `ServiceID` column. Verification responses therefore show service IDs from that outage's impact records as context; they do not represent a direct verification-to-service foreign key.

## Ownership and legacy data

Apply `backend/migrations/003_user_record_ownership.sql` once, after reviewing and backing up the database. It adds nullable user foreign keys to locations, components, and outages; child records such as impacts, recovery actions/logs, verifications, and audit entries inherit ownership through their outage. New records get their owner exclusively from the validated bearer token, not request-body IDs. Existing records stay `NULL`/unowned and are excluded from user-facing APIs. Do not assign old rows to an account unless the data owner confirms the correct owner.

`backend/migrations/004_remove_unowned_demo_records.sql` is an optional, destructive cleanup. It previews affected counts and defaults to no deletion. After reviewing the preview and taking a backup, an administrator must deliberately change `@confirm_remove_unowned_demo_records` to `'YES'` before executing it. It removes only unowned operational rows in foreign-key-safe order; it does not drop schema objects or delete accounts and reference data. Neither migration runs automatically at application startup.

## Testing

```powershell
Set-Location backend
npm test
Set-Location ..\frontend
npm run lint
npm run build
```

Backend tests cover health, authenticated MySQL read APIs, owner-isolation checks, request validation, password hashing, token verification, authentication guards, and removed routes. Ownership-dependent MySQL integration checks are skipped until migration 003 is applied. Tests do not write registration, outage, or recovery records.

## Course project

- **Project:** Internet Outage Response & Recovery Assistant
- **Course:** UE23CS351A – DBMS Project, PES University
- **Guide:** Dr. Shilpa S, Assistant Professor

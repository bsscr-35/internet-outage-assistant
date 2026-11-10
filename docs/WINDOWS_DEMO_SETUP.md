# Windows setup and end-to-end demo guide

Follow these steps in order from PowerShell. This guide targets the existing React/Vite, Express, and MySQL project. The project uses only MySQL. The migration and account scripts are manual administrator operations; do not run them unless you have reviewed and approved them.

## 1. Prerequisites

- Windows 10/11.
- Node.js 20.19+ or 22.12+ with npm.
- The existing MySQL 8 `outage_assistant_demo` database and an administrator login.
- The MySQL Server Windows service, normally `MySQL80`.

The repository does not contain a database dump or seed script. Do not create, drop, or reseed a database to follow this guide. Back up the existing database before enabling and testing writes.

Open PowerShell and check the installed tools/services:

```powershell
node --version
npm --version
mysql --version
Get-Service MySQL80
```

If the MySQL service is stopped, start it from an elevated PowerShell:

```powershell
Start-Service MySQL80
```

## 2. Get the project and install dependencies

If the project is already checked out, open PowerShell in its root. Otherwise:

```powershell
git clone https://github.com/bsscr-35/internet-outage-assistant.git
Set-Location internet-outage-assistant
```

Install the existing lockfile dependencies:

```powershell
Set-Location backend
npm ci
Set-Location ..\frontend
npm ci
Set-Location ..
```

## 3. Review the existing schema, then add authentication storage

`backend/migrations/001_auth_credentials.sql` adds only `auth_credential`. It does not alter or delete existing tables or rows. It references the existing `user.UserID` as `INT`; that column and the parent table's InnoDB engine were checked against the configured database. The credential table is InnoDB, uniquely indexes email, and cascades user deletion only to its corresponding credential.

Use the MySQL administrator account (replace the account name; MySQL will prompt for its password) to apply the migration **once**, after reviewing it and backing up the database:

```powershell
& $env:ComSpec /c 'mysql --host=127.0.0.1 --user=YOUR_ADMIN_ACCOUNT --password outage_assistant_demo < backend\migrations\001_auth_credentials.sql'
```

This project has not run that command. If the migration fails or the schema differs from the inspected schema, stop and inspect before proceeding. `CREATE TABLE IF NOT EXISTS` does not validate or repair a pre-existing, incompatible table of that name.

## 4. Add per-user ownership, then optionally clean legacy demo records

Review and back up the database, then apply `003_user_record_ownership.sql` once as the administrator:

```powershell
& $env:ComSpec /c 'mysql --host=127.0.0.1 --user=YOUR_ADMIN_ACCOUNT --password outage_assistant_demo < backend\migrations\003_user_record_ownership.sql'
```

The migration adds nullable `OwnerUserID` foreign keys to `location`, `network_component`, and `outage`. Ownership of impacts, recovery actions/logs, service verifications, and audit entries is derived through their outage. Existing records remain unowned and are not exposed to newly registered users. Do not assign legacy rows without confirming their actual owner.

If the database owner wants to remove unowned legacy operational records, first run `004_remove_unowned_demo_records.sql` with its confirmation variable left at `'NO'` to inspect the preview counts. Back up the database and review which rows will be deleted. Only after explicit approval, change `@confirm_remove_unowned_demo_records` to `'YES'` and execute the script. Its deletes are FK-aware and preserve user accounts, credentials, services, user-service rows, and all schema objects. **This cleanup is optional, irreversible, and is never run by the application.**

## 5. Create the least-privilege application MySQL account

The base account-setup script configures `SELECT` on `user`, `auth_credential`, `outage`, `network_component`, `location`, `outage_impact`, `service`, `recovery_action`, `recovery_log`, `recovery_status_audit`, and `service_verification`. Health uses `SELECT 1`.

The base account-setup script configures these writes:

- `INSERT`: `user`, `auth_credential`, `outage`, `outage_impact`, `recovery_status_audit`, `recovery_log`.
- `UPDATE`: `outage`, `recovery_action`.

No `DELETE`, schema-wide DDL, or rights on unrelated tables are needed. Inspect `backend/migrations/002_create_app_user.sql`. Generate a random application password, then replace the SQL file's `REPLACE_WITH_RANDOM_HEX_PASSWORD` placeholder locally with that value. Keep the password out of Git and restore the placeholder in the SQL file after running it.

The API also supports recording new recovery actions and observed service checks. To enable those optional writes, an administrator must additionally grant only:

```sql
GRANT INSERT ON outage_assistant_demo.recovery_action
  TO 'outage_assistant_app'@'localhost';
GRANT INSERT ON outage_assistant_demo.service_verification
  TO 'outage_assistant_app'@'localhost';
```

Do not run these commands unless the database owner approves. They grant permissions only on the two named tables in `outage_assistant_demo`, and none on the original `outage_assistant` database. Do not execute them from the application.

The outage form can create a location and its first component together with an outage. The existing base grants already cover `INSERT` on `outage` and `outage_impact`; this linked-creation flow additionally requires:

```sql
GRANT INSERT ON outage_assistant_demo.location
  TO 'outage_assistant_app'@'localhost';
GRANT INSERT ON outage_assistant_demo.network_component
  TO 'outage_assistant_app'@'localhost';
```

Do not run these commands without the database owner's approval. They affect only the two named tables in `outage_assistant_demo`; no schema changes or rights on `outage_assistant` are required. If the grants are not present, the transaction is rejected and rolls back without leaving a partial location or component.

Generate a 32-byte random password using Node.js:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

After editing the SQL placeholder, run the grants script as the MySQL administrator:

```powershell
& $env:ComSpec /c 'mysql --host=127.0.0.1 --user=YOUR_ADMIN_ACCOUNT --password outage_assistant_demo < backend\migrations\002_create_app_user.sql'
```

The script creates `'outage_assistant_app'@'localhost'`. If that account already exists, do not rerun the `CREATE USER` statement unchanged; have the administrator review the account and apply only the needed grants or rotate its password separately.

## 6. Configure backend and frontend environment

Create local environment files only if they do not already exist. **Do not overwrite an existing `backend/.env`; preserve its MySQL settings and add/update only the variables listed below.**

```powershell
if (!(Test-Path backend\.env)) { Copy-Item backend\.env.example backend\.env }
if (!(Test-Path frontend\.env)) { Copy-Item frontend\.env.example frontend\.env }
```

Generate a separate 32-byte `JWT_SECRET`:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Open the backend environment file for local editing:

```powershell
notepad backend\.env
```

Set these variables in `backend/.env`:

| Variable | Required? | Value / purpose |
|---|---|---|
| `PORT` | No | Express port; defaults to `3000`. |
| `DB_HOST` | Yes | MySQL host; local default is `localhost`. |
| `DB_PORT` | No | MySQL port; defaults to `3306`. |
| `DB_USER` | Yes | Set to `outage_assistant_app` after creating the account. |
| `DB_PASSWORD` | Yes | The generated MySQL application password. |
| `DB_NAME` | Yes | `outage_assistant_demo`. |
| `JWT_SECRET` | Required for authentication | Use the separate generated base64url value. The backend requires at least 32 bytes. Keep it private and stable for the demo; changing it invalidates issued tokens. |
| `CORS_ORIGINS` | No | Allowed frontend origins. The example includes localhost and 127.0.0.1 Vite/preview URLs. |

`JWT_SECRET` signs HS256 bearer tokens, which expire after eight hours. Generate it with a cryptographically secure random-number generator, not a human password, username, or checked-in default. Do not expose it in browser code, screenshots, logs, or source control. `.env` is ignored by Git; `.env.example` contains placeholders only.

The frontend's `VITE_API_BASE_URL` is optional and defaults to `http://localhost:3000/api`; set it in `frontend/.env` only if the backend address differs.

## 7. Run safe tests before the demonstration

Run the backend tests from the backend folder:

```powershell
Set-Location backend
npm test
```

The suite includes MySQL read checks and performs no registration, outage, or recovery writes. Ownership-dependent MySQL checks are skipped if the database is unavailable or migration 003 has not been applied.

Run frontend lint and production build in another PowerShell terminal:

```powershell
Set-Location frontend
npm run lint
npm run build
```

Expected: all backend tests pass, lint exits successfully, and Vite produces `frontend/dist`. A build by itself does not verify database write operations.

## 8. Start the app

In the first PowerShell terminal:

```powershell
Set-Location backend
npm start
```

Check `http://localhost:3000/api/health` and `http://localhost:3000/api/db-test`. The health response should report `"status":"ok"` and the database endpoint should confirm MySQL connectivity.

In a second PowerShell terminal:

```powershell
Set-Location frontend
npm run dev
```

Open the Vite URL (normally `http://localhost:5173`). Keep both terminals running during the demo.

## 9. Final end-to-end demonstration checklist

All writes below create persistent records. First take a backup and use a disposable copy of `outage_assistant` if the original sample records must remain pristine. The recovery status API also appends `recovery_status_audit` and `recovery_log` rows; restoring an action's prior status does not remove those history rows.

- [ ] **Registration:** open `/register`; submit a new name, email, password (8–128 characters), and optional department/contact. Confirm a successful response and signed-in UI. Verify the user row plus matching `auth_credential` row with the administrator's database client; do not inspect or display the password.
- [ ] **Login:** sign out, use `/login` with that email/password, confirm return to the dashboard. Try a wrong password and confirm a clear failure.
- [ ] **Outage creation:** use **Report outage** and either select an existing location/component or, after the database owner approves the two required table grants, enter a new location and component. Submit a cause and severity; optionally add an impact using an existing service ID. Confirm the outage appears in the outage list and that the related location summary refreshes from MySQL.
- [ ] **Outage status:** mark the newly created outage resolved. Confirm status changes to `RESOLVED`, `EndTime` is set, and dashboard/location figures refresh.
- [ ] **Recovery update:** select a recovery action, change its status, and save a remark. Confirm its status changes and the related status-audit and recovery-log entries appear. Use a disposable database copy or a specifically approved test action because those history records are permanent.
- [ ] **Recovery action creation:** after the administrator-approved demo-only `INSERT` grant, create a clearly named demo recommendation for an existing outage and confirm it appears under that outage with `PENDING` status. This creates a persistent demo record.
- [ ] **Regression check:** verify dashboard, outages, components, impacts, recovery, verification, reports, and locations still load. Check browser console and both server terminals for errors.
- [ ] **Ownership check:** register two accounts. Create an outage and recovery records as the first account; sign in as the second and confirm the first account's outage, location, impact, recovery, verification, dashboard, and report data are not returned, including by requesting the first account's record IDs directly.

## Verification boundaries

Migration and data-cleanup commands in this guide are manual; they have not been run automatically. Apply migration 003 before using owner-scoped operational APIs. Run the two-account check against a database copy or only after the database owner approves persistent test records. The original `outage_assistant` database must not be used.

# Internet Outage Response & Recovery Assistant

A DBMS mini project built with MySQL, Node.js/Express, and React. It organises network outage records, affected services and users, recovery activities, and service-verification history.

## Team

- **B S Sharath Chandra Reddy** — PES2UG24CS630
- **R Sai Pranav Reddy** — PES2UG24CS651
- **Section:** K
- **Course:** UE24CS351A – DBMS Project
- **Guide:** Dr. Shilpa S, Assistant Professor, PES University

## Features

- Dashboard with outage and impact summaries
- Outage listing, search, filters, and details
- Network component listing and details
- Impact analysis
- Recovery action management and recovery logs
- Service verification records
- Reports and CSV export
- Automatic refresh of the active frontend page every 30 seconds

## Technology stack

- **Database:** MySQL 8.0
- **Backend:** Node.js, Express, mysql2
- **Frontend:** React, Vite, Tailwind CSS, Axios, React Router, Recharts, Lucide

## Project structure

```text
internet-outage-assistant/
├── backend/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── routes/
│   ├── .env.example
│   └── server.js
└── frontend/
    ├── public/
    ├── src/
    │   ├── components/
    │   ├── hooks/
    │   ├── pages/
    │   ├── services/
    │   └── utils/
    └── .env.example
```

## Local setup

### 1. Clone the repository

```bash
git clone https://github.com/bsscr-35/internet-outage-assistant.git
cd internet-outage-assistant
```

### 2. Configure the backend

```bash
cd backend
npm install
```

Copy `.env.example` to `.env` and fill in the local MySQL connection settings. **Never commit `.env` or share database passwords.**

Create/import the `outage_assistant` MySQL database using the SQL scripts maintained by the project team. The web application's MySQL account should have only the permissions it needs; the current application setup is intended to use SELECT-only access.

Start the backend using the command defined in `backend/package.json` (typically `npm start`).

### 3. Configure and run the frontend

In a separate terminal:

```bash
cd frontend
npm install
```

Copy `frontend/.env.example` to `.env` and set the backend API base URL if required by the example configuration.

```bash
npm run dev
```

Open the local URL printed by Vite.

## Database overview

The `outage_assistant` schema includes entities for locations, network components, dependencies, maintenance, outages, services, users, outage impacts, user-service associations, recovery actions, recovery logs, service verification, and hints. It also includes the recovery status audit table and the `vw_ongoing_outages` view.

Database routines include `sp_outages_by_severity`, `sp_count_critical_outages`, and the `trg_recovery_status_audit` trigger. Refer to the SQL scripts and the DBMS report for the exact definitions and constraints.

## Security notes

- Keep backend and frontend `.env` files local; only `.env.example` files belong in Git.
- Do not publish database credentials, tokens, or private connection strings.
- The frontend application connects through a read-only MySQL account.
- If deploying beyond local development, restrict CORS to the required frontend origins and add suitable authentication and authorization.

## Documentation

- **DBMS report:** `Internet_Outage_Response_Recovery_Assistant_DBMS_Report.docx`
- **Presentation:** `Internet_Outage_Response_Recovery_Assistant_Presentation.pptx`

Add these documentation files to the repository if your course submission requires them to be version-controlled.

## Repository

https://github.com/bsscr-35/internet-outage-assistant

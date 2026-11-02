# Internet Outage Response & Recovery Assistant — Frontend

The frontend is a React dashboard built with Vite, Tailwind CSS, React Router, Axios, Recharts, and Lucide React.

## Run locally

```powershell
cd C:\Users\Sharath\Desktop\internet-outage-assistant\frontend
npm install
Copy-Item .env.example .env
npm run dev
```

Set `VITE_API_BASE_URL` in `.env` to the Express API base URL. The example uses `http://localhost:3000/api`. The backend must be running and allow browser requests from the Vite development server.

The dashboard loads statistics from `GET /api/dashboard/stats` and outage records from `GET /api/outages`.

The active dashboard module automatically refreshes its live data every 30 seconds. The header shows the last successful refresh time; manual refresh remains available.

# Frontend

The React/Vite application displays live outage, component, impact, recovery, verification, report, and location data served by the Express API. Account sign-in enables outage reporting, status updates, and recovery tracking.

## Run locally

```powershell
Set-Location C:\Users\Sharath\Desktop\internet-outage-assistant\frontend
npm ci
Copy-Item .env.example .env
npm run dev
```

Set `VITE_API_BASE_URL` in `.env` to the Express API base URL (the default is `http://localhost:3000/api`). The backend must be running and allow the Vite origin via its `CORS_ORIGINS` setting.

Run `npm run build` for a production build and `npm run lint` for static checks. The app fetches live data from MySQL-backed API routes; it does not substitute sample records when the API is unavailable.

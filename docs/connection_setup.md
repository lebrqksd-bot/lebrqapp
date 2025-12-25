# Frontend–Backend Connection Setup

This guide shows how to run the FastAPI backend and the Expo (React Native + Web) frontend so they communicate correctly via environment variables.

## 1. Backend: Start FastAPI

Use the provided VS Code task (recommended) or run manually.

### Using Task (Hot Reload + SQLite)
In VS Code: Run task `Run API (SQLite, 8000, reload)`.
This sets `DB_URL` and launches uvicorn on port 8000.

### Manual (PowerShell)
```powershell
$env:DB_URL="sqlite+aiosqlite:///./lebrq.db"
cd backend
..\.venv\Scripts\python.exe -m uvicorn app.core:app --reload --host 0.0.0.0 --port 8000
```

### Health Check
Open:https://taxtower.in:8002/api
/health (or similar ping endpoint if defined) – expect JSON OK. If 404, test another simple endpoint like `/api/venues/spaces`.

## 2. Frontend: Start Expo With API URL

Use the task `Run Expo (web) with API env` (or tunnel / native variants). This sets:
```
EXPO_PUBLIC_API_URL=https://taxtower.in:8002/api

```
so inside the app the exported `CONFIG.API_BASE_URL` resolves correctly.

Manual start (PowerShell):
```powershell
$env:EXPO_PUBLIC_API_URL="https://taxtower.in:8002/api"
npm run start -- --web
```
Or with tunnel:
```powershell
$env:EXPO_PUBLIC_API_URL="https://taxtower.in:8002/api"
npx expo start --tunnel
```

## 3. Configuration Source of Truth
`constants/config.ts` builds `API_BASE_URL` from `process.env.EXPO_PUBLIC_API_URL`. Avoid hardcoding base URLs in components.

## 4. Verifying Communication
1. Open the web app (Expo URL shown after start).
2. Login or trigger a fetch that hits the backend.
3. Inspect Network tab – requests should go to `https://taxtower.in:8002/api
/...`.

## 5. Switching to MySQL
Start backend with task `Run API (MySQL, 8000, reload)` or manually:
```powershell
$env:DB_URL="mysql+asyncmy://root:root@127.0.0.1:3306/lebrq"
cd backend
..\.venv\Scripts\python.exe -m uvicorn app.core:app --reload --host 0.0.0.0 --port 8000
```
Run migrations if schema changed (Alembic):
```powershell
cd backend
..\.venv\Scripts\alembic upgrade head
```

## 6. Common Pitfalls
| Issue | Cause | Fix |
|-------|-------|-----|
| 404 on API calls | Missing `/api` prefix | Ensure `EXPO_PUBLIC_API_URL` ends with `/api` and config trims trailing slash only. |
| CORS error in browser | Backend not configured for origin | Add appropriate middleware or match origin from Expo dev server. |
| ECONNREFUSED | Backend not started or port mismatch | Confirm uvicorn running on 8000; restart tasks. |
| Wrong base URL in production build | Missing env variable | Set `EXPO_PUBLIC_API_URL` during build (EAS / CI) before bundling. |

## 7. Quick Smoke Test Script
Create `test_api.ps1` (already present) or run:
```powershell
Invoke-RestMethod -Method GEThttps://taxtower.in:8002/api
/venues/spaces | ConvertTo-Json -Depth 3
```
Should return an array of spaces.

## 8. Next Steps
- Implement API helper wrapper (`lib/api.ts`).
- Add auth token management.
- Build booking create + reschedule example.

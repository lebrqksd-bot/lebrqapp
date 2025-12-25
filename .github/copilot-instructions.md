<!-- Copilot instructions for contributors and AI coding agents -->
# Copilot / AI Agent Instructions — LeBRQ App

Concise, repo-specific guidance to help an AI agent be productive immediately.

## Big Picture
- **Backend:** FastAPI in [backend/app](backend/app) with app created in [backend/app/core.py](backend/app/core.py). Pydantic v2 `Settings` drives config; API prefix from `settings.API_PREFIX` (default `/api`).
- **Frontend:** Expo/React Native under [app/](app). Router entry via `expo-router/entry` in [package.json](package.json). Central API URL resolution in [constants/config.ts](constants/config.ts).
- **Data:** SQLAlchemy Async engine in [backend/app/db.py](backend/app/db.py) for MySQL (`asyncmy`) with SQLite override via `DB_URL` for local dev.

## Run & Develop
- **Backend tasks:** Use VSCode tasks in the workspace folder:
  - [Run API (SQLite, 8000)](c:\Users\HP\Desktop\LebrqApp#tasks) sets `DB_URL=sqlite+aiosqlite:///./lebrq.db` and starts Uvicorn at 8000.
  - [Run API (MySQL, 8000, reload)](c:\Users\HP\Desktop\LebrqApp#tasks) sets `DB_URL=mysql+asyncmy://...` and reloads.
- **Manual backend start (PowerShell):**
  - Create venv and install:
    - `py -3.11 -m venv .venv`
    - `.venv\Scripts\Activate.ps1`
    - `python -m pip install --upgrade pip`
    - `pip install -e .`
  - Start: `python -m uvicorn app.core:app --reload --host 0.0.0.0 --port 8000` (run from `backend/`).
- **Frontend:** `npm start` or `expo start`. For web exports, ensure `EXPO_PUBLIC_API_URL` points to production.

## Configuration Patterns
- **Single-source API base:** Resolved in [constants/config.ts](constants/config.ts) via `EXPO_PUBLIC_API_URL` with platform-aware fallbacks. Avoid `localhost`/`127.0.0.1` for production domains; HTTPS preferred.
- **Settings over globals:** Define config in `Settings` (see [backend/app/core.py](backend/app/core.py)); read env via pydantic settings model. Update settings rather than ad-hoc `os.environ` reads.
- **DB sessions:** Use `get_session()` dependency from [backend/app/db.py](backend/app/db.py); no per-request engine creation. Prefer async `AsyncSessionLocal`; a `sync_engine` exists for limited routers (e.g., payments).

## Architecture & Routing
- **Routers:** Organized under [backend/app/routers](backend/app/routers) and included in [backend/app/core.py](backend/app/core.py) with `app.include_router(..., prefix=settings.API_PREFIX)`.
- **Static files (dev-only):** `/static/{file_path}` in [backend/app/core.py](backend/app/core.py) supports Range + ETag. In production, serve via Nginx; do not rely on this route.
- **App state:** Shared `ThreadPoolExecutor` and background workers live in `app.state` initialized during startup; avoid heavy in-memory tasks at launch.

## Error Handling & Responses
- Consistent error shape `{ success, message, error_id }`. See `register_error_handlers` usage in [backend/app/core.py](backend/app/core.py) and follow that pattern for new endpoints.

## Integrations & Env
- External services via env: Twilio, SMTP, RouteMobile (WhatsApp), Google Places. Keys defined in `Settings` ([backend/app/core.py](backend/app/core.py)); see `backend/.env.example`.
- DB tuning in [backend/app/db.py](backend/app/db.py): `DB_POOL_SIZE`, `DB_MAX_OVERFLOW`, timeouts. Update via env when changing pool behavior.

## Safety & Migrations
- Do not run `Base.metadata.create_all()` in production; [backend/app/db.py](backend/app/db.py) skips table creation when `ENVIRONMENT=production`. Prefer migrations (no Alembic scaffold present).
- Startup schedulers should be delayed/threaded and reuse `app.state.thread_pool` to respect memory protections.

## Practical Examples
- **Admin seed at startup:** See bootstrap code in [backend/app/core.py](backend/app/core.py) using `AsyncSessionLocal`. Respect bcrypt 72-byte limit.
- **Local dev DB:** Use VSCode task “Run API (SQLite, 8000)” or set `DB_URL=sqlite+aiosqlite:///./lebrq.db` while developing without MySQL.
- **Expo LAN IP substitution:** [constants/config.ts](constants/config.ts) substitutes `localhost` with Expo LAN IP for native when `EXPO_PUBLIC_API_URL` points to localhost.

If any section is unclear or missing (e.g., typical PR checklist or router scaffolding examples), tell me which part to expand and I will iterate.

If anything in this document is unclear or you want additional examples (e.g., typical PR checklist, where to add tests, or how to scaffold a new router), tell me which section to expand and I will iterate.

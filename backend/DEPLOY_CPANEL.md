# Deploying Lebrq Backend on cPanel (Python 3.9.21)

This guide helps you run the FastAPI backend on a cPanel host that supports Python 3.9.21 and Passenger.

## 1) Environment variables (no more hardcoding)
Set these in cPanel > Advanced > Set Environment Variables (or upload a `.env` file in `backend/`, based on `.env.example`):

- MYSQL_HOST
- MYSQL_PORT (e.g., 3306)
- MYSQL_USER
- MYSQL_PASSWORD
- MYSQL_DB
- SECRET_KEY (random long string)

Optional integrations: TWILIO_*, SMTP_*, ROUTEMOBILE_*

All maintenance scripts now read DB config from env via `backend/scripts_db.py`. No script edits required for deployment.

## 2) Create the Python app (Passenger)
- App type: Python
- Python version: 3.9.x (3.9.21)
- Application root: path to `backend/`
- Startup file: `passenger_wsgi.py` (already added in backend/)
- Application entry point: `application`

Then open the created virtualenv terminal in cPanel and install dependencies:

pip install -r requirements.txt

If you prefer pinned versions for Python 3.9, use:

pip install -r requirements-py39.txt

Note: If wheels are missing for your platform, you may need to pin versions or install build tools. All current `requirements.txt` entries support Python 3.9.

## 3) ASGI entry (FastAPI)
Passenger is WSGI-first. For ASGI (FastAPI), use an adapter. The simplest pattern is to run Uvicorn inside `passenger_wsgi.py` using the `asyncio` loop.

The repo already includes `backend/passenger_wsgi.py`, which bridges ASGI (FastAPI) to WSGI via Mangum.

Alternative: If your cPanel allows a custom start command (Procfile), you can instead run:

uvicorn app.core:app --host 0.0.0.0 --port $PORT --workers 1

## 4) Static files
The backend serves uploads at `/static` from `backend/app/uploads/`.

- Ensure this folder exists (it’s in the repo) and is writable by the application user on cPanel.
- If you get 403/500 on uploads, fix directory permissions from the file manager or shell.

## 5) Running one-off DB scripts on the server
All scripts now read DB settings from ENV via `scripts_db.py`. Examples:

- python add_event_type_final.py
- python add_admin_booking_column.py
- python create_payment_tables_simple.py

No code edits required—just ensure env vars are set in the shell/session (cPanel terminal inherits them from the app config).

## 6) Python 3.9 compatibility
- We replaced Python 3.10+ type unions with `typing.Optional` in runtime-sensitive parts (routers/schemas/core).
- SQLAlchemy models and other hints already use `from __future__ import annotations`, so they parse on 3.9.

If you hit a typing-related error on 3.9, let us know the exact file/line and we’ll convert remaining `X | None` to `Optional[X]` in that spot.

## 8) Local smoke test (PowerShell, optional)
```
# Create and activate venv
py -3.9 -m venv .venv; .\.venv\Scripts\Activate.ps1

# Install pinned deps
pip install --upgrade pip
pip install -r backend\requirements-py39.txt

# Run the API (no reload)
cd backend
python -c "import app.core as c; import uvicorn; uvicorn.run(c.app, host='127.0.0.1', port=8000, log_level='info')"
```

## 7) Troubleshooting
- If imports like `fastapi` or `sqlalchemy` can’t be found, verify you installed requirements into the cPanel-created virtualenv (not global python).
- For MySQL connection issues, verify host/port/firewall and credentials. You can smoke-test with:

```
python check_db_schema.py
```

- Logs: use cPanel’s application log viewer. Uvicorn logs will appear there when using the `Mangum` shim or a Procfile runner.

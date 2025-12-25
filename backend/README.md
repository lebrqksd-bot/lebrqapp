Lebrq Backend (FastAPI)

Quick start (Windows PowerShell):

- Install Python 3.11+
- Create venv and install deps
  - py -3.11 -m venv .venv
  - .venv\Scripts\Activate.ps1
  - python -m pip install --upgrade pip
  - pip install -e .
- Create .env (copy from .env.example) and set MySQL credentials
- Run database (MySQL) and ensure DB exists
- Start API server
  - python -m uvicorn app.core:run --factory --reload --port 8000

Key endpoints (prefix /api):

- GET /health -> { status: "ok" }
- POST /auth/login -> { access_token } (username/password)
- GET /auth/me -> user info (requires Authorization: Bearer <token>)
- CRUD /programs with filters: q, status, sort, limit, offset
- POST /programs/{id}/approve (role admin/approver)
- POST /programs/{id}/reject (role admin/approver)
- POST /uploads/poster (multipart) -> { url } then GET via /static/<name>

Notes:

- Default admin is seeded on startup if ADMIN_USERNAME/ADMIN_PASSWORD set in .env
- Uploaded files are saved to app/uploads and available at /static
- For Windows, uvloop is skipped automatically

from asgiref.wsgi import AsgiToWsgi

# Import the ASGI app from FastAPI
from app.core import app as asgi_app

# Expose a WSGI-compatible application for Passenger (cPanel Python App)
application = AsgiToWsgi(asgi_app)
"""
Passenger WSGI entrypoint for FastAPI (ASGI) via Mangum bridge.

- cPanel: set Startup File to `passenger_wsgi.py` and Entry Point to `application`.
- Requires: pip install -r requirements.txt (includes mangum).
"""
import os
import sys

# Ensure backend path is importable
BASE_DIR = os.path.dirname(__file__)
sys.path.insert(0, BASE_DIR)

# Optionally load .env
try:
    from dotenv import load_dotenv  # type: ignore
    load_dotenv()
except Exception:
    pass

# Import FastAPI app
from app.core import app as asgi_app  # noqa: E402

# Bridge ASGI -> WSGI for Passenger
from mangum import Mangum  # noqa: E402

# Passenger looks for a callable named `application`
application = Mangum(asgi_app)

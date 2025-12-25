"""
Client-side configuration for backend utility scripts that need to call the API.

Usage:
    from app.config_client import API_BASE_URL

Configure via environment variable in backend/.env:
    API_BASE_URL=https://taxtower.in/api


Defaults to local API for development.
"""
from pydantic_settings import BaseSettings


class ClientSettings(BaseSettings):
    # Default to external live server; override via backend/.env if needed
    # Example for production: API_BASE_URL = "https://taxtower.in:8002/api"
    API_BASE_URL: str = "https://taxtower.in:8002/api"

    class Config:
        env_file = ".env"


_settings = ClientSettings()

# Normalized base (no trailing slash)
API_BASE_URL: str = _settings.API_BASE_URL.rstrip("/")

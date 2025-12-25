"""
Production-Ready Environment Configuration for Lebrq Backend

Loads configuration from:
1. .env file (local development only - not required in production)
2. Environment variables (Cloud Run, Docker, etc.)
3. Defaults (fallback values)

Pattern:
- Local dev: Use .env (git-ignored)
- Production: Env variables only (no .env)
- Cloud Run: PORT and DATABASE_URL via Cloud Run settings

Security:
- No hardcoded secrets
- Secrets validated at startup
- `.env` file git-ignored
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional, List
from urllib.parse import urlparse
import logging

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    """
    Application configuration using pydantic-settings.
    
    .env file is optional (ignored in production).
    All values can be overridden via environment variables.
    """
    
    # ─── Environment & Deployment ───────────────────────────────────────────
    ENVIRONMENT: str = "development"  # "development", "staging", "production"
    DEBUG: bool = False
    
    # ─── Server Configuration ───────────────────────────────────────────────
    APP_NAME: str = "Lebrq API"
    API_PREFIX: str = "/api"
    
    # PORT is set by Cloud Run (default 8000 for local dev)
    # Read from PORT env var; defaults to 8000 if not set
    PORT: int = 8000
    
    # ─── Database Configuration ─────────────────────────────────────────────
    # For local dev: Use DB_URL env var (e.g., sqlite+aiosqlite:///./lebrq.db)
    # For production: Set DATABASE_URL env var (Supabase PostgreSQL)
    
    DATABASE_URL: Optional[str] = None
    
    # PostgreSQL/Supabase defaults (used if DATABASE_URL not set)
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "lebrq"
    
    # SQLite override for local development (set via DB_URL env var)
    # Example: DB_URL="sqlite+aiosqlite:///./lebrq.db"
    DB_URL: Optional[str] = None
    
    # Connection pool configuration (fine-tune for your infrastructure)
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 5
    DB_POOL_TIMEOUT: int = 30
    DB_POOL_RECYCLE: int = 280
    
    # Supabase transaction pooler: disable prepared statements
    # PgBouncer (Supabase transaction pooler) doesn't support prepared statements
    # Set to True if using transaction pooler mode
    DB_DISABLE_PREPARED_STATEMENTS: bool = False
    
    # ─── Security & JWT ─────────────────────────────────────────────────────
    # CRITICAL: Change this in production! Use a long, random value.
    # Generate with: python -c "import secrets; print(secrets.token_urlsafe(32))"
    SECRET_KEY: str = "change-me-in-production"
    
    # JWT token expiration
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 12  # 12 hours
    
    # ─── CORS Configuration ─────────────────────────────────────────────────
    # List of allowed origins (frontend domains)
    # Environment variable: CORS_ORIGINS (comma-separated list)
    # In production, remove "*" and be explicit about allowed origins
    CORS_ORIGINS: List[str] = [
        "http://localhost:19006",
        "http://localhost:3000",
        "http://127.0.0.1:19006",
        "https://lebrqapp.netlify.app",  # Netlify frontend
    ]
    CORS_ALLOW_CREDENTIALS: bool = False
    
    # ─── Frontend URL (for redirects, CTAs in emails/notifications) ─────────
    FRONTEND_URL: str = "http://localhost:19006"
    
    # ─── Admin Credentials (for initial setup) ──────────────────────────────
    # NOTE: Only used if no admin exists in DB
    ADMIN_USERNAME: Optional[str] = "admin"
    ADMIN_PASSWORD: Optional[str] = "change-me-in-production"
    
    # ─── Third-Party Service Integration ────────────────────────────────────
    
    # Google Places API
    GOOGLE_PLACES_API_KEY: Optional[str] = None
    LOCATION_PROVIDER: str = "nominatim"  # "google" or "nominatim"
    USE_MOCK_LOCATION_DATA: bool = False
    COMPANY_ADDRESS: str = "Second Floor, City Complex, NH Road, Karandakkad, Kasaragod, Kerala, India"
    
    # Twilio (SMS/WhatsApp)
    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWILIO_PHONE_NUMBER: Optional[str] = None
    TWILIO_WHATSAPP_NUMBER: Optional[str] = None
    
    # SMTP (Email)
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USE_TLS: bool = True
    SMTP_USERNAME: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM_EMAIL: str = "no-reply@lebrq.local"
    
    # Route Mobile WhatsApp Business API
    ROUTEMOBILE_BASE_URL: Optional[str] = None
    ROUTEMOBILE_CLIENT_ID: Optional[str] = None
    ROUTEMOBILE_CLIENT_SECRET: Optional[str] = None
    ROUTEMOBILE_SENDER: Optional[str] = None
    ROUTEMOBILE_AUTH_MODE: str = "oauth"
    ROUTEMOBILE_USERNAME: Optional[str] = None
    ROUTEMOBILE_PASSWORD: Optional[str] = None
    ROUTEMOBILE_LOGIN_PATH: str = "/oauth/token"
    ROUTEMOBILE_MESSAGES_PATH: str = "/v1/messages"
    ROUTEMOBILE_AUTH_HEADER_BEARER: bool = True
    ROUTEMOBILE_TEMPLATE_LANGUAGE: str = "en_GB"
    ROUTEMOBILE_TEMPLATE_BOOKINGREG: str = "bookingreg"
    ROUTEMOBILE_TEMPLATE_BOOKING_TEMP: str = "booking_temp"
    ROUTEMOBILE_TEMPLATE_SIMPLE: str = "hello"
    ROUTEMOBILE_TEMPLATE_REG: str = "lebrq_temp_reg"
    ROUTEMOBILE_TEMPLATE_LIVE_SHOW: str = "live_show_booking"
    ROUTEMOBILE_TEMPLATE_greeting_menus: str = "greeting_menus"
    ROUTEMOBILE_TEMPLATE_greeting_menus_header_image: str = "https://scontent.whatsapp.net/v/t61.29466-34/544616452_32808603278785350_6813887059691794418_n.png?ccb=1-7&_nc_sid=8b1bef&_nc_ohc=HfAcRUcq4y0Q7kNvwExaGxe&_nc_oc=Adl7gtnu7uz7GbZynriGOWMyJip4MDjFYPoH4ItK2gQ2vP-vrocjxyeA-r_V8tEoeHU&_nc_zt=3&_nc_ht=scontent.whatsapp.net&edm=AH51TzQEAAAA&_nc_gid=AdfjgcD73YYL6eJqCohU1Q&_nc_tpa=Q5bMBQEi1Bxgk2iI13Wc7CDCYnO9jogKUuPYmC6l_k8gWIX0W9p5rJRcZiv7_onKk6JMHFXWjChgMpxR0g&oh=01_Q5Aa3QFm-iNHIZP1AS7ZG5ds5YkcBicAte_B1bt4vyWtCpsSUw&oe=696297F1"
    
    # App/Web URL used for CTAs in notifications
    WEB_APP_URL: str = "http://localhost:19006/"
    
    # ─── Timezone ───────────────────────────────────────────────────────────
    LOCAL_TIMEZONE: str = "Asia/Kolkata"
    
    # ─── Pydantic Configuration ─────────────────────────────────────────────
    model_config = SettingsConfigDict(
        env_file=".env",          # Load from .env (optional, ignored if not present)
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",           # Ignore unknown environment variables
    )
    
    # ─── Computed Properties ────────────────────────────────────────────────
    
    @property
    def computed_database_url(self) -> str:
        """
        Resolve final DATABASE_URL using priority:
        1. DATABASE_URL env var (explicit override)
        2. DB_URL env var (local SQLite override)
        3. Constructed PostgreSQL URL
        """
        # Priority 1: Explicit DATABASE_URL env var (Cloud Run, production)
        if self.DATABASE_URL:
            return self.DATABASE_URL
        
        # Priority 2: DB_URL for local SQLite override
        if self.DB_URL:
            return self.DB_URL
        
        # Priority 3: Construct PostgreSQL URL from components
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@"
            f"{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )
    
    @property
    def is_production(self) -> bool:
        """Check if running in production."""
        return self.ENVIRONMENT.lower() in ("production", "prod")
    
    @property
    def is_supabase(self) -> bool:
        """Check if using Supabase (PostgreSQL on asyncpg)."""
        url = self.computed_database_url.lower()
        return "postgresql+asyncpg://" in url or "supabase" in url
    
    def get_db_connect_args(self) -> dict:
        """Get SQLAlchemy connect_args for async engine based on DB type."""
        url = self.computed_database_url
        
        if url.startswith("postgresql+asyncpg://"):
            connect_args = {
                'server_settings': {
                    'application_name': self.APP_NAME,
                }
            }
            
            # Disable prepared statements for Supabase transaction pooler (PgBouncer)
            if self.DB_DISABLE_PREPARED_STATEMENTS:
                # PgBouncer doesn't support prepared statements by default
                connect_args['prepared_statement_cache_size'] = 0
            
            return connect_args
        
        # SQLite or MySQL
        return {}
    
    def validate_production_secrets(self) -> None:
        """Validate that production secrets are properly configured."""
        if not self.is_production:
            return
        
        errors = []
        
        # Check DATABASE_URL is set (not default)
        if not self.DATABASE_URL or "localhost" in self.DATABASE_URL.lower():
            errors.append("DATABASE_URL must be set to production database (not localhost)")
        
        # Check SECRET_KEY is changed from default
        if self.SECRET_KEY == "change-me-in-production":
            errors.append("SECRET_KEY must be changed from default value")
        
        # Warn about admin credentials
        if self.ADMIN_PASSWORD == "change-me-in-production":
            logger.warning("⚠️  ADMIN_PASSWORD is set to default value - change in production!")
        
        if errors:
            raise ValueError(f"Production security validation failed:\n" + "\n".join(errors))


# Instantiate global settings object
settings = Settings()

# Validate production configuration at startup
if settings.is_production:
    try:
        settings.validate_production_secrets()
        logger.info("✓ Production configuration validated")
    except ValueError as e:
        logger.error(f"Configuration validation failed: {e}")
        raise

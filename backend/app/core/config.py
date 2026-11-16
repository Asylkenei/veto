"""Runtime configuration. Every value can be overridden through environment variables."""
from pathlib import Path
import os

APP_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = APP_DIR.parent
PROJECT_DIR = APP_DIR.parents[1]
FRONTEND_DIST = Path(os.getenv("FRONTEND_DIST", PROJECT_DIR / "frontend" / "dist"))
DATA_DIR = Path(os.getenv("DATA_DIR", BACKEND_DIR / "data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)
# PostgreSQL only. The default matches docker-compose.local.yml, so a local
# `docker compose -f docker-compose.local.yml up -d postgres` is enough to run uvicorn.
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg://veto:veto-local-password@localhost:5433/veto")
API_PREFIX = "/api"
APP_VERSION = os.getenv("APP_VERSION", "2.0.0")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

# Sessions
SESSION_COOKIE = "veto_session"
SESSION_TTL_DAYS = int(os.getenv("SESSION_TTL_DAYS", "30"))
SHORT_SESSION_HOURS = int(os.getenv("SHORT_SESSION_HOURS", "12"))
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "auto")  # auto | true | false

# Background jobs
SCHEDULER_INTERVAL_SECONDS = int(os.getenv("SCHEDULER_INTERVAL_SECONDS", "30"))
DEADLINE_REMINDER_MINUTES = int(os.getenv("DEADLINE_REMINDER_MINUTES", "60"))

# Web Push (keys are generated into DATA_DIR on first start when not provided)
VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY", "")
VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY", "")
VAPID_SUBJECT = os.getenv("VAPID_SUBJECT", "mailto:support@veto.app")

# Optional SMTP for password recovery and support replies
SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", "VETO <no-reply@veto.app>")
PUBLIC_URL = os.getenv("PUBLIC_URL", "")
SUPPORT_EMAIL = os.getenv("SUPPORT_EMAIL", "support@veto.app")

# Photos: Wikimedia needs no key; Unsplash / Pexels keys improve photos for generic ideas.
PHOTO_DIR = DATA_DIR / "photos"
PHOTO_DIR.mkdir(parents=True, exist_ok=True)
UNSPLASH_ACCESS_KEY = os.getenv("UNSPLASH_ACCESS_KEY", "")
PEXELS_API_KEY = os.getenv("PEXELS_API_KEY", "")
PHOTOS_ENABLED = os.getenv("PHOTOS_ENABLED", "true").lower() == "true"

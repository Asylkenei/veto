from fastapi import APIRouter
from sqlalchemy import text
from app.core import config
from app.db.session import engine
from app.services import auth_service, notification_service

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return {"status": "ok", "database": "connected", "version": config.APP_VERSION}


@router.get("/meta")
def meta():
    return {
        "version": config.APP_VERSION,
        "environment": config.ENVIRONMENT,
        "features": {
            "push": bool(notification_service.vapid_keys()),
            "password_recovery": auth_service.recovery_available(),
            "live_updates": True,
        },
        "support_email": config.SUPPORT_EMAIL,
    }

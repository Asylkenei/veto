from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from app.api.deps import CurrentUser, DbSession
from app.core.errors import AppError
from app.services import live, notification_service

router = APIRouter(tags=["notifications"])


class ReadIn(BaseModel):
    ids: list[str] | None = None


class SubscriptionKeys(BaseModel):
    p256dh: str = Field(max_length=255)
    auth: str = Field(max_length=255)


class SubscriptionIn(BaseModel):
    endpoint: str = Field(max_length=1000)
    keys: SubscriptionKeys


class UnsubscribeIn(BaseModel):
    endpoint: str | None = None


@router.get("/notifications")
def list_notifications(db: DbSession, user: CurrentUser):
    return notification_service.list_for(db, user)


@router.post("/notifications/read")
def mark_read(data: ReadIn, db: DbSession, user: CurrentUser):
    notification_service.mark_read(db, user, data.ids)
    return {"unread": notification_service.unread_count(db, user.id)}


@router.get("/stream", summary="Live user updates (SSE): unread count and room changes")
def user_stream(request: Request, user: CurrentUser):
    return StreamingResponse(
        live.user_stream(request, user.id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/push/key")
def push_key():
    keys = notification_service.vapid_keys()
    return {"available": bool(keys), "public_key": keys["public"] if keys else None}


@router.post("/push/subscribe", status_code=201)
def subscribe(data: SubscriptionIn, db: DbSession, user: CurrentUser):
    if not notification_service.vapid_keys():
        raise AppError(503, "Push-уведомления недоступны на этом сервере")
    notification_service.subscribe(db, user, data.endpoint, data.keys.p256dh, data.keys.auth)
    return {"ok": True}


@router.post("/push/unsubscribe")
def unsubscribe(data: UnsubscribeIn, db: DbSession, user: CurrentUser):
    notification_service.unsubscribe(db, user, data.endpoint)
    return {"ok": True}

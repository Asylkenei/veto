"""In-app notification centre + Web Push.

Notifications are written only on meaningful state changes (see EVENT_CATEGORY).
Web Push delivery runs in a background thread so it never slows down a request;
expired subscriptions (404/410 from the push service) are deleted.
"""
import base64
import json
import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from uuid import uuid4
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session
from app.core import config
from app.core.metrics import DOMAIN_EVENTS, PUSH_SENT
from app.db.session import SessionLocal
from app.models import Notification, PushSubscription, User
from app.services.auth_service import prefs

log = logging.getLogger("veto.notify")
_pool = ThreadPoolExecutor(max_workers=2, thread_name_prefix="push")

EVENT_CATEGORY = {
    "invited": "invites",
    "participant_joined": "activity",
    "voting_started": "voting",
    "deadline_soon": "voting",
    "result_ready": "results",
    "voting_closed": "results",
    "tiebreak": "results",
    "new_round": "voting",
}

# ---- VAPID keys -------------------------------------------------------------
_vapid: dict | None = None


def vapid_keys() -> dict | None:
    """Return {'private': pem_path, 'public': b64url} or None when push is unavailable."""
    global _vapid
    if _vapid is not None:
        return _vapid or None
    try:
        from cryptography.hazmat.primitives import serialization
        from py_vapid import Vapid

        if config.VAPID_PRIVATE_KEY and config.VAPID_PUBLIC_KEY:
            _vapid = {"private": config.VAPID_PRIVATE_KEY, "public": config.VAPID_PUBLIC_KEY}
            return _vapid
        pem = config.DATA_DIR / "vapid_private.pem"
        vapid = Vapid.from_file(str(pem)) if pem.exists() else Vapid()
        if not pem.exists():
            vapid.generate_keys()
            vapid.save_key(str(pem))
        raw = vapid.public_key.public_bytes(
            serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint
        )
        _vapid = {"private": str(pem), "public": base64.urlsafe_b64encode(raw).decode().rstrip("=")}
    except Exception:  # pragma: no cover - environment without crypto backend
        log.exception("web push disabled: cannot load VAPID keys")
        _vapid = {}
    return _vapid or None


def _send_push(user_id: str, payload: dict) -> None:
    keys = vapid_keys()
    if not keys:
        return
    try:
        from pywebpush import WebPushException, webpush
    except ImportError:  # pragma: no cover
        return
    with SessionLocal() as db:
        subs = list(db.scalars(select(PushSubscription).where(PushSubscription.user_id == user_id)))
        for sub in subs:
            try:
                webpush(
                    subscription_info={"endpoint": sub.endpoint, "keys": {"p256dh": sub.p256dh, "auth": sub.auth}},
                    data=json.dumps(payload, ensure_ascii=False),
                    vapid_private_key=keys["private"],
                    vapid_claims={"sub": config.VAPID_SUBJECT},
                    timeout=8,
                )
                PUSH_SENT.labels("ok").inc()
            except WebPushException as exc:
                status = getattr(exc.response, "status_code", None)
                if status in (404, 410):
                    db.delete(sub)
                    PUSH_SENT.labels("expired").inc()
                else:
                    PUSH_SENT.labels("error").inc()
                    log.warning("push failed", extra={"event": "push_failed", "user_id": user_id})
            except Exception:
                PUSH_SENT.labels("error").inc()
                log.exception("push failed")
        db.commit()


# ---- Public API -------------------------------------------------------------

def notify(
    db: Session,
    user_ids: list[str],
    event: str,
    title: str,
    body: str = "",
    room_id: str | None = None,
    link: str = "",
    exclude: str | None = None,
) -> None:
    """Queue notifications in the caller's transaction; push is sent after commit by `flush_push`."""
    category = EVENT_CATEGORY.get(event, "activity")
    targets = [uid for uid in dict.fromkeys(user_ids) if uid and uid != exclude]
    if not targets:
        return
    users = {u.id: u for u in db.scalars(select(User).where(User.id.in_(targets)))}
    pending = db.info.setdefault("pending_push", [])
    for uid in targets:
        user = users.get(uid)
        if not user or user.deleted_at:
            continue
        user_prefs = prefs(user)
        if not user_prefs.get(category, True):
            continue
        db.add(Notification(id=str(uuid4()), user_id=uid, type=event, title=title, body=body, room_id=room_id, link=link))
        if user_prefs.get("push"):
            pending.append((uid, {"title": title, "body": body, "url": link or "/notifications"}))
    DOMAIN_EVENTS.labels(f"notify_{event}").inc()


def flush_push(db: Session) -> None:
    for uid, payload in db.info.pop("pending_push", []):
        _pool.submit(_send_push, uid, payload)


def list_for(db: Session, user: User, limit: int = 50) -> dict:
    items = list(
        db.scalars(
            select(Notification)
            .where(Notification.user_id == user.id)
            .order_by(Notification.created_at.desc())
            .limit(limit)
        )
    )
    return {
        "unread": unread_count(db, user.id),
        "items": [
            {
                "id": n.id,
                "type": n.type,
                "title": n.title,
                "body": n.body,
                "room_id": n.room_id,
                "link": n.link,
                "created_at": n.created_at,
                "read": n.read_at is not None,
            }
            for n in items
        ],
    }


def unread_count(db: Session, user_id: str) -> int:
    return db.scalar(
        select(func.count()).select_from(Notification).where(
            Notification.user_id == user_id, Notification.read_at.is_(None)
        )
    ) or 0


def mark_read(db: Session, user: User, ids: list[str] | None) -> int:
    query = update(Notification).where(Notification.user_id == user.id, Notification.read_at.is_(None))
    if ids:
        query = query.where(Notification.id.in_(ids))
    result = db.execute(query.values(read_at=datetime.now(timezone.utc)))
    db.commit()
    return result.rowcount or 0


def subscribe(db: Session, user: User, endpoint: str, p256dh: str, auth: str) -> None:
    existing = db.scalar(select(PushSubscription).where(PushSubscription.endpoint == endpoint))
    if existing:
        existing.user_id, existing.p256dh, existing.auth = user.id, p256dh, auth
    else:
        db.add(PushSubscription(id=str(uuid4()), user_id=user.id, endpoint=endpoint, p256dh=p256dh, auth=auth))
    current = prefs(user)
    current["push"] = True
    user.notification_prefs_json = json.dumps(current)
    db.commit()


def unsubscribe(db: Session, user: User, endpoint: str | None) -> None:
    query = select(PushSubscription).where(PushSubscription.user_id == user.id)
    if endpoint:
        query = query.where(PushSubscription.endpoint == endpoint)
    for sub in db.scalars(query):
        db.delete(sub)
    current = prefs(user)
    current["push"] = False
    user.notification_prefs_json = json.dumps(current)
    db.commit()

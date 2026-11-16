"""Accounts and sessions.

* Registered users: email + password (PBKDF2), opaque session token in an
  HttpOnly cookie (also accepted as `Authorization: Bearer` for API clients).
* Guests: the case requires joining a decision "by link, giving your name".
  A guest gets a real server session too and can later upgrade the same
  account by adding email + password in Settings — rooms and votes are kept.
"""
import json
import logging
import smtplib
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from uuid import uuid4
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session
from app.core import config
from app.core.errors import AppError
from app.core.metrics import DOMAIN_EVENTS
from app.core.security import (
    hash_password,
    new_token,
    password_problems,
    token_hash,
    verify_password,
)
from app.models import AuthSession, PasswordResetToken, User

log = logging.getLogger("veto.auth")
AVATAR_COLORS = {"sand", "sage", "sky", "rose", "lilac", "amber", "slate"}
THEMES = {"system", "light", "dark"}
DEFAULT_PREFS = {
    "push": False,
    "invites": True,
    "voting": True,
    "results": True,
    "activity": True,
    "digest": "instant",
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def normalize_email(email: str) -> str:
    return email.strip().lower()


def prefs(user: User) -> dict:
    try:
        stored = json.loads(user.notification_prefs_json or "{}")
    except ValueError:
        stored = {}
    return {**DEFAULT_PREFS, **stored}


def serialize_user(user: User) -> dict:
    return {
        "id": user.id,
        "display_name": user.display_name,
        "email": user.email,
        "is_guest": user.is_guest,
        "avatar_color": user.avatar_color,
        "theme": user.theme,
        "city": user.city,
        "notification_prefs": prefs(user),
        "created_at": user.created_at,
    }


def _check_password(password: str) -> None:
    problems = password_problems(password)
    if problems:
        raise AppError(422, "Пароль должен быть: " + ", ".join(problems))


def _email_taken(db: Session, email: str, exclude_id: str | None = None) -> bool:
    query = select(User.id).where(func.lower(User.email) == email)
    if exclude_id:
        query = query.where(User.id != exclude_id)
    return db.scalar(query) is not None


def create_session(db: Session, user: User, remember: bool, user_agent: str = "") -> tuple[str, datetime]:
    token = new_token()
    ttl = timedelta(days=config.SESSION_TTL_DAYS) if remember else timedelta(hours=config.SHORT_SESSION_HOURS)
    expires = _now() + ttl
    db.add(AuthSession(id=token_hash(token), user_id=user.id, expires_at=expires, user_agent=user_agent[:255]))
    db.commit()
    return token, expires


def user_for_token(db: Session, token: str | None) -> User | None:
    if not token:
        return None
    session = db.get(AuthSession, token_hash(token))
    if not session:
        return None
    if _aware(session.expires_at) < _now():
        db.delete(session)
        db.commit()
        return None
    user = db.get(User, session.user_id)
    if not user or user.deleted_at:
        return None
    return user


def revoke_token(db: Session, token: str | None) -> None:
    if token:
        db.execute(delete(AuthSession).where(AuthSession.id == token_hash(token)))
        db.commit()


def register(db: Session, display_name: str, email: str, password: str, current: User | None) -> User:
    email = normalize_email(email)
    _check_password(password)
    if _email_taken(db, email):
        raise AppError(409, "Аккаунт с таким email уже существует. Войдите или восстановите доступ.")
    if current and current.is_guest and not current.email:
        # Upgrade the guest in place so rooms, options and votes stay with the person.
        user = current
        user.display_name = display_name.strip()
    else:
        user = User(id=str(uuid4()), display_name=display_name.strip())
        db.add(user)
    user.email, user.password_hash, user.is_guest = email, hash_password(password), False
    db.commit()
    DOMAIN_EVENTS.labels("user_registered").inc()
    log.info("user registered", extra={"event": "user_registered", "user_id": user.id})
    return user


def login(db: Session, email: str, password: str) -> User:
    user = db.scalar(select(User).where(func.lower(User.email) == normalize_email(email)))
    if not user or user.deleted_at or not verify_password(password, user.password_hash):
        DOMAIN_EVENTS.labels("login_failed").inc()
        raise AppError(401, "Неверный email или пароль")
    DOMAIN_EVENTS.labels("login").inc()
    return user


def create_guest(db: Session, display_name: str) -> User:
    name = display_name.strip()
    if not name:
        raise AppError(422, "Укажите имя")
    user = User(id=str(uuid4()), display_name=name, is_guest=True)
    db.add(user)
    db.commit()
    DOMAIN_EVENTS.labels("guest_created").inc()
    return user


def update_profile(db: Session, user: User, data: dict) -> User:
    if "display_name" in data and data["display_name"] is not None:
        name = data["display_name"].strip()
        if not name:
            raise AppError(422, "Имя не может быть пустым")
        user.display_name = name
    if data.get("email") is not None:
        email = normalize_email(data["email"])
        if not user.password_hash:
            raise AppError(422, "Сначала задайте пароль — так вы превратите гостевой профиль в аккаунт")
        if _email_taken(db, email, exclude_id=user.id):
            raise AppError(409, "Этот email уже используется")
        user.email = email
    if data.get("avatar_color") is not None:
        if data["avatar_color"] not in AVATAR_COLORS:
            raise AppError(422, "Неизвестный цвет аватара")
        user.avatar_color = data["avatar_color"]
    if data.get("theme") is not None:
        if data["theme"] not in THEMES:
            raise AppError(422, "Неизвестная тема")
        user.theme = data["theme"]
    if data.get("city") is not None:
        user.city = data["city"].strip()[:80]
    if data.get("notification_prefs") is not None:
        merged = {**prefs(user), **{k: v for k, v in data["notification_prefs"].items() if k in DEFAULT_PREFS}}
        user.notification_prefs_json = json.dumps(merged)
    db.commit()
    return user


def change_password(db: Session, user: User, current_password: str, new_password: str, keep_token: str | None) -> None:
    if not verify_password(current_password, user.password_hash):
        raise AppError(403, "Текущий пароль указан неверно")
    _check_password(new_password)
    user.password_hash = hash_password(new_password)
    # Sign out every other device.
    query = delete(AuthSession).where(AuthSession.user_id == user.id)
    if keep_token:
        query = query.where(AuthSession.id != token_hash(keep_token))
    db.execute(query)
    db.commit()


def delete_account(db: Session, user: User, password: str | None) -> None:
    if user.password_hash and not verify_password(password or "", user.password_hash):
        raise AppError(403, "Пароль указан неверно")
    # Rooms, options and votes stay so other participants' results do not change;
    # personal data is removed and the account can no longer sign in.
    user.display_name = "Удалённый пользователь"
    user.email = None
    user.password_hash = None
    user.notification_prefs_json = "{}"
    user.deleted_at = _now()
    db.execute(delete(AuthSession).where(AuthSession.user_id == user.id))
    db.commit()
    DOMAIN_EVENTS.labels("account_deleted").inc()


# ---- Password recovery (only when SMTP is configured — never simulated) ----

def recovery_available() -> bool:
    return bool(config.SMTP_HOST)


def request_reset(db: Session, email: str, base_url: str) -> None:
    if not recovery_available():
        raise AppError(503, "Восстановление по email не настроено на этом сервере. Напишите в поддержку.")
    user = db.scalar(select(User).where(func.lower(User.email) == normalize_email(email)))
    if not user or user.deleted_at:
        return  # same answer for unknown emails: do not reveal who is registered
    token = new_token()
    db.add(PasswordResetToken(id=token_hash(token), user_id=user.id, expires_at=_now() + timedelta(hours=1)))
    db.commit()
    link = f"{config.PUBLIC_URL or base_url}/reset-password?token={token}"
    msg = EmailMessage()
    msg["Subject"], msg["From"], msg["To"] = "VETO — восстановление доступа", config.SMTP_FROM, user.email
    msg.set_content(f"Чтобы задать новый пароль, откройте ссылку (действует 1 час):\n{link}\n\nЕсли это были не вы, просто проигнорируйте письмо.")
    with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=10) as smtp:
        smtp.starttls()
        if config.SMTP_USER:
            smtp.login(config.SMTP_USER, config.SMTP_PASSWORD)
        smtp.send_message(msg)


def confirm_reset(db: Session, token: str, new_password: str) -> None:
    row = db.get(PasswordResetToken, token_hash(token))
    if not row or row.used_at or _aware(row.expires_at) < _now():
        raise AppError(400, "Ссылка недействительна или устарела. Запросите новую.")
    _check_password(new_password)
    user = db.get(User, row.user_id)
    user.password_hash = hash_password(new_password)
    row.used_at = _now()
    db.execute(delete(AuthSession).where(AuthSession.user_id == user.id))
    db.commit()

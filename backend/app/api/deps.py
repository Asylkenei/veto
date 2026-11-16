from typing import Annotated
from fastapi import Depends, Request
from sqlalchemy.orm import Session
from app.core.config import SESSION_COOKIE
from app.core.errors import AppError
from app.db.dependencies import get_db
from app.models.user import User
from app.services import auth_service

DbSession = Annotated[Session, Depends(get_db)]


def session_token(request: Request) -> str | None:
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:].strip() or None
    return request.cookies.get(SESSION_COOKIE)


def optional_user(request: Request, db: DbSession) -> User | None:
    user = auth_service.user_for_token(db, session_token(request))
    request.state.user_id = user.id if user else None
    return user


def current_user(user: Annotated[User | None, Depends(optional_user)]) -> User:
    if not user:
        raise AppError(401, "Войдите в аккаунт, чтобы продолжить")
    return user


CurrentUser = Annotated[User, Depends(current_user)]
OptionalUser = Annotated[User | None, Depends(optional_user)]

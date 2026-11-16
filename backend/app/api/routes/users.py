"""Backward-compatible MVP endpoints (kept so the old API contract still works)."""
from fastapi import APIRouter, Request, Response
from app.api.deps import CurrentUser, DbSession
from app.api.routes.auth import set_session_cookie
from app.schemas.users import GuestCreate, UserRead
from app.services import auth_service

router = APIRouter(prefix="/users", tags=["users (legacy)"])


@router.post("/guest", response_model=UserRead, status_code=201)
def create_guest(data: GuestCreate, request: Request, response: Response, db: DbSession):
    user = auth_service.create_guest(db, data.display_name)
    token, expires = auth_service.create_session(db, user, True, request.headers.get("user-agent", ""))
    set_session_cookie(request, response, token, expires, True)
    return auth_service.serialize_user(user)


@router.get("/me", response_model=UserRead)
def me(user: CurrentUser):
    return auth_service.serialize_user(user)

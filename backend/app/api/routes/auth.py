from datetime import datetime
from fastapi import APIRouter, Request, Response
from app.api.deps import CurrentUser, DbSession, OptionalUser, session_token
from app.core import config
from app.schemas.users import (
    AuthOut, ChangePasswordIn, DeleteAccountIn, GuestCreate, LoginIn, ProfileUpdate,
    RegisterIn, ResetConfirmIn, ResetRequestIn, UserRead,
)
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


def _secure(request: Request) -> bool:
    if config.COOKIE_SECURE in ("true", "false"):
        return config.COOKIE_SECURE == "true"
    return request.headers.get("x-forwarded-proto", request.url.scheme) == "https"


def set_session_cookie(request: Request, response: Response, token: str, expires: datetime, remember: bool) -> None:
    response.set_cookie(
        config.SESSION_COOKIE,
        token,
        max_age=int((expires - datetime.now(expires.tzinfo)).total_seconds()) if remember else None,
        httponly=True,
        samesite="lax",
        secure=_secure(request),
        path="/",
    )


def _start(request: Request, response: Response, db, user, remember: bool) -> dict:
    token, expires = auth_service.create_session(db, user, remember, request.headers.get("user-agent", ""))
    set_session_cookie(request, response, token, expires, remember)
    return {"user": auth_service.serialize_user(user), "expires_at": expires}


@router.post("/register", response_model=AuthOut, status_code=201)
def register(data: RegisterIn, request: Request, response: Response, db: DbSession, current: OptionalUser):
    user = auth_service.register(db, data.display_name, data.email, data.password, current)
    return _start(request, response, db, user, data.remember)


@router.post("/login", response_model=AuthOut)
def login(data: LoginIn, request: Request, response: Response, db: DbSession):
    user = auth_service.login(db, data.email, data.password)
    return _start(request, response, db, user, data.remember)


@router.post("/guest", response_model=AuthOut, status_code=201)
def guest(data: GuestCreate, request: Request, response: Response, db: DbSession):
    user = auth_service.create_guest(db, data.display_name)
    return _start(request, response, db, user, True)


@router.post("/logout", status_code=204)
def logout(request: Request, response: Response, db: DbSession):
    auth_service.revoke_token(db, session_token(request))
    response.delete_cookie(config.SESSION_COOKIE, path="/")
    response.status_code = 204
    return response


@router.get("/session", summary="Current session; 200 with user=null when signed out")
def session(user: OptionalUser):
    return {"user": auth_service.serialize_user(user) if user else None}


@router.get("/me", response_model=UserRead)
def me(user: CurrentUser):
    return auth_service.serialize_user(user)


@router.patch("/me", response_model=UserRead)
def update_me(data: ProfileUpdate, db: DbSession, user: CurrentUser):
    return auth_service.serialize_user(auth_service.update_profile(db, user, data.model_dump(exclude_none=True)))


@router.post("/password", status_code=204)
def change_password(data: ChangePasswordIn, request: Request, db: DbSession, user: CurrentUser):
    auth_service.change_password(db, user, data.current_password, data.new_password, session_token(request))
    return Response(status_code=204)


@router.post("/delete", status_code=204)
def delete_account(data: DeleteAccountIn, response: Response, db: DbSession, user: CurrentUser):
    auth_service.delete_account(db, user, data.password)
    response.delete_cookie(config.SESSION_COOKIE, path="/")
    response.status_code = 204
    return response


@router.get("/recovery")
def recovery_status():
    return {"available": auth_service.recovery_available(), "support_email": config.SUPPORT_EMAIL}


@router.post("/recovery/request", status_code=202)
def recovery_request(data: ResetRequestIn, request: Request, db: DbSession):
    auth_service.request_reset(db, data.email, str(request.base_url).rstrip("/"))
    return {"ok": True}


@router.post("/recovery/confirm", status_code=204)
def recovery_confirm(data: ResetConfirmIn, db: DbSession):
    auth_service.confirm_reset(db, data.token, data.password)
    return Response(status_code=204)

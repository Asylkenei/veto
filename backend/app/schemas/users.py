from datetime import datetime
from typing import Literal
from pydantic import BaseModel, EmailStr, Field


class GuestCreate(BaseModel):
    display_name: str = Field(min_length=1, max_length=80)


class RegisterIn(BaseModel):
    display_name: str = Field(min_length=1, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    remember: bool = True


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)
    remember: bool = True


class ResetRequestIn(BaseModel):
    email: EmailStr


class ResetConfirmIn(BaseModel):
    token: str = Field(min_length=10, max_length=200)
    password: str = Field(min_length=8, max_length=128)


class ChangePasswordIn(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class DeleteAccountIn(BaseModel):
    password: str | None = Field(default=None, max_length=128)
    confirm: Literal["УДАЛИТЬ"]


class NotificationPrefs(BaseModel):
    push: bool | None = None
    invites: bool | None = None
    voting: bool | None = None
    results: bool | None = None
    activity: bool | None = None
    digest: Literal["instant", "important"] | None = None


class ProfileUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=80)
    email: EmailStr | None = None
    avatar_color: str | None = Field(default=None, max_length=16)
    theme: Literal["system", "light", "dark"] | None = None
    city: str | None = Field(default=None, max_length=80)
    notification_prefs: NotificationPrefs | None = None


class UserRead(BaseModel):
    id: str
    display_name: str
    email: str | None = None
    is_guest: bool = True
    avatar_color: str = "sand"
    theme: str = "system"
    city: str = ""
    notification_prefs: dict = {}
    created_at: datetime | None = None


class AuthOut(BaseModel):
    user: UserRead
    expires_at: datetime

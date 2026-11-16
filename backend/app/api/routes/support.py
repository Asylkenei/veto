from typing import Literal
from fastapi import APIRouter
from pydantic import BaseModel, Field
from app.api.deps import CurrentUser, DbSession, OptionalUser
from app.core import config
from app.services import support_service

router = APIRouter(prefix="/support", tags=["support"])


class TicketIn(BaseModel):
    kind: Literal["question", "bug", "idea"] = "question"
    category: Literal["start", "decisions", "invites", "methods", "results", "account", "notifications", "other"] = "other"
    subject: str = Field(min_length=3, max_length=200)
    message: str = Field(min_length=10, max_length=5000)
    contact: str = Field(default="", max_length=254)


@router.get("/info")
def info():
    return {"email": config.SUPPORT_EMAIL}


@router.post("/tickets", status_code=201)
def create_ticket(data: TicketIn, db: DbSession, user: OptionalUser):
    return support_service.create(db, user, data.kind, data.category, data.subject, data.message, data.contact)


@router.get("/tickets")
def my_tickets(db: DbSession, user: CurrentUser):
    return support_service.mine(db, user)

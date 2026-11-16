from fastapi import APIRouter, Query
from pydantic import BaseModel
from app.api.deps import CurrentUser, DbSession
from app.services import place_service

router = APIRouter(prefix="/places", tags=["discovery"])


class Flag(BaseModel):
    value: bool


class RandomIn(BaseModel):
    exclude: list[str] = []
    category: str | None = None


@router.get("/categories")
def categories(db: DbSession, user: CurrentUser):
    return place_service.categories(db)


@router.get("")
def catalogue(db: DbSession, user: CurrentUser, category: str | None = None, city: str | None = None, q: str | None = Query(default=None, max_length=80)):
    return place_service.catalogue(db, user, category, city, q)


@router.get("/recent")
def recent(db: DbSession, user: CurrentUser):
    return place_service.recent(db, user)


@router.get("/popular")
def popular(db: DbSession, user: CurrentUser):
    return place_service.popular(db, user)


@router.get("/saved")
def saved(db: DbSession, user: CurrentUser):
    return place_service.saved(db, user)


@router.get("/today")
def today(db: DbSession, user: CurrentUser):
    return place_service.place_of_day(db, user)


@router.post("/random")
def random(data: RandomIn, db: DbSession, user: CurrentUser):
    return place_service.random_place(db, user, data.exclude[:200], data.category)


@router.get("/{place_id}")
def get_place(place_id: str, db: DbSession, user: CurrentUser):
    return place_service.get_place(db, user, place_id)


@router.put("/{place_id}/visited")
def visited(place_id: str, data: Flag, db: DbSession, user: CurrentUser):
    return place_service.set_visited(db, user, place_id, data.value)


@router.put("/{place_id}/saved")
def save(place_id: str, data: Flag, db: DbSession, user: CurrentUser):
    return place_service.set_saved(db, user, place_id, data.value)

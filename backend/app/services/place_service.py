"""Discovery: history, popularity, random pick and place of the day.

* «Недавно выбирали» comes only from user_place_history (real actions).
* «Популярное» counts real additions across VETO; if nothing has been chosen
  yet, the API says so (`is_popularity=False`) and the UI shows «Подборка VETO».
* Random pick excludes visited places and the places already shown in this
  series (`exclude`), and only resets when everything has been shown.
* Place of the day is stored per user per calendar day, so it is stable.
"""
import hashlib
import secrets
from datetime import date, datetime, timedelta, timezone
from uuid import uuid4
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session, selectinload
from app.core.errors import AppError
from app.models import (
    DailyPlaceRecommendation,
    Place,
    PlaceCategory,
    SavedPlace,
    User,
    UserPlaceHistory,
    UserVisitedPlace,
)

ALMATY = timezone(timedelta(hours=5))


def _ids(db: Session, model, user_id: str) -> set[str]:
    return set(db.scalars(select(model.place_id).where(model.user_id == user_id)))


def _counts(db: Session) -> dict[str, int]:
    rows = db.execute(
        select(UserPlaceHistory.place_id, func.count(func.distinct(UserPlaceHistory.room_id)))
        .where(UserPlaceHistory.action == "added")
        .group_by(UserPlaceHistory.place_id)
    ).all()
    return {pid: n for pid, n in rows}


def serialize(place: Place, visited: set[str], saved: set[str], counts: dict[str, int]) -> dict:
    return {
        "id": place.id,
        "name": place.name,
        "city": place.city or "В любом городе",
        "category": {"id": place.category.id, "name": place.category.name, "icon": place.category.icon},
        "summary": place.summary,
        "why_visit": place.why_visit,
        "fact": place.fact,
        "image_url": place.image_url,
        "image_credit": place.image_credit,
        "visited": place.id in visited,
        "saved": place.id in saved,
        "times_chosen": counts.get(place.id, 0),
    }


def _all(db: Session) -> list[Place]:
    return list(db.scalars(select(Place).options(selectinload(Place.category)).order_by(Place.name)))


def _ctx(db: Session, user: User):
    return _ids(db, UserVisitedPlace, user.id), _ids(db, SavedPlace, user.id), _counts(db)


def categories(db: Session) -> list[dict]:
    return [
        {"id": c.id, "name": c.name, "icon": c.icon}
        for c in db.scalars(select(PlaceCategory).order_by(PlaceCategory.sort))
    ]


def catalogue(db: Session, user: User, category: str | None, city: str | None, q: str | None) -> list[dict]:
    visited, saved, counts = _ctx(db, user)
    places = _all(db)
    if category:
        places = [p for p in places if p.category_id == category]
    if city:
        places = [p for p in places if p.city in (city, "")]
    if q:
        needle = q.strip().lower()
        places = [p for p in places if needle in p.name.lower() or needle in p.summary.lower()]
    return [serialize(p, visited, saved, counts) for p in places]


def recent(db: Session, user: User, limit: int = 12) -> list[dict]:
    visited, saved, counts = _ctx(db, user)
    rows = db.execute(
        select(UserPlaceHistory.place_id, func.max(UserPlaceHistory.created_at).label("last"))
        .where(UserPlaceHistory.user_id == user.id)
        .group_by(UserPlaceHistory.place_id)
        .order_by(func.max(UserPlaceHistory.created_at).desc())
        .limit(limit)
    ).all()
    by_id = {p.id: p for p in _all(db)}
    return [serialize(by_id[pid], visited, saved, counts) for pid, _ in rows if pid in by_id]


def popular(db: Session, user: User, limit: int = 12) -> dict:
    visited, saved, counts = _ctx(db, user)
    places = _all(db)
    chosen = sorted((p for p in places if counts.get(p.id)), key=lambda p: -counts[p.id])
    if chosen:
        return {"is_popularity": True, "items": [serialize(p, visited, saved, counts) for p in chosen[:limit]]}
    # Not enough real data yet: neutral curated picks, explicitly not called popular.
    preferred = [p for p in places if user.city and p.city == user.city] + [p for p in places if p.city == ""]
    rest = [p for p in places if p not in preferred]
    return {"is_popularity": False, "items": [serialize(p, visited, saved, counts) for p in (preferred + rest)[:limit]]}


def random_place(db: Session, user: User, exclude: list[str], category: str | None) -> dict:
    visited, saved, counts = _ctx(db, user)
    pool = [p for p in _all(db) if p.id not in visited and (not category or p.category_id == category)]
    if not pool:
        raise AppError(404, "Похоже, вы отметили посещёнными все места этой категории")
    fresh = [p for p in pool if p.id not in set(exclude)]
    exhausted = not fresh
    chosen = secrets.choice(fresh or pool)
    return {
        "place": serialize(chosen, visited, saved, counts),
        "exhausted": exhausted,
        "remaining": max(0, len(fresh) - 1),
        "note": "Возможно, вы ещё здесь не были",
    }


def today_for(user_id: str) -> date:
    return datetime.now(ALMATY).date()


def place_of_day(db: Session, user: User) -> dict:
    day = today_for(user.id)
    row = db.scalar(
        select(DailyPlaceRecommendation).where(
            DailyPlaceRecommendation.user_id == user.id, DailyPlaceRecommendation.day == day
        )
    )
    visited, saved, counts = _ctx(db, user)
    places = _all(db)
    if not row:
        pool = [p for p in places if p.id not in visited and p.fact] or places
        # Deterministic per user and day — the same answer on every refresh.
        index = int(hashlib.sha256(f"{user.id}:{day.isoformat()}".encode()).hexdigest(), 16) % len(pool)
        row = DailyPlaceRecommendation(id=str(uuid4()), user_id=user.id, day=day, place_id=pool[index].id)
        db.add(row)
        db.commit()
    place = next(p for p in places if p.id == row.place_id)
    return {"day": day.isoformat(), "place": serialize(place, visited, saved, counts)}


def get_place(db: Session, user: User, place_id: str) -> dict:
    place = db.scalar(select(Place).options(selectinload(Place.category)).where(Place.id == place_id))
    if not place:
        raise AppError(404, "Место не найдено")
    visited, saved, counts = _ctx(db, user)
    return serialize(place, visited, saved, counts)


def _toggle(db: Session, model, user: User, place_id: str, on: bool) -> None:
    if not db.get(Place, place_id):
        raise AppError(404, "Место не найдено")
    exists = db.scalar(select(model).where(model.user_id == user.id, model.place_id == place_id))
    if on and not exists:
        db.add(model(id=str(uuid4()), user_id=user.id, place_id=place_id))
    if not on and exists:
        db.execute(delete(model).where(model.user_id == user.id, model.place_id == place_id))
    db.commit()


def set_visited(db: Session, user: User, place_id: str, on: bool) -> dict:
    _toggle(db, UserVisitedPlace, user, place_id, on)
    return get_place(db, user, place_id)


def set_saved(db: Session, user: User, place_id: str, on: bool) -> dict:
    _toggle(db, SavedPlace, user, place_id, on)
    return get_place(db, user, place_id)


def saved(db: Session, user: User) -> list[dict]:
    visited, saved_ids, counts = _ctx(db, user)
    return [serialize(p, visited, saved_ids, counts) for p in _all(db) if p.id in saved_ids]

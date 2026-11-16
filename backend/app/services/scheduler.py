"""Background job: close voting at the deadline and remind those who haven't voted."""
import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select
from app.core import config
from app.db.session import SessionLocal
from app.models import Room
from app.services import room_service
from app.services.notification_service import notify

log = logging.getLogger("veto.scheduler")


def tick() -> int:
    changed = 0
    now = datetime.now(timezone.utc)
    soon = now + timedelta(minutes=config.DEADLINE_REMINDER_MINUTES)
    with SessionLocal() as db:
        ids = list(db.scalars(select(Room.id).where(Room.status == "VOTING", Room.deadline.is_not(None))))
        for room_id in ids:
            room = room_service.require_room(db, room_id)
            if room_service.enforce_deadline(db, room):
                changed += 1
                continue
            rnd = room.rounds[-1] if room.rounds else None
            deadline = room_service._aware(room.deadline)
            if rnd and not rnd.reminder_sent and deadline and deadline <= soon:
                voted = {v.user_id for v in rnd.votes}
                waiting = [uid for uid in json.loads(rnd.frozen_participants_json) if uid not in voted]
                notify(db, waiting, "deadline_soon", "Скоро завершится голосование", room.title, room.id, room_service.link(room, "vote"))
                rnd.reminder_sent = True
                room_service.commit(db, room.id)
                changed += 1
    return changed


async def run_forever(stop: asyncio.Event) -> None:
    while not stop.is_set():
        try:
            await run_in_threadpool(tick)
        except Exception:
            log.exception("scheduler tick failed")
        try:
            await asyncio.wait_for(stop.wait(), timeout=config.SCHEDULER_INTERVAL_SECONDS)
        except asyncio.TimeoutError:
            pass

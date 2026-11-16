"""Server-Sent Events: push room state to every participant within ~1 s.

Each tick reads a single integer (`rooms.version`, bumped by every mutation),
so an idle stream costs one indexed primary-key lookup per second. The full
room payload is serialised only when the version actually changes.
"""
import asyncio
import json
from collections.abc import AsyncIterator
from fastapi import Request
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import func, select
from app.core.metrics import SSE_CONNECTIONS
from app.db.session import SessionLocal
from app.models import Participant, Room
from app.services import notification_service, room_service

TICK = 0.8
PING_EVERY = 15


def _sse(event: str, data) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False, default=str)}\n\n"


def _room_version(room_id: str) -> int | None:
    with SessionLocal() as db:
        return db.scalar(select(Room.version).where(Room.id == room_id))


def _room_payload(room_id: str, user_id: str) -> dict | None:
    with SessionLocal() as db:
        room = room_service.require_room(db, room_id)
        return room_service.serialize_room(room, user_id)


def _user_state(user_id: str) -> tuple[int, int]:
    with SessionLocal() as db:
        unread = notification_service.unread_count(db, user_id)
        version = db.scalar(
            select(func.coalesce(func.sum(Room.version), 0) + func.count(Room.id))
            .join(Participant, Participant.room_id == Room.id)
            .where(Participant.user_id == user_id)
        ) or 0
        return unread, int(version)


async def room_stream(request: Request, room_id: str, user_id: str) -> AsyncIterator[str]:
    SSE_CONNECTIONS.inc()
    last, idle = None, 0.0
    try:
        yield "retry: 2000\n\n"
        while not await request.is_disconnected():
            version = await run_in_threadpool(_room_version, room_id)
            if version is None:
                yield _sse("gone", {"room_id": room_id})
                return
            if version != last:
                payload = await run_in_threadpool(_room_payload, room_id, user_id)
                yield _sse("room", payload)
                last, idle = version, 0.0
            elif idle >= PING_EVERY:
                yield ": ping\n\n"
                idle = 0.0
            await asyncio.sleep(TICK)
            idle += TICK
    finally:
        SSE_CONNECTIONS.dec()


async def user_stream(request: Request, user_id: str) -> AsyncIterator[str]:
    SSE_CONNECTIONS.inc()
    last_unread, last_version, idle = None, None, 0.0
    try:
        yield "retry: 3000\n\n"
        while not await request.is_disconnected():
            unread, version = await run_in_threadpool(_user_state, user_id)
            if unread != last_unread:
                yield _sse("notifications", {"unread": unread})
                last_unread = unread
                idle = 0.0
            if version != last_version:
                if last_version is not None:
                    yield _sse("rooms", {"version": version})
                last_version = version
                idle = 0.0
            if idle >= PING_EVERY:
                yield ": ping\n\n"
                idle = 0.0
            await asyncio.sleep(1.5)
            idle += 1.5
    finally:
        SSE_CONNECTIONS.dec()

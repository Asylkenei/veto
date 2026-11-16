from fastapi import APIRouter, Request, Response
from fastapi.responses import StreamingResponse
from app.api.deps import CurrentUser, DbSession
from app.core.errors import AppError
from app.schemas.rooms import (
    CommentCreate, InviteByEmail, OptionCreate, OptionModerate, OptionOrder, OptionUpdate,
    RoomCreate, RoomRead, RoomUpdate,
)
from app.services import live, room_service

router = APIRouter(prefix="/rooms", tags=["rooms"])


@router.get("", response_model=list[RoomRead])
def list_rooms(db: DbSession, user: CurrentUser):
    return room_service.list_rooms(db, user)


@router.post("", response_model=RoomRead, status_code=201)
def create_room(data: RoomCreate, db: DbSession, user: CurrentUser):
    return room_service.create_room(db, user, data)


@router.get("/by-code/{code}")
def by_code(code: str, db: DbSession, user: CurrentUser):
    return {"room_id": room_service.find_by_code(db, code)}


@router.get("/{room_id}", response_model=RoomRead)
def get_room(room_id: str, db: DbSession, user: CurrentUser):
    return room_service.get_room(db, room_id, user)


@router.patch("/{room_id}", response_model=RoomRead)
def update_room(room_id: str, data: RoomUpdate, db: DbSession, user: CurrentUser):
    return room_service.update_room(db, room_id, user, data)


@router.get("/{room_id}/stream", include_in_schema=True, summary="Live room updates (SSE)")
def stream(room_id: str, request: Request, db: DbSession, user: CurrentUser):
    room = room_service.require_room(db, room_id)
    if not room_service.is_member(db, room.id, user.id):
        raise AppError(403, "Сначала присоединитесь к комнате")
    return StreamingResponse(
        live.room_stream(request, room_id, user.id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/{room_id}/join", response_model=RoomRead)
def join_room(room_id: str, db: DbSession, user: CurrentUser):
    return room_service.join_room(db, room_id, user)


@router.post("/{room_id}/leave", status_code=204)
def leave_room(room_id: str, db: DbSession, user: CurrentUser):
    room_service.leave_room(db, room_id, user)
    return Response(status_code=204)


@router.delete("/{room_id}/participants/{user_id}", response_model=RoomRead)
def remove_participant(room_id: str, user_id: str, db: DbSession, user: CurrentUser):
    return room_service.remove_participant(db, room_id, user, user_id)


@router.post("/{room_id}/invite")
def invite(room_id: str, data: InviteByEmail, db: DbSession, user: CurrentUser):
    return room_service.invite_by_email(db, room_id, user, data.email)


@router.post("/{room_id}/options", response_model=RoomRead)
def add_option(room_id: str, data: OptionCreate, db: DbSession, user: CurrentUser):
    return room_service.add_option(db, room_id, user, data.title, data.description, data.place_id)


@router.put("/{room_id}/options/order", response_model=RoomRead, summary="Reorder options (host, before voting)")
def reorder_options(room_id: str, data: OptionOrder, db: DbSession, user: CurrentUser):
    return room_service.reorder_options(db, room_id, user, data.ids)


@router.put("/{room_id}/options/{option_id}", response_model=RoomRead)
def edit_option(room_id: str, option_id: str, data: OptionUpdate, db: DbSession, user: CurrentUser):
    return room_service.edit_option(db, room_id, option_id, user, data.title, data.description)


@router.delete("/{room_id}/options/{option_id}", response_model=RoomRead)
def delete_option(room_id: str, option_id: str, db: DbSession, user: CurrentUser):
    return room_service.delete_option(db, room_id, option_id, user)


@router.patch("/{room_id}/options/{option_id}", response_model=RoomRead)
def moderate_option(room_id: str, option_id: str, data: OptionModerate, db: DbSession, user: CurrentUser):
    return room_service.moderate_option(db, room_id, option_id, user, data.status, data.rejection_reason)


@router.post("/{room_id}/options/{option_id}/comments", response_model=RoomRead)
def add_comment(room_id: str, option_id: str, data: CommentCreate, db: DbSession, user: CurrentUser):
    return room_service.add_comment(db, room_id, option_id, user, data.text)


@router.post("/{room_id}/start", response_model=RoomRead)
def start_voting(room_id: str, db: DbSession, user: CurrentUser):
    return room_service.start_voting(db, room_id, user)


@router.post("/{room_id}/finish", response_model=RoomRead, summary="Force-finish voting (host)")
def force_finish(room_id: str, db: DbSession, user: CurrentUser):
    return room_service.force_finish(db, room_id, user)


@router.post("/{room_id}/rounds", response_model=RoomRead, summary="Back to discussion (new round)")
def new_round(room_id: str, db: DbSession, user: CurrentUser):
    return room_service.start_new_round(db, room_id, user)


@router.post("/{room_id}/runoff", response_model=RoomRead, summary="Re-vote between tied leaders")
def runoff(room_id: str, db: DbSession, user: CurrentUser):
    return room_service.runoff(db, room_id, user)


@router.post("/{room_id}/tiebreak", response_model=RoomRead, summary="Server-side random draw between tied options")
def tiebreak(room_id: str, db: DbSession, user: CurrentUser):
    return room_service.tiebreak(db, room_id, user)

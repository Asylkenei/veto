from fastapi import APIRouter
from app.api.deps import CurrentUser, DbSession
from app.schemas.rooms import RoomRead
from app.schemas.votes import VoteSubmit
from app.services.room_service import submit_vote

router = APIRouter(prefix="/rooms", tags=["votes"])


@router.post("/{room_id}/votes", response_model=RoomRead)
def cast_vote(room_id: str, data: VoteSubmit, db: DbSession, user: CurrentUser):
    return submit_vote(db, room_id, user, data)

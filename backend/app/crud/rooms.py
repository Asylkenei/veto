import json
from datetime import datetime, timezone
from uuid import uuid4
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from app.models import Comment, Option, Participant, Room, Round, User, Vote

_LOAD = (
    selectinload(Room.participants).selectinload(Participant.user),
    selectinload(Room.options).selectinload(Option.author),
    selectinload(Room.comments).selectinload(Comment.author),
    selectinload(Room.rounds).selectinload(Round.votes).selectinload(Vote.details),
)


def get(db: Session, room_id: str) -> Room | None:
    db.expire_all()
    return db.scalar(select(Room).options(*_LOAD).where(Room.id == room_id))


def list_for_user(db: Session, user_id: str) -> list[Room]:
    return list(
        db.scalars(
            select(Room)
            .join(Participant)
            .where(Participant.user_id == user_id)
            .options(*_LOAD)
            .order_by(Room.created_at.desc())
        ).unique()
    )


def create(db: Session, *, title, question, description, method, host: User, allow_suggestions,
           allow_comments, hide_results, deadline, invite_code, template="") -> Room:
    room = Room(
        id=str(uuid4()),
        title=title.strip(),
        question=question.strip(),
        description=description.strip(),
        method=method,
        host_id=host.id,
        allow_suggestions=allow_suggestions,
        allow_comments=allow_comments,
        hide_results=hide_results,
        deadline=deadline,
        invite_code=invite_code,
        template=template,
    )
    db.add(room)
    db.flush()
    db.add(Participant(id=str(uuid4()), room_id=room.id, user_id=host.id, role="HOST"))
    db.commit()
    return get(db, room.id)


def get_participant(db: Session, room_id: str, user_id: str) -> Participant | None:
    return db.scalar(
        select(Participant).where(Participant.room_id == room_id, Participant.user_id == user_id)
    )


def update_option(db: Session, option: Option, status: str, reason: str) -> Option:
    option.status = status
    option.rejection_reason = reason.strip() if status == "REJECTED" else ""
    return option


def add_comment(db: Session, room_id: str, option_id: str, user_id: str, text: str) -> Comment:
    comment = Comment(id=str(uuid4()), room_id=room_id, option_id=option_id, author_id=user_id, text=text.strip())
    db.add(comment)
    return comment


def add_round(db: Session, room_id: str, number: int, participant_ids: list[str], option_ids: list[str], kind: str = "regular") -> Round:
    rnd = Round(
        id=str(uuid4()),
        room_id=room_id,
        number=number,
        status="VOTING",
        kind=kind,
        frozen_participants_json=json.dumps(participant_ids),
        frozen_options_json=json.dumps(option_ids),
        started_at=datetime.now(timezone.utc),
    )
    db.add(rnd)
    db.flush()
    return rnd

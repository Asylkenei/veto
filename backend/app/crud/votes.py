from uuid import uuid4
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models import Round, Vote, VoteDetail


def get_round(db: Session, round_id: str) -> Round | None:
    return db.get(Round, round_id)


def has_voted(db: Session, round_id: str, user_id: str) -> bool:
    return (
        db.scalar(
            select(Vote.id).where(Vote.round_id == round_id, Vote.user_id == user_id)
        )
        is not None
    )


def submit(
    db: Session,
    rnd: Round,
    user_id: str,
    choice_option_id: str | None,
    details: dict[str, str],
) -> Vote:
    vote = Vote(
        id=str(uuid4()), round=rnd, user_id=user_id, choice_option_id=choice_option_id
    )
    vote.details = [
        VoteDetail(option_id=option_id, stance=stance)
        for option_id, stance in details.items()
    ]
    db.add(vote)
    db.flush()
    return vote

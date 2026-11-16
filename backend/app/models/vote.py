from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base


class Vote(Base):
    __tablename__ = "votes"
    __table_args__ = (
        UniqueConstraint("round_id", "user_id", name="uq_round_user_vote"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    round_id: Mapped[str] = mapped_column(
        ForeignKey("rounds.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    choice_option_id: Mapped[str | None] = mapped_column(
        ForeignKey("options.id"), nullable=True
    )
    round = relationship("Round", back_populates="votes")
    user = relationship("User")
    details = relationship(
        "VoteDetail", back_populates="vote", cascade="all, delete-orphan"
    )


class VoteDetail(Base):
    __tablename__ = "vote_details"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    vote_id: Mapped[str] = mapped_column(
        ForeignKey("votes.id", ondelete="CASCADE"), index=True
    )
    option_id: Mapped[str] = mapped_column(ForeignKey("options.id"), nullable=False)
    stance: Mapped[str] = mapped_column(String(8), nullable=False)
    vote = relationship("Vote", back_populates="details")

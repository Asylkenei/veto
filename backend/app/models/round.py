from datetime import datetime
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base


class Round(Base):
    __tablename__ = "rounds"
    __table_args__ = (UniqueConstraint("room_id", "number", name="uq_room_round_number"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    room_id: Mapped[str] = mapped_column(ForeignKey("rooms.id", ondelete="CASCADE"), index=True)
    number: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(24), default="DRAFT", nullable=False)
    frozen_participants_json: Mapped[str] = mapped_column(Text, default="[]", nullable=False)
    frozen_options_json: Mapped[str] = mapped_column(Text, default="[]", nullable=False)
    result_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # VETO 2.0
    kind: Mapped[str] = mapped_column(String(16), default="regular", nullable=False)  # regular | runoff
    end_reason: Mapped[str] = mapped_column(String(16), default="", nullable=False)  # all_voted | forced | deadline
    tiebreak_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    reminder_sent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    room = relationship("Room", back_populates="rounds")
    votes = relationship("Vote", back_populates="round", cascade="all, delete-orphan")

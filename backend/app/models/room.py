from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base
from app.models._base import utcnow


class Room(Base):
    __tablename__ = "rooms"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    question: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    method: Mapped[str] = mapped_column(String(24), nullable=False)
    status: Mapped[str] = mapped_column(String(24), default="COLLECTING", nullable=False)
    host_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    allow_suggestions: Mapped[bool] = mapped_column(default=True, nullable=False)
    allow_comments: Mapped[bool] = mapped_column(default=True, nullable=False)
    hide_results: Mapped[bool] = mapped_column(default=False, nullable=False)
    deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    # VETO 2.0
    invite_code: Mapped[str | None] = mapped_column(String(12), unique=True, index=True, nullable=True)
    template: Mapped[str] = mapped_column(String(40), default="", nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    participants = relationship("Participant", back_populates="room", cascade="all, delete-orphan")
    options = relationship("Option", back_populates="room", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="room", cascade="all, delete-orphan")
    rounds = relationship(
        "Round", back_populates="room", cascade="all, delete-orphan", order_by="Round.number"
    )

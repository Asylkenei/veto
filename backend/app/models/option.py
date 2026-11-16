from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base
from app.models._base import utcnow


class Option(Base):
    __tablename__ = "options"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    room_id: Mapped[str] = mapped_column(ForeignKey("rooms.id", ondelete="CASCADE"), index=True)
    author_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    status: Mapped[str] = mapped_column(String(24), default="PENDING", nullable=False)
    rejection_reason: Mapped[str] = mapped_column(Text, default="", nullable=False)
    # VETO 2.0 — link to the places catalogue (nullable: most options are free text)
    place_id: Mapped[str | None] = mapped_column(ForeignKey("places.id"), nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=True)
    # VETO 2.1 — manual order set by the organiser, and a cached topical photo
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    image_url: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    image_credit: Mapped[str] = mapped_column(String(300), default="", nullable=False)
    room = relationship("Room", back_populates="options")
    author = relationship("User")

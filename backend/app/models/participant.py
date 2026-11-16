from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base


class Participant(Base):
    __tablename__ = "participants"
    __table_args__ = (
        UniqueConstraint("room_id", "user_id", name="uq_room_participant"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    room_id: Mapped[str] = mapped_column(
        ForeignKey("rooms.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    role: Mapped[str] = mapped_column(String(24), default="PARTICIPANT")
    room = relationship("Room", back_populates="participants")
    user = relationship("User")

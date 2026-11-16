from datetime import date, datetime
from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base
from app.models._base import utcnow


class PlaceCategory(Base):
    __tablename__ = "place_categories"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)  # slug
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    icon: Mapped[str] = mapped_column(String(32), default="map-pin", nullable=False)
    sort: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class Place(Base):
    __tablename__ = "places"
    id: Mapped[str] = mapped_column(String(48), primary_key=True)  # stable slug
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    city: Mapped[str] = mapped_column(String(80), default="", nullable=False)  # "" = any city
    category_id: Mapped[str] = mapped_column(ForeignKey("place_categories.id"), index=True)
    summary: Mapped[str] = mapped_column(Text, default="", nullable=False)
    why_visit: Mapped[str] = mapped_column(Text, default="", nullable=False)
    fact: Mapped[str] = mapped_column(Text, default="", nullable=False)
    image_url: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    image_credit: Mapped[str] = mapped_column(String(300), default="", nullable=False)
    photo_query: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    category = relationship("PlaceCategory")


class UserPlaceHistory(Base):
    """Real history: a row is written every time the user puts a place into a decision."""
    __tablename__ = "user_place_history"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    place_id: Mapped[str] = mapped_column(ForeignKey("places.id", ondelete="CASCADE"), index=True)
    room_id: Mapped[str | None] = mapped_column(ForeignKey("rooms.id", ondelete="SET NULL"), nullable=True)
    action: Mapped[str] = mapped_column(String(16), default="added", nullable=False)  # added | won
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class UserVisitedPlace(Base):
    __tablename__ = "user_visited_places"
    __table_args__ = (UniqueConstraint("user_id", "place_id", name="uq_visited"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    place_id: Mapped[str] = mapped_column(ForeignKey("places.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class SavedPlace(Base):
    __tablename__ = "saved_places"
    __table_args__ = (UniqueConstraint("user_id", "place_id", name="uq_saved"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    place_id: Mapped[str] = mapped_column(ForeignKey("places.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class DailyPlaceRecommendation(Base):
    __tablename__ = "daily_place_recommendations"
    __table_args__ = (UniqueConstraint("user_id", "day", name="uq_daily_place"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    day: Mapped[date] = mapped_column(Date, nullable=False)
    place_id: Mapped[str] = mapped_column(ForeignKey("places.id", ondelete="CASCADE"))

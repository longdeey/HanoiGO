from datetime import UTC, date, datetime, time
from uuid import uuid4

from geoalchemy2 import Geography
from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, Time
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.db.base import Base


def new_id() -> str:
    return str(uuid4())


def now_utc() -> datetime:
    return datetime.now(UTC)


class Place(Base):
    __tablename__ = "places"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    name_vi: Mapped[str] = mapped_column(String(200))
    name_en: Mapped[str] = mapped_column(String(200))
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    location = mapped_column(Geography(geometry_type="POINT", srid=4326), nullable=False)
    category: Mapped[str] = mapped_column(String(50), index=True)
    tags: Mapped[list[str]] = mapped_column(JSONB, default=list)
    description_vi: Mapped[str] = mapped_column(Text, default="")
    description_en: Mapped[str] = mapped_column(Text, default="")
    average_cost: Mapped[int] = mapped_column(Integer, default=0)
    entrance_fee: Mapped[int] = mapped_column(Integer, default=0)
    average_visit_minutes: Mapped[int] = mapped_column(Integer)
    indoor: Mapped[bool] = mapped_column(Boolean, default=False)
    outdoor: Mapped[bool] = mapped_column(Boolean, default=False)
    experience_type: Mapped[str] = mapped_column(String(50))
    crowd_level: Mapped[str] = mapped_column(String(20), default="medium")
    local_score: Mapped[int] = mapped_column(Integer, default=50)
    opening_hours: Mapped[dict[str, list[list[str]]]] = mapped_column(JSONB)
    special_closed_dates: Mapped[list[str]] = mapped_column(JSONB, default=list)
    available_from: Mapped[date | None] = mapped_column(Date)
    available_until: Mapped[date | None] = mapped_column(Date)
    annual_month: Mapped[int | None] = mapped_column(Integer)
    annual_day: Mapped[int | None] = mapped_column(Integer)
    annual_duration_days: Mapped[int] = mapped_column(Integer, default=1)
    # "solar" or "lunar": which calendar annual_month/annual_day refer to.
    annual_calendar: Mapped[str] = mapped_column(String(10), default="solar", server_default="solar")
    highlight_level: Mapped[str] = mapped_column(String(20), default="standard")
    best_time_slots: Mapped[list[str]] = mapped_column(JSONB, default=list)
    suitable_for: Mapped[list[str]] = mapped_column(JSONB, default=list)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    price_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    hours_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    price_source: Mapped[str | None] = mapped_column(Text)
    hours_source: Mapped[str | None] = mapped_column(Text)
    booking_source: Mapped[str | None] = mapped_column(Text)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    source: Mapped[str] = mapped_column(String(200), default="seed")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc
    )
    reviews: Mapped[list["PlaceReview"]] = relationship(
        back_populates="place", cascade="all, delete-orphan",
        order_by="PlaceReview.created_at.desc()",
    )


class PlaceReview(Base):
    __tablename__ = "place_reviews"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    place_id: Mapped[str] = mapped_column(ForeignKey("places.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    author_name: Mapped[str] = mapped_column(String(80))
    rating: Mapped[int] = mapped_column(Integer)
    comment: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, index=True)
    place: Mapped[Place] = relationship(back_populates="reviews")
    user: Mapped["User | None"] = relationship(back_populates="reviews")


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    display_name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str | None] = mapped_column(String(254), unique=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(30), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    auth_token_hash: Mapped[str | None] = mapped_column(String(64), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    reviews: Mapped[list[PlaceReview]] = relationship(back_populates="user")


class TripRequest(Base):
    __tablename__ = "trip_requests"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    owner_token_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    share_token_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    language: Mapped[str] = mapped_column(String(2), default="en")
    start_date: Mapped[date | None] = mapped_column(Date)
    days: Mapped[int] = mapped_column(Integer)
    traveler_count: Mapped[int] = mapped_column(Integer)
    budget_total: Mapped[int] = mapped_column(Integer)
    start_location: Mapped[str] = mapped_column(String(200))
    start_latitude: Mapped[float] = mapped_column(Float)
    start_longitude: Mapped[float] = mapped_column(Float)
    travel_mode: Mapped[str] = mapped_column(String(30))
    travel_radius_mode: Mapped[str] = mapped_column(String(30))
    pace: Mapped[str] = mapped_column(String(30))
    interests: Mapped[list[str]] = mapped_column(JSONB)
    experience_preferences: Mapped[list[str]] = mapped_column(JSONB, default=list)
    dietary_preferences: Mapped[list[str]] = mapped_column(JSONB, default=list)
    special_requirements: Mapped[list[str]] = mapped_column(JSONB, default=list)
    daily_start_time: Mapped[time] = mapped_column(Time)
    daily_end_time: Mapped[time] = mapped_column(Time)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    itineraries: Mapped[list["Itinerary"]] = relationship(back_populates="trip", cascade="all, delete-orphan")


class Itinerary(Base):
    __tablename__ = "itineraries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    trip_request_id: Mapped[str] = mapped_column(ForeignKey("trip_requests.id", ondelete="CASCADE"))
    option_type: Mapped[str] = mapped_column(String(30))
    match_score: Mapped[int] = mapped_column(Integer)
    estimated_total_cost: Mapped[int] = mapped_column(Integer)
    estimated_total_distance_km: Mapped[float] = mapped_column(Float)
    estimated_total_travel_minutes: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(30), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    trip: Mapped[TripRequest] = relationship(back_populates="itineraries")
    days: Mapped[list["ItineraryDay"]] = relationship(back_populates="itinerary", cascade="all, delete-orphan", order_by="ItineraryDay.day_number")


class ItineraryDay(Base):
    __tablename__ = "itinerary_days"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    itinerary_id: Mapped[str] = mapped_column(ForeignKey("itineraries.id", ondelete="CASCADE"))
    day_number: Mapped[int] = mapped_column(Integer)
    date: Mapped[date | None] = mapped_column(Date)
    theme: Mapped[str] = mapped_column(String(100), default="Hanoi discovery")
    estimated_cost: Mapped[int] = mapped_column(Integer)
    estimated_distance_km: Mapped[float] = mapped_column(Float)
    estimated_travel_minutes: Mapped[int] = mapped_column(Integer)
    itinerary: Mapped[Itinerary] = relationship(back_populates="days")
    items: Mapped[list["ItineraryItem"]] = relationship(back_populates="day", cascade="all, delete-orphan", order_by="ItineraryItem.sequence")


class ItineraryItem(Base):
    __tablename__ = "itinerary_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    itinerary_day_id: Mapped[str] = mapped_column(ForeignKey("itinerary_days.id", ondelete="CASCADE"))
    place_id: Mapped[str] = mapped_column(ForeignKey("places.id"))
    sequence: Mapped[int] = mapped_column(Integer)
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)
    estimated_visit_minutes: Mapped[int] = mapped_column(Integer)
    estimated_cost: Mapped[int] = mapped_column(Integer)
    travel_from_previous_minutes: Mapped[int] = mapped_column(Integer)
    travel_from_previous_km: Mapped[float] = mapped_column(Float)
    travel_cost: Mapped[int] = mapped_column(Integer, default=0)
    recommendation_score: Mapped[int] = mapped_column(Integer)
    recommendation_reasons: Mapped[list[str]] = mapped_column(JSONB, default=list)
    locked: Mapped[bool] = mapped_column(Boolean, default=False)
    day: Mapped[ItineraryDay] = relationship(back_populates="items")
    place: Mapped[Place] = relationship()

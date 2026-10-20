from dataclasses import dataclass
from datetime import date, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.domain.planner.config import HANOI_LAT_MAX, HANOI_LAT_MIN, HANOI_LON_MAX, HANOI_LON_MIN


class StartLocation(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)

    @model_validator(mode="after")
    def check_hanoi_bounds(self) -> "StartLocation":
        if not (HANOI_LAT_MIN <= self.latitude <= HANOI_LAT_MAX
                and HANOI_LON_MIN <= self.longitude <= HANOI_LON_MAX):
            raise ValueError("Starting point must be within Hanoi")
        return self


class TripConstraints(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    language: Literal["en", "vi"] = "en"
    start_date: date | None = Field(default=None, alias="startDate")
    days: int = Field(ge=1, le=14)
    traveler_count: int = Field(alias="travelerCount", ge=1, le=20)
    budget_total: int = Field(alias="budgetTotal", gt=0)
    start_location: StartLocation = Field(alias="startLocation")
    interests: list[str] = Field(min_length=1)
    travel_mode: Literal["walking", "motorbike", "car", "grab", "walking_grab"] = Field(
        default="walking_grab", alias="travelMode"
    )
    travel_radius_mode: Literal["near", "balanced", "wide", "outskirts"] = Field(
        default="balanced", alias="travelRadiusMode"
    )
    pace: Literal["relaxed", "balanced", "active"] = "balanced"
    experience_preferences: list[str] = Field(default_factory=list, alias="experiencePreferences")
    dietary_preferences: list[str] = Field(default_factory=list, alias="dietaryPreferences")
    special_requirements: list[str] = Field(default_factory=list, alias="specialRequirements")
    daily_start_time: time = Field(default=time(8), alias="dailyStartTime")
    daily_end_time: time = Field(default=time(21), alias="dailyEndTime")

    @model_validator(mode="after")
    def check_daily_window(self) -> "TripConstraints":
        if self.daily_end_time <= self.daily_start_time:
            raise ValueError("Daily end time must be after start time")
        return self


@dataclass(frozen=True)
class PlaceCandidate:
    id: str
    slug: str
    latitude: float
    longitude: float
    category: str
    tags: tuple[str, ...]
    average_cost: int
    entrance_fee: int
    average_visit_minutes: int
    indoor: bool
    outdoor: bool
    local_score: int
    opening_hours: dict[str, list[list[str]]]
    suitable_for: tuple[str, ...]
    is_active: bool = True
    experience_type: str = "popular"
    crowd_level: str = "medium"
    special_closed_dates: tuple[str, ...] = ()
    available_from: date | None = None
    available_until: date | None = None
    annual_month: int | None = None
    annual_day: int | None = None
    annual_duration_days: int = 1
    annual_calendar: Literal["solar", "lunar"] = "solar"
    highlight_level: Literal["standard", "notable", "must_see"] = "standard"
    rating_average: float = 0.0
    rating_count: int = 0
    # Shown name (Vietnamese, then English); tells a dessert shop from a restaurant.
    name: str = ""


def candidate_from_place(place: object) -> PlaceCandidate:
    from app.infrastructure.db.models import Place

    if not isinstance(place, Place):
        raise TypeError("Expected a Place model")
    ratings = [review.rating for review in place.reviews]
    return PlaceCandidate(
        id=place.id, slug=place.slug, latitude=place.latitude, longitude=place.longitude,
        category=place.category, tags=tuple(place.tags), average_cost=place.average_cost,
        entrance_fee=place.entrance_fee, average_visit_minutes=place.average_visit_minutes,
        indoor=place.indoor, outdoor=place.outdoor, local_score=place.local_score,
        opening_hours=place.opening_hours, suitable_for=tuple(place.suitable_for),
        is_active=place.is_active,
        experience_type=place.experience_type, crowd_level=place.crowd_level,
        special_closed_dates=tuple(place.special_closed_dates),
        available_from=place.available_from, available_until=place.available_until,
        annual_month=place.annual_month, annual_day=place.annual_day,
        annual_duration_days=place.annual_duration_days,
        annual_calendar=place.annual_calendar or "solar",
        highlight_level=place.highlight_level,
        rating_average=sum(ratings) / len(ratings) if ratings else 0.0,
        rating_count=len(ratings),
        name=f"{place.name_vi} {place.name_en}",
    )

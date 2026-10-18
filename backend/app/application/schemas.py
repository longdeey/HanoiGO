from typing import Literal

from pydantic import BaseModel, Field


class BudgetResponse(BaseModel):
    attractions: int
    food: int
    transport: int
    others: int
    total: int
    remaining: int


class PlaceStoryResponse(BaseModel):
    """Short link from a place to its history/culture story."""
    slug: str
    title: str
    teaser: str
    readingMinutes: int = Field(ge=1)


class PlaceResponse(BaseModel):
    id: str
    slug: str
    name: str
    category: str
    latitude: float
    longitude: float
    averageCost: int
    entranceFee: int
    averageVisitMinutes: int
    indoor: bool
    outdoor: bool
    priceVerified: bool
    hoursVerified: bool
    priceSource: str | None
    hoursSource: str | None
    highlightLevel: Literal["standard", "notable", "must_see"] = "standard"
    availableFrom: str | None = None
    availableUntil: str | None = None
    informationSource: str | None = None
    annual: bool = False
    ratingAverage: float = Field(default=0, ge=0, le=5)
    ratingCount: int = Field(default=0, ge=0)
    comments: list["PlaceCommentResponse"] = Field(default_factory=list)
    bookingSource: str | None = None
    story: PlaceStoryResponse | None = None


class PlaceCommentResponse(BaseModel):
    id: str
    authorName: str
    rating: int = Field(ge=1, le=5)
    comment: str
    createdAt: str


class PlaceReviewRequest(BaseModel):
    authorName: str | None = Field(default=None, min_length=2, max_length=80)
    rating: int = Field(ge=1, le=5)
    comment: str = Field(min_length=2, max_length=1000)


class RegisterRequest(BaseModel):
    displayName: str = Field(min_length=2, max_length=100)
    identifier: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    identifier: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=8, max_length=128)


class UserResponse(BaseModel):
    id: str
    displayName: str
    email: str | None = None
    phone: str | None = None


class AuthResponse(BaseModel):
    token: str
    user: UserResponse


class ItemResponse(BaseModel):
    id: str
    sequence: int
    place: PlaceResponse
    startTime: str
    endTime: str
    visitMinutes: int
    travelMinutes: int
    travelKm: float
    estimatedCost: int
    travelCost: int
    recommendationScore: int
    reasons: list[str]
    locked: bool


class LockRequest(BaseModel):
    locked: bool


class DayResponse(BaseModel):
    dayNumber: int
    date: str
    theme: str
    estimatedCost: int
    estimatedDistanceKm: float
    estimatedTravelMinutes: int
    items: list[ItemResponse]


class OptionResponse(BaseModel):
    id: str
    type: str
    matchScore: int = Field(ge=0, le=100)
    estimatedTotalCost: int
    estimatedTotalDistanceKm: float
    estimatedTotalTravelMinutes: int
    totalPlaces: int
    budget: BudgetResponse
    days: list[DayResponse]
    # Smallest share of the budget this option should use (0.95 Best Match, 0.90
    # Explore More, None for Budget Friendly) and whether the plan reaches it.
    budgetTargetShare: float | None = None
    budgetTargetMet: bool = True


class SeasonalHighlightResponse(BaseModel):
    date: str
    place: PlaceResponse


class HolidayResponse(BaseModel):
    key: str
    name: str
    kind: Literal["public_holiday", "traditional", "festival", "observance"]
    isPublicHoliday: bool
    startDate: str
    endDate: str
    # The trip dates this holiday falls on; empty for the calendar endpoint.
    tripDates: list[str] = Field(default_factory=list)
    description: str
    suggestion: str
    relatedPlaces: list[PlaceResponse] = Field(default_factory=list)


class StorySummaryResponse(BaseModel):
    slug: str
    title: str
    teaser: str
    imageKey: str | None = None
    readingMinutes: int = Field(ge=1)
    themes: list[str] = Field(default_factory=list)
    featured: bool = False


class StorySectionResponse(BaseModel):
    heading: str
    body: str


class StoryTimelineResponse(BaseModel):
    year: str
    text: str


class StorySourceResponse(BaseModel):
    title: str
    url: str


class NearbyStoryResponse(StorySummaryResponse):
    distanceKm: float = Field(ge=0)


class StoryResponse(StorySummaryResponse):
    sections: list[StorySectionResponse]
    timeline: list[StoryTimelineResponse] = Field(default_factory=list)
    tips: list[str] = Field(default_factory=list)
    sources: list[StorySourceResponse]
    # The landmark the story is about, for directions and "plan from here".
    place: PlaceResponse | None = None
    # Other stories within walking distance of this one, nearest first.
    nearby: list[NearbyStoryResponse] = Field(default_factory=list)


class TripResponse(BaseModel):
    tripId: str
    language: Literal["en", "vi"]
    travelMode: Literal["walking", "motorbike", "car", "grab", "walking_grab"]
    options: list[OptionResponse]
    seasonalHighlights: list[SeasonalHighlightResponse] = Field(default_factory=list)
    holidays: list[HolidayResponse] = Field(default_factory=list)
    stayOptions: list[PlaceResponse] = Field(default_factory=list)
    ownerToken: str | None = None
    startLatitude: float
    startLongitude: float


class ShareResponse(BaseModel):
    shareToken: str


class MapCoordinate(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class MapRouteRequest(BaseModel):
    points: list[MapCoordinate] = Field(min_length=1, max_length=12)


class MapRouteResponse(BaseModel):
    coordinates: list[MapCoordinate]
    roadDistanceKm: float | None
    roadDurationMinutes: int | None
    source: Literal["osrm", "direct"]
    warning: str | None = None


class ErrorBody(BaseModel):
    code: str
    message: str
    details: dict[str, object] | list[str] | None = None


class ErrorResponse(BaseModel):
    success: bool = False
    error: ErrorBody


class ReplaceRequest(BaseModel):
    reason: Literal[
        "TOO_FAR", "TOO_EXPENSIVE", "NOT_INTERESTED", "ALREADY_VISITED",
        "PREFER_INDOOR", "PREFER_LOCAL",
    ]


class OptimizeRequest(BaseModel):
    strategy: Literal[
        "REDUCE_COST", "REDUCE_DISTANCE", "PREFER_INDOOR", "MORE_LOCAL",
        "MORE_FOOD", "MORE_CHECKIN", "REGENERATE_DAY",
    ]
    dayNumber: int | None = Field(default=None, ge=1)

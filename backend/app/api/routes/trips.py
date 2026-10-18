from datetime import date, datetime, timedelta
from functools import lru_cache
from typing import Annotated, Literal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from sqlalchemy.orm import Session

from app.application.access import authorize_trip, rotate_share_token
from app.application.auth import current_user, login, public_user, register
from app.application.modify import optimize_itinerary, replace_place, set_place_lock
from app.application.rate_limit import FixedWindowLimiter, RateLimited
from app.application.schemas import (
    AuthResponse,
    HolidayResponse,
    LockRequest,
    LoginRequest,
    MapCoordinate,
    MapRouteRequest,
    MapRouteResponse,
    OptimizeRequest,
    PlaceResponse,
    PlaceReviewRequest,
    RegisterRequest,
    ReplaceRequest,
    ShareResponse,
    StoryResponse,
    StorySummaryResponse,
    TripResponse,
)
from app.application.stories import list_stories, story_detail
from app.application.trips import create_trip, get_place, get_trip, holiday_responses
from app.core.config import Settings, get_settings
from app.domain.planner.types import TripConstraints
from app.infrastructure.db.models import Place, PlaceReview
from app.infrastructure.db.session import get_session
from app.infrastructure.maps.geocoding import (
    GeocodingProvider,
    LocationNotFound,
    NominatimGeocoder,
)
from app.infrastructure.maps.provider import MapProvider, OSRMMapProvider
from app.infrastructure.weather.provider import OpenMeteoWeatherProvider, WeatherProvider

router = APIRouter(prefix="/api/v1", tags=["trips"])
DatabaseSession = Annotated[Session, Depends(get_session)]


def get_weather_provider() -> WeatherProvider:
    return OpenMeteoWeatherProvider()


WeatherService = Annotated[WeatherProvider, Depends(get_weather_provider)]


def get_map_provider() -> MapProvider:
    return OSRMMapProvider(get_settings().route_api_url)


MapService = Annotated[MapProvider, Depends(get_map_provider)]
generate_limiter = FixedWindowLimiter()


@router.post("/auth/register", response_model=AuthResponse)
def register_user(request: RegisterRequest, session: DatabaseSession) -> AuthResponse:
    token, user = register(session, request.displayName, request.identifier, request.password)
    return AuthResponse(token=token, user=public_user(user))


@router.post("/auth/login", response_model=AuthResponse)
def login_user(request: LoginRequest, session: DatabaseSession) -> AuthResponse:
    token, user = login(session, request.identifier, request.password)
    return AuthResponse(token=token, user=public_user(user))


@router.get("/auth/me", response_model=AuthResponse)
def fetch_current_user(
    session: DatabaseSession, authorization: Annotated[str | None, Header()] = None,
) -> AuthResponse:
    user = current_user(session, authorization)
    if user is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    return AuthResponse(token=authorization[7:], user=public_user(user))


@lru_cache
def get_geocoder() -> GeocodingProvider:
    settings = get_settings()
    return NominatimGeocoder(settings.geocoding_api_url, settings.geocoding_user_agent)


GeocodingService = Annotated[GeocodingProvider, Depends(get_geocoder)]


def guard_generation(request: Request, settings: Annotated[Settings, Depends(get_settings)]) -> None:
    if settings.app_env != "production":
        return
    host = request.client.host if request.client is not None else "unknown"
    retry_after = generate_limiter.check(
        host, limit=settings.generate_rate_limit_per_minute, window_seconds=60,
    )
    if retry_after:
        raise RateLimited(retry_after)


@router.post("/routes/geometry", response_model=MapRouteResponse)
def road_route(request: MapRouteRequest, provider: MapService) -> MapRouteResponse:
    points = tuple((point.latitude, point.longitude) for point in request.points)
    route = provider.road_geometry(points)
    return MapRouteResponse(
        coordinates=[MapCoordinate(latitude=lat, longitude=lon) for lat, lon in route.coordinates],
        roadDistanceKm=route.distance_km, roadDurationMinutes=route.duration_minutes,
        source=route.source, warning=route.warning,
    )


@router.get("/locations/resolve")
def resolve_location(
    query: Annotated[str, Query(min_length=3, max_length=200)], provider: GeocodingService,
) -> dict[str, str | float]:
    result = provider.resolve(query)
    if result is None:
        raise LocationNotFound("Could not find that starting point in Hanoi. Try a more specific address.")
    return {"name": result.name, "latitude": result.latitude, "longitude": result.longitude}


@router.post("/trips/generate", response_model=TripResponse)
def generate_trip(
    request: TripConstraints, session: DatabaseSession, weather: WeatherService,
    _rate_guard: Annotated[None, Depends(guard_generation)],
) -> TripResponse:
    today = datetime.now(ZoneInfo("Asia/Ho_Chi_Minh")).date()
    day = request.start_date or today
    forecast = weather.forecast(request.start_location.latitude, request.start_location.longitude, day)
    return create_trip(session, request, forecast.afternoon_rain_probability)


@router.get("/weather")
def fetch_weather(
    latitude: float, longitude: float, weather: WeatherService,
    day: date | None = None,
) -> dict[str, object]:
    forecast_date = day or datetime.now(ZoneInfo("Asia/Ho_Chi_Minh")).date()
    forecast = weather.forecast(latitude, longitude, forecast_date)
    return {
        "date": forecast.date.isoformat(), "available": forecast.available,
        "afternoonRainProbability": forecast.afternoon_rain_probability,
        "warning": forecast.warning,
    }


@router.get("/holidays", response_model=list[HolidayResponse])
def list_holidays(
    session: DatabaseSession,
    start: date | None = None,
    days: Annotated[int, Query(ge=1, le=400)] = 365,
    language: Literal["en", "vi"] = "vi",
) -> list[HolidayResponse]:
    """Vietnamese holidays and Hanoi festivals from ``start`` (default: today) for ``days`` days."""
    first = start or datetime.now(ZoneInfo("Asia/Ho_Chi_Minh")).date()
    return holiday_responses(
        session, first, first + timedelta(days=days - 1), language, with_trip_dates=False,
    )


@router.get("/stories", response_model=list[StorySummaryResponse])
def fetch_stories(language: Literal["en", "vi"] = "vi") -> list[StorySummaryResponse]:
    """History and culture stories about Hanoi landmarks, featured ones first."""
    return list_stories(language)


@router.get("/stories/{slug}", response_model=StoryResponse)
def fetch_story(
    slug: str, session: DatabaseSession, language: Literal["en", "vi"] = "vi",
) -> StoryResponse:
    story = story_detail(session, slug, language)
    if story is None:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


@router.get("/trips/{trip_id}", response_model=TripResponse)
def fetch_trip(
    trip_id: str, session: DatabaseSession,
    authorization: Annotated[str | None, Header()] = None,
) -> TripResponse:
    if authorize_trip(session, trip_id, authorization, owner=False) is None:
        raise HTTPException(status_code=404, detail="Trip not found")
    trip = get_trip(session, trip_id)
    if trip is None:
        raise HTTPException(status_code=404, detail="Trip not found")
    return trip


@router.post("/trips/{trip_id}/share", response_model=ShareResponse)
def share_trip(
    trip_id: str, session: DatabaseSession,
    authorization: Annotated[str | None, Header()] = None,
) -> ShareResponse:
    trip = authorize_trip(session, trip_id, authorization, owner=True)
    if trip is None:
        raise HTTPException(status_code=404, detail="Trip not found")
    return ShareResponse(shareToken=rotate_share_token(session, trip))


@router.get("/places/{place_id}", response_model=PlaceResponse)
def fetch_place(
    place_id: str, session: DatabaseSession, language: Literal["en", "vi"] = "en",
) -> PlaceResponse:
    place = get_place(session, place_id, language)
    if place is None:
        raise HTTPException(status_code=404, detail="Place not found")
    return place


@router.post("/places/{place_id}/reviews", response_model=PlaceResponse)
def review_place(
    place_id: str, request: PlaceReviewRequest, session: DatabaseSession,
    authorization: Annotated[str | None, Header()] = None,
) -> PlaceResponse:
    user = current_user(session, authorization)
    if user is None:
        raise HTTPException(status_code=401, detail="Sign in before posting a review")
    place = session.get(Place, place_id)
    if place is None or not place.is_active:
        raise HTTPException(status_code=404, detail="Place not found")
    session.add(PlaceReview(
        place_id=place.id, user_id=user.id, author_name=user.display_name,
        rating=request.rating, comment=request.comment,
    ))
    session.commit()
    refreshed = get_place(session, place_id)
    if refreshed is None:
        raise HTTPException(status_code=404, detail="Place not found")
    return refreshed


@router.post(
    "/trips/{trip_id}/itineraries/{itinerary_id}/items/{item_id}/replace",
    response_model=TripResponse,
)
def replace_itinerary_place(
    trip_id: str, itinerary_id: str, item_id: str,
    request: ReplaceRequest, session: DatabaseSession,
    authorization: Annotated[str | None, Header()] = None,
) -> TripResponse:
    if authorize_trip(session, trip_id, authorization, owner=True) is None:
        raise HTTPException(status_code=404, detail="Trip not found")
    return replace_place(session, trip_id, itinerary_id, item_id, request.reason)


@router.post(
    "/trips/{trip_id}/itineraries/{itinerary_id}/items/{item_id}/lock",
    response_model=TripResponse,
)
def lock_itinerary_place(
    trip_id: str, itinerary_id: str, item_id: str,
    request: LockRequest, session: DatabaseSession,
    authorization: Annotated[str | None, Header()] = None,
) -> TripResponse:
    if authorize_trip(session, trip_id, authorization, owner=True) is None:
        raise HTTPException(status_code=404, detail="Trip not found")
    return set_place_lock(session, trip_id, itinerary_id, item_id, request.locked)


@router.post("/trips/{trip_id}/itineraries/{itinerary_id}/optimize", response_model=TripResponse)
def optimize_trip(
    trip_id: str, itinerary_id: str, request: OptimizeRequest, session: DatabaseSession,
    authorization: Annotated[str | None, Header()] = None,
) -> TripResponse:
    if authorize_trip(session, trip_id, authorization, owner=True) is None:
        raise HTTPException(status_code=404, detail="Trip not found")
    return optimize_itinerary(session, trip_id, itinerary_id, request.strategy, request.dayNumber)

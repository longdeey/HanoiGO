from datetime import date, time, timedelta
from math import asin, cos, radians, sin, sqrt

from app.domain.holidays import annual_window_contains
from app.domain.planner.config import TRAVEL_MODE_DISTANCE_CAP_KM, TRAVEL_RADIUS_KM
from app.domain.planner.types import PlaceCandidate, TripConstraints
from app.domain.stories import duplicate_site_entries

# The place categories and tags each traveler interest covers.
INTEREST_ALIASES: dict[str, set[str]] = {
    "museum": {"museum"},
    "food": {"food", "coffee"},
    "coffee": {"coffee", "food"},
    "history": {"history", "museum"},
    "park": {"park", "nature", "hiking"},
    "nature": {"nature", "park", "hiking"},
    "hiking": {"hiking", "nature", "park"},
    "craft": {"craft", "local_experience"},
    "festival": {"festival"},
    "shopping": {"shopping"},
    "art": {"art", "museum"},
    "local_culture": {"local_culture", "local_experience"},
}


def serves_interest(place: PlaceCandidate, interest: str) -> bool:
    """Whether a place is something a traveler with this interest came for."""
    terms = INTEREST_ALIASES.get(interest, {interest})
    if interest in {"food", "coffee"}:
        return place.category in terms
    return place.category in terms or bool(set(place.tags) & (terms - {"food", "coffee"}))


def radius_for_constraints(constraints: TripConstraints) -> float:
    """Return a preset radius bounded by what the selected vehicle can cover."""
    configured = TRAVEL_RADIUS_KM[constraints.travel_radius_mode]
    return min(configured, TRAVEL_MODE_DISTANCE_CAP_KM[constraints.travel_mode])


def daily_distance_cap_km(constraints: TripConstraints) -> float:
    """Maximum scheduled route distance for one day and one travel mode."""
    return TRAVEL_MODE_DISTANCE_CAP_KM[constraints.travel_mode]


def distance_km(lat_a: float, lon_a: float, lat_b: float, lon_b: float) -> float:
    lat1, lon1, lat2, lon2 = map(radians, (lat_a, lon_a, lat_b, lon_b))
    delta_lat = lat2 - lat1
    delta_lon = lon2 - lon1
    arc = 2 * asin(sqrt(sin(delta_lat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(delta_lon / 2) ** 2))
    return 6371.0088 * arc


def is_available_on(place: PlaceCandidate, day: date) -> bool:
    if day.isoformat() in place.special_closed_dates:
        return False
    if place.annual_month is not None and place.annual_day is not None:
        return annual_window_contains(
            place.annual_calendar, place.annual_month, place.annual_day,
            place.annual_duration_days, day,
        )
    if place.available_from is not None and day < place.available_from:
        return False
    return place.available_until is None or day <= place.available_until


def fits_opening_hours(place: PlaceCandidate, constraints: TripConstraints) -> bool:
    if (
        place.available_from is not None or place.available_until is not None
        or place.annual_month is not None
    ) and not constraints.start_date:
        return False
    days = (
        [(constraints.start_date + timedelta(days=offset)) for offset in range(constraints.days)]
        if constraints.start_date else list(range(7))
    )
    for day in days:
        if constraints.start_date and not is_available_on(place, day):
            continue
        weekday = day.weekday() if constraints.start_date else day
        for opening, closing in place.opening_hours.get(str(weekday), []):
            opening_time = time.fromisoformat(opening)
            closing_time = time.fromisoformat(closing)
            start = max(opening_time, constraints.daily_start_time)
            end = min(closing_time, constraints.daily_end_time)
            available_minutes = (end.hour * 60 + end.minute) - (start.hour * 60 + start.minute)
            if available_minutes >= place.average_visit_minutes:
                return True
    return False


def _is_reachable_option(place: PlaceCandidate, constraints: TripConstraints) -> bool:
    return (
        place.is_active
        # Lodging is surfaced as a stay recommendation, not as a timed visit.
        and place.category != "accommodation"
        and (place.average_cost + place.entrance_fee) * constraints.traveler_count
        <= constraints.budget_total
        and distance_km(
            constraints.start_location.latitude, constraints.start_location.longitude,
            place.latitude, place.longitude,
        ) <= radius_for_constraints(constraints)
        and fits_opening_hours(place, constraints)
    )


def free_stroll_candidates(
    places: list[PlaceCandidate], constraints: TripConstraints,
) -> list[PlaceCandidate]:
    """Free parks and lakes within reach, whatever the traveler's interests.

    They are only used to fill time between activities that would otherwise be
    spent waiting, for example between meals on a food-only trip.
    """
    return [
        place for place in places
        if place.category in {"park", "nature"}
        and place.average_cost + place.entrance_fee == 0
        and _is_reachable_option(place, constraints)
    ]


def drop_duplicate_sites(places: list[PlaceCandidate]) -> list[PlaceCandidate]:
    """Keep one catalog entry per site.

    The curated catalog and the OpenStreetMap import can both list one site
    (the Imperial Citadel and its Đoan Môn gate, the mausoleum and Ba Đình
    Square). When the main entry is available the secondary ones are dropped,
    so a day never visits the same place twice under two names.
    """
    present = {place.slug for place in places}
    duplicates = duplicate_site_entries()
    return [place for place in places if duplicates.get(place.slug) not in present]


def filter_candidates(places: list[PlaceCandidate], constraints: TripConstraints) -> list[PlaceCandidate]:
    result = drop_duplicate_sites([place for place in places if _is_reachable_option(place, constraints)])
    # Interests are a hard thematic focus for the MVP. Keep meals available so
    # a museum-only or hiking-only day remains practical, but do not dilute a
    # single interest with unrelated attractions.
    interests = set(constraints.interests)
    if interests:
        focused_terms = set().union(*(INTEREST_ALIASES.get(interest, {interest}) for interest in interests))
        focus_tags = focused_terms - {"food", "coffee"}
        # Hanoi's must-see places stay whatever the interests: every day visits one.
        focused = [place for place in result if (
            place.category in focused_terms
            or bool(set(place.tags) & focus_tags)
            or place.category in {"food", "coffee"}
            or place.highlight_level == "must_see"
        )]
        # A narrow interest can be infeasible at a particular start/radius.
        # Keep the already validated catalog only when strict filtering would
        # make the requested number of days impossible.
        if len(focused) >= constraints.days:
            return focused
    return result

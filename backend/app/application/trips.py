from datetime import date, time, timedelta
from math import ceil

from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.application.access import new_token, token_digest
from app.application.schemas import (
    BudgetResponse,
    DayResponse,
    HolidayResponse,
    ItemResponse,
    OptionResponse,
    PlaceCommentResponse,
    PlaceResponse,
    PlaceStoryResponse,
    SeasonalHighlightResponse,
    TripResponse,
)
from app.domain.holidays import holidays_between
from app.domain.planner.config import BUDGET_TARGET_TOLERANCE, STAY_NEARBY_RADIUS_KM
from app.domain.planner.constraints import distance_km
from app.domain.planner.planner import PlannedItinerary, generate_options
from app.domain.planner.scheduling import PlannedDay, minute_of_day, opening_start
from app.domain.planner.types import TripConstraints, candidate_from_place
from app.domain.stories import story_for_place
from app.infrastructure.db.models import Itinerary, ItineraryDay, ItineraryItem, Place, TripRequest
from app.infrastructure.repositories.places import PlaceRepository


def _fill_day(day: ItineraryDay, planned_day: PlannedDay, locked_ids: set[str] | None = None) -> None:
    day.date = planned_day.date
    day.estimated_cost = planned_day.cost.total
    day.estimated_distance_km = planned_day.distance_km
    day.estimated_travel_minutes = planned_day.travel_minutes
    day.items.clear()
    for item in planned_day.items:
        day.items.append(ItineraryItem(
            place_id=item.place.id, sequence=item.sequence,
            start_time=_to_time(item.start_minute), end_time=_to_time(item.end_minute),
            estimated_visit_minutes=item.visit_minutes, estimated_cost=item.cost.total,
            travel_from_previous_minutes=item.travel_minutes,
            travel_from_previous_km=item.travel_km, travel_cost=item.travel_cost,
            recommendation_score=item.score, recommendation_reasons=list(item.reasons),
            locked=item.place.id in (locked_ids or set()),
        ))


def _set_totals(option: Itinerary, plan: PlannedItinerary) -> None:
    option.match_score = plan.match_score
    option.estimated_total_cost = plan.cost.total
    option.estimated_total_distance_km = plan.distance_km
    option.estimated_total_travel_minutes = plan.travel_minutes


def _apply_plan(option: Itinerary, plan: PlannedItinerary) -> None:
    locked_ids = {item.place_id for day in option.days for item in day.items if item.locked}
    _set_totals(option, plan)
    option.days.clear()
    for planned_day in plan.days:
        day = ItineraryDay(day_number=planned_day.day_number, theme="Hanoi discovery")
        option.days.append(day)
        _fill_day(day, planned_day, locked_ids)


def _apply_single_day(option: Itinerary, plan: PlannedItinerary, day_number: int) -> None:
    _set_totals(option, plan)
    existing = next(day for day in option.days if day.day_number == day_number)
    locked_ids = {item.place_id for item in existing.items if item.locked}
    _fill_day(existing, plan.days[day_number - 1], locked_ids)


def _store_option(trip: TripRequest, plan: PlannedItinerary) -> None:
    option = Itinerary(option_type=plan.option_type, status="active")
    trip.itineraries.append(option)
    _apply_plan(option, plan)


def _to_time(minute: int) -> time:
    return time(minute // 60, minute % 60)


def create_trip(
    session: Session, constraints: TripConstraints, rain_probability: float | None = None
) -> TripResponse:
    places = PlaceRepository(session).list_active()
    plans = generate_options(
        [candidate_from_place(place) for place in places], constraints, rain_probability
    )
    owner_token = new_token()
    trip = TripRequest(
        owner_token_hash=token_digest(owner_token),
        language=constraints.language, start_date=constraints.start_date,
        days=constraints.days, traveler_count=constraints.traveler_count,
        budget_total=constraints.budget_total, start_location=constraints.start_location.name,
        start_latitude=constraints.start_location.latitude,
        start_longitude=constraints.start_location.longitude,
        travel_mode=constraints.travel_mode, travel_radius_mode=constraints.travel_radius_mode,
        pace=constraints.pace, interests=constraints.interests,
        experience_preferences=constraints.experience_preferences,
        dietary_preferences=constraints.dietary_preferences,
        special_requirements=constraints.special_requirements,
        daily_start_time=constraints.daily_start_time,
        daily_end_time=constraints.daily_end_time,
    )
    session.add(trip)
    for plan in plans:
        _store_option(trip, plan)
    session.commit()
    response = get_trip(session, trip.id)
    assert response is not None
    return response.model_copy(update={"ownerToken": owner_token})


def _place_response(place: Place, language: str) -> PlaceResponse:
    reviews = list(place.reviews)
    rating_average = round(sum(review.rating for review in reviews) / len(reviews), 1) if reviews else 0
    return PlaceResponse(
        id=place.id, slug=place.slug,
        name=place.name_vi if language == "vi" else place.name_en,
        category=place.category, latitude=place.latitude, longitude=place.longitude,
        averageCost=place.average_cost, entranceFee=place.entrance_fee,
        averageVisitMinutes=place.average_visit_minutes,
        indoor=place.indoor, outdoor=place.outdoor,
        priceVerified=place.price_verified, hoursVerified=place.hours_verified,
        priceSource=place.price_source, hoursSource=place.hours_source,
        highlightLevel=place.highlight_level,
        availableFrom=place.available_from.isoformat() if place.available_from else None,
        availableUntil=place.available_until.isoformat() if place.available_until else None,
        informationSource=place.source if place.source.startswith("https://") else None,
        annual=place.annual_month is not None and place.annual_day is not None,
        ratingAverage=rating_average, ratingCount=len(reviews),
        comments=[PlaceCommentResponse(
            id=review.id, authorName=review.author_name, rating=review.rating,
            comment=review.comment, createdAt=review.created_at.isoformat(),
        ) for review in reviews[:5]],
        bookingSource=place.booking_source,
        story=_place_story(place.slug, language),
    )


def _place_story(place_slug: str, language: str) -> PlaceStoryResponse | None:
    story = story_for_place(place_slug)
    if story is None:
        return None
    text = story.text(language)
    return PlaceStoryResponse(
        slug=story.slug, title=text.title, teaser=text.teaser,
        readingMinutes=story.reading_minutes(language),
    )


def get_place(session: Session, place_id: str, language: str = "en") -> PlaceResponse | None:
    place = PlaceRepository(session).get(place_id)
    return _place_response(place, language) if place else None


def _seasonal_highlights(session: Session, trip: TripRequest) -> list[SeasonalHighlightResponse]:
    if trip.start_date is None:
        return []
    places = session.scalars(select(Place).where(
        Place.is_active.is_(True),
        or_(Place.available_from.is_not(None), Place.annual_month.is_not(None)),
    ))
    choices: list[tuple[int, str, SeasonalHighlightResponse]] = []
    for place in places:
        candidate = candidate_from_place(place)
        for offset in range(trip.days):
            visit_date = trip.start_date + timedelta(days=offset)
            if opening_start(
                candidate, visit_date, minute_of_day(trip.daily_start_time),
                minute_of_day(trip.daily_end_time),
            ) is None:
                continue
            priority = 0 if place.highlight_level == "must_see" else 1
            choices.append((priority, place.slug, SeasonalHighlightResponse(
                date=visit_date.isoformat(), place=_place_response(place, trip.language),
            )))
            break
    choices.sort(key=lambda item: (item[2].date, item[0], item[1]))
    return [item[2] for item in choices]


def holiday_responses(
    session: Session, first: date, last: date, language: str, with_trip_dates: bool = True,
) -> list[HolidayResponse]:
    """Holidays overlapping [first, last], with the catalog places that host them.

    Every holiday is listed even when no event place exists for it yet, so a
    traveler still learns that their dates fall on a festival or day off.
    """
    occurrences = holidays_between(first, last)
    slugs = {slug for item in occurrences for slug in item.holiday.place_slugs}
    places = {
        place.slug: place for place in session.scalars(select(Place).where(
            Place.slug.in_(slugs), Place.is_active.is_(True),
        ).options(selectinload(Place.reviews)))
    } if slugs else {}
    vietnamese = language == "vi"
    return [HolidayResponse(
        key=item.holiday.key,
        name=item.holiday.name_vi if vietnamese else item.holiday.name_en,
        kind=item.holiday.kind, isPublicHoliday=item.holiday.is_public_holiday,
        startDate=item.start.isoformat(), endDate=item.end.isoformat(),
        tripDates=[day.isoformat() for day in item.dates_within(first, last)] if with_trip_dates else [],
        description=item.holiday.description_vi if vietnamese else item.holiday.description_en,
        suggestion=item.holiday.suggestion_vi if vietnamese else item.holiday.suggestion_en,
        relatedPlaces=[_place_response(places[slug], language)
                       for slug in item.holiday.place_slugs if slug in places],
    ) for item in occurrences]


def _trip_holidays(session: Session, trip: TripRequest) -> list[HolidayResponse]:
    if trip.start_date is None:
        return []
    last = trip.start_date + timedelta(days=trip.days - 1)
    return holiday_responses(session, trip.start_date, last, trip.language)


def _stay_options(session: Session, trip: TripRequest) -> list[PlaceResponse]:
    places = list(session.scalars(select(Place).where(
        Place.is_active.is_(True), Place.category == "accommodation",
    ).options(selectinload(Place.reviews))))
    route_points = [(trip.start_latitude, trip.start_longitude)]
    for itinerary in trip.itineraries:
        for day in itinerary.days:
            route_points.extend(
                (item.place.latitude, item.place.longitude)
                for item in day.items
                if item.place is not None
            )
    nearby: list[tuple[float, float, Place]] = []
    for place in places:
        distances = [distance_km(lat, lon, place.latitude, place.longitude) for lat, lon in route_points]
        nearest_route_distance = min(distances, default=float("inf"))
        if nearest_route_distance <= STAY_NEARBY_RADIUS_KM:
            start_distance = distances[0] if distances else float("inf")
            nearby.append((nearest_route_distance, start_distance, place))
    nearby.sort(key=lambda item: (item[0], item[1], item[2].average_cost, item[2].slug))
    return [_place_response(place, trip.language) for _, _, place in nearby[:4]]


def get_trip(session: Session, trip_id: str) -> TripResponse | None:
    statement = select(TripRequest).where(TripRequest.id == trip_id).options(
        selectinload(TripRequest.itineraries)
        .selectinload(Itinerary.days)
        .selectinload(ItineraryDay.items)
        .selectinload(ItineraryItem.place)
        .selectinload(Place.reviews)
    )
    trip = session.scalar(statement)
    if trip is None:
        return None
    options = []
    for option in sorted(trip.itineraries, key=lambda item: (
        ["BEST_MATCH", "BUDGET_FRIENDLY", "EXPLORE_MORE"].index(item.option_type)
    )):
        attraction_cost = food_cost = transport_cost = other_cost = 0
        days = []
        for day in option.days:
            items = []
            for item in day.items:
                place = item.place
                if place.category in {"food", "coffee"}:
                    food_cost += item.estimated_cost
                else:
                    attraction_cost += place.entrance_fee * trip.traveler_count
                    other_cost += place.average_cost * trip.traveler_count
                transport_cost += item.travel_cost
                items.append(ItemResponse(
                    id=item.id, sequence=item.sequence,
                    place=_place_response(place, trip.language),
                    startTime=item.start_time.strftime("%H:%M"),
                    endTime=item.end_time.strftime("%H:%M"),
                    visitMinutes=item.estimated_visit_minutes,
                    travelMinutes=item.travel_from_previous_minutes,
                    travelKm=item.travel_from_previous_km,
                    estimatedCost=item.estimated_cost,
                    travelCost=item.travel_cost,
                    recommendationScore=item.recommendation_score,
                    reasons=item.recommendation_reasons,
                    locked=item.locked,
                ))
            days.append(DayResponse(
                dayNumber=day.day_number, date=day.date.isoformat(), theme=day.theme,
                estimatedCost=day.estimated_cost, estimatedDistanceKm=day.estimated_distance_km,
                estimatedTravelMinutes=day.estimated_travel_minutes, items=items,
            ))
        budget = BudgetResponse(
            attractions=attraction_cost, food=food_cost, transport=transport_cost,
            others=other_cost, total=option.estimated_total_cost,
            remaining=trip.budget_total - option.estimated_total_cost,
        )
        tolerance = BUDGET_TARGET_TOLERANCE.get(option.option_type)
        target_share = None if tolerance is None else round(1 - tolerance, 2)
        options.append(OptionResponse(
            id=option.id, type=option.option_type, matchScore=option.match_score,
            estimatedTotalCost=option.estimated_total_cost,
            estimatedTotalDistanceKm=option.estimated_total_distance_km,
            estimatedTotalTravelMinutes=option.estimated_total_travel_minutes,
            totalPlaces=sum(len(day.items) for day in days), budget=budget, days=days,
            budgetTargetShare=target_share,
            budgetTargetMet=target_share is None
            or option.estimated_total_cost >= ceil(trip.budget_total * target_share),
        ))
    return TripResponse(
        tripId=trip.id, language=trip.language, travelMode=trip.travel_mode,
        options=options, seasonalHighlights=_seasonal_highlights(session, trip),
        holidays=_trip_holidays(session, trip),
        stayOptions=_stay_options(session, trip),
        startLatitude=trip.start_latitude, startLongitude=trip.start_longitude,
    )

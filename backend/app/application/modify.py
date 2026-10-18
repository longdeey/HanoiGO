from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.application.trips import _apply_plan, _apply_single_day, get_trip
from app.domain.planner.budgeting import BudgetBreakdown, place_cost
from app.domain.planner.constraints import distance_km, filter_candidates
from app.domain.planner.planner import NoFeasibleItinerary, PlannedItinerary, build_itinerary
from app.domain.planner.ranking import rank_candidates, score_candidate
from app.domain.planner.scheduling import PlannedDay, ScheduledItem, build_day, minute_of_day
from app.domain.planner.types import (
    PlaceCandidate,
    StartLocation,
    TripConstraints,
    candidate_from_place,
)
from app.domain.planner.validation import validate_days
from app.infrastructure.db.models import Itinerary, ItineraryDay, ItineraryItem, TripRequest
from app.infrastructure.repositories.places import PlaceRepository


class MissingTripItem(Exception):
    pass


class LockedTripItem(Exception):
    pass


def set_place_lock(
    session: Session, trip_id: str, itinerary_id: str, item_id: str, locked: bool,
):
    _, option = _load_trip_option(session, trip_id, itinerary_id)
    item = next((item for day in option.days for item in day.items if item.id == item_id), None)
    if item is None:
        raise MissingTripItem("Itinerary item not found")
    item.locked = locked
    session.commit()
    return get_trip(session, trip_id)


def _load_trip_option(session: Session, trip_id: str, itinerary_id: str) -> tuple[TripRequest, Itinerary]:
    statement = select(TripRequest).where(TripRequest.id == trip_id).options(
        selectinload(TripRequest.itineraries)
        .selectinload(Itinerary.days)
        .selectinload(ItineraryDay.items)
        .selectinload(ItineraryItem.place)
    )
    trip = session.scalar(statement)
    if trip is None:
        raise MissingTripItem("Trip not found")
    option = next((item for item in trip.itineraries if item.id == itinerary_id), None)
    if option is None:
        raise MissingTripItem("Itinerary not found")
    return trip, option


def _constraints(trip: TripRequest, first_day: date) -> TripConstraints:
    return TripConstraints(
        language=trip.language, startDate=trip.start_date or first_day,
        days=trip.days, travelerCount=trip.traveler_count, budgetTotal=trip.budget_total,
        startLocation=StartLocation(
            name=trip.start_location, latitude=trip.start_latitude,
            longitude=trip.start_longitude,
        ),
        interests=trip.interests, travelMode=trip.travel_mode,
        travelRadiusMode=trip.travel_radius_mode, pace=trip.pace,
        experiencePreferences=trip.experience_preferences,
        dietaryPreferences=trip.dietary_preferences,
        specialRequirements=trip.special_requirements,
        dailyStartTime=trip.daily_start_time, dailyEndTime=trip.daily_end_time,
    )


def _planned_day(day: ItineraryDay, traveler_count: int) -> PlannedDay:
    items = []
    total = BudgetBreakdown()
    for item in day.items:
        place = candidate_from_place(item.place)
        cost = place_cost(place, traveler_count)
        total += cost + BudgetBreakdown(transport=item.travel_cost)
        items.append(ScheduledItem(
            place=place, sequence=item.sequence,
            start_minute=minute_of_day(item.start_time), end_minute=minute_of_day(item.end_time),
            visit_minutes=item.estimated_visit_minutes,
            travel_minutes=item.travel_from_previous_minutes,
            travel_km=item.travel_from_previous_km, travel_cost=item.travel_cost,
            cost=cost, score=item.recommendation_score,
            reasons=tuple(item.recommendation_reasons),
        ))
    return PlannedDay(day.day_number, day.date, tuple(items), total,
                      day.estimated_distance_km, day.estimated_travel_minutes)


def _plan_from_days(option_type: str, days: list[PlannedDay]) -> PlannedItinerary:
    total = BudgetBreakdown()
    for day in days:
        total += day.cost
    scores = [item.score for day in days for item in day.items]
    return PlannedItinerary(
        option_type, tuple(days), total,
        round(sum(day.distance_km for day in days), 3),
        sum(day.travel_minutes for day in days), round(sum(scores) / len(scores)),
    )


def _alternatives(
    places: list[PlaceCandidate], old: PlaceCandidate,
    constraints: TripConstraints, used_ids: set[str], reason: str,
) -> list[PlaceCandidate]:
    ranked = rank_candidates(filter_candidates(places, constraints), constraints)
    choices = [item.place for item in ranked if item.place.id not in used_ids]
    if reason == "TOO_EXPENSIVE":
        old_cost = old.average_cost + old.entrance_fee
        choices.sort(key=lambda place: (
            place.average_cost + place.entrance_fee == old_cost,
            place.average_cost + place.entrance_fee,
            place.slug,
        ))
    elif reason == "TOO_FAR":
        choices.sort(key=lambda place: (distance_km(
            constraints.start_location.latitude, constraints.start_location.longitude,
            place.latitude, place.longitude,
        ), place.slug))
    elif reason == "PREFER_INDOOR":
        choices.sort(key=lambda place: (not place.indoor, place.slug))
    elif reason == "PREFER_LOCAL":
        choices.sort(key=lambda place: (-place.local_score, place.slug))
    # Preserve the purpose of a stop where possible.
    choices.sort(key=lambda place: place.category != old.category)
    return choices


def replace_place(
    session: Session, trip_id: str, itinerary_id: str, item_id: str, reason: str,
):
    trip, option = _load_trip_option(session, trip_id, itinerary_id)
    target_day = next((day for day in option.days if any(item.id == item_id for item in day.items)), None)
    if target_day is None:
        raise MissingTripItem("Itinerary item not found")
    target = next(item for item in target_day.items if item.id == item_id)
    if target.locked:
        raise LockedTripItem("Unlock this place before replacing it")
    constraints = _constraints(trip, option.days[0].date)
    current_days = [_planned_day(day, trip.traveler_count) for day in option.days]
    all_places = [candidate_from_place(place) for place in PlaceRepository(session).list_active()]
    used_ids = {item.place.id for day in option.days for item in day.items}
    old_place = candidate_from_place(target.place)
    for alternate in _alternatives(all_places, old_place, constraints, used_ids, reason):
        same_day = [score_candidate(item.place, constraints)
                    for item in current_days[target_day.day_number - 1].items
                    if item.place.id != old_place.id]
        same_day.append(score_candidate(alternate, constraints))
        replacement_day = build_day(target_day.day_number, target_day.date, same_day, constraints)
        expected_ids = {item.place.id for item in same_day}
        if {item.place.id for item in replacement_day.items} != expected_ids:
            continue
        revised_days = list(current_days)
        revised_days[target_day.day_number - 1] = replacement_day
        if validate_days(revised_days, constraints):
            continue
        plan = _plan_from_days(option.option_type, revised_days)
        _apply_single_day(option, plan, target_day.day_number)
        session.commit()
        return get_trip(session, trip_id)
    raise NoFeasibleItinerary("No replacement satisfies time, route, and budget constraints")


def optimize_itinerary(
    session: Session, trip_id: str, itinerary_id: str, strategy: str,
    day_number: int | None = None,
):
    trip, option = _load_trip_option(session, trip_id, itinerary_id)
    constraints = _constraints(trip, option.days[0].date)
    all_places = [candidate_from_place(place) for place in PlaceRepository(session).list_active()]
    if strategy == "REGENERATE_DAY":
        if day_number is None or day_number > constraints.days:
            raise NoFeasibleItinerary("Choose a valid day to regenerate")
        existing_days = [_planned_day(day, trip.traveler_count) for day in option.days]
        current = existing_days[day_number - 1]
        used_elsewhere = {
            item.place.id for day in existing_days if day.day_number != day_number
            for item in day.items
        }
        candidates = [item for item in rank_candidates(
            filter_candidates(all_places, constraints), constraints
        ) if item.place.id not in used_elsewhere]
        candidates.sort(key=lambda item: (-item.place.local_score, item.rank))
        count = len(current.items)
        old_ids = {item.place.id for item in current.items}
        locked_ids = {item.place.id for item in option.days[day_number - 1].items if item.locked}
        for offset in range(max(1, len(candidates) - count + 1)):
            chosen = candidates[offset:offset + count]
            if len(chosen) != count:
                continue
            if not locked_ids.issubset({item.place.id for item in chosen}):
                continue
            revised_day = build_day(day_number, current.date, chosen, constraints)
            if len(revised_day.items) != count:
                continue
            if {item.place.id for item in revised_day.items} == old_ids:
                continue
            revised_days = list(existing_days)
            revised_days[day_number - 1] = revised_day
            if validate_days(revised_days, constraints):
                continue
            _apply_single_day(option, _plan_from_days(option.option_type, revised_days), day_number)
            session.commit()
            return get_trip(session, trip_id)
        raise NoFeasibleItinerary("No different valid schedule was found for this day")
    plan = build_itinerary(all_places, constraints, option_type=option.option_type,
                           priority=strategy)
    locked_ids = {item.place.id for day in option.days for item in day.items if item.locked}
    plan_ids = {item.place.id for day in plan.days for item in day.items}
    if not locked_ids.issubset(plan_ids):
        raise LockedTripItem("Unlock places that this optimization would remove")
    if strategy == "REDUCE_COST" and plan.cost.total > option.estimated_total_cost:
        raise NoFeasibleItinerary("No lower-cost plan satisfies all constraints")
    if strategy == "REDUCE_DISTANCE" and plan.distance_km > option.estimated_total_distance_km:
        raise NoFeasibleItinerary("No shorter-distance plan satisfies all constraints")
    _apply_plan(option, plan)
    session.commit()
    return get_trip(session, trip_id)

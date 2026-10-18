from dataclasses import replace
from datetime import date
from itertools import pairwise

import pytest
from test_constraints_ranking import place, trip

from app.domain.planner.budgeting import BudgetBreakdown, place_cost
from app.domain.planner.planner import NoFeasibleItinerary, build_itinerary
from app.domain.planner.ranking import score_candidate
from app.domain.planner.routing import route_order, travel_leg
from app.domain.planner.scheduling import (
    build_day,
    gap_minutes,
    opening_start,
    route_objective,
)
from app.domain.planner.types import candidate_from_place
from app.domain.planner.validation import validate_days
from app.infrastructure.db.session import SessionLocal
from app.infrastructure.repositories.places import PlaceRepository


def test_route_empty_single_deterministic_and_no_lost_places() -> None:
    start = (21.034, 105.85)
    a = place(id="a", slug="a", longitude=105.851)
    b = place(id="b", slug="b", longitude=105.852)
    assert route_order([], *start) == []
    assert route_order([a], *start) == [a]
    assert route_order([b, a], *start) == [a, b]
    assert {item.id for item in route_order([a, b], *start)} == {"a", "b"}


def test_budget_per_traveler_free_places_transport_and_multiday() -> None:
    food = place(category="food", average_cost=50_000)
    free = replace(food, category="park", average_cost=0, entrance_fee=0)
    assert place_cost(food, 2).food == 100_000
    assert place_cost(free, 2).total == 0
    distance, minutes, fare = travel_leg(21.034, 105.85, 21.05, 105.85, "grab", 2)
    assert distance > 0 and minutes > 0 and fare > 0
    day_cost = place_cost(food, 2) + BudgetBreakdown(transport=fare)
    assert (day_cost + day_cost).total == 2 * (100_000 + fare)


def test_walking_motorbike_and_car_have_distinct_travel_estimates() -> None:
    start = (21.034, 105.85)
    end = (21.05, 105.88)
    walk = travel_leg(*start, *end, "walking", 2)
    motorbike = travel_leg(*start, *end, "motorbike", 2)
    car = travel_leg(*start, *end, "car", 2)
    assert walk[0] == motorbike[0] == car[0]
    assert walk[2] == 0 < motorbike[2] < car[2]
    assert motorbike[1] < walk[1]
    assert travel_leg(*start, *start, "motorbike", 2) == (0.0, 0, 0)


def test_walking_daily_route_is_capped_at_ten_kilometres() -> None:
    constraints = trip(
        days=1, startDate=date(2026, 9, 15), interests=["park"],
        travelMode="walking", travelRadiusMode="wide",
    )
    candidates = [
        place(id="east", slug="east", category="park", tags=("park",), longitude=105.90),
        place(id="west", slug="west", category="park", tags=("park",), longitude=105.80),
        place(id="north", slug="north", category="park", tags=("park",), latitude=21.08),
    ]
    itinerary = build_itinerary(candidates, constraints)
    assert all(day.distance_km <= 10.0 for day in itinerary.days)


def test_quick_street_food_can_be_breakfast_but_seated_meals_start_at_lunch() -> None:
    visit_date = date(2026, 9, 15)
    quick_pho = place(average_visit_minutes=45)
    seated_restaurant = place(average_visit_minutes=90)
    assert opening_start(quick_pho, visit_date, 8 * 60, 21 * 60) == 8 * 60
    assert opening_start(seated_restaurant, visit_date, 8 * 60, 21 * 60) == 11 * 60


def test_daily_plan_spreads_breakfast_lunch_and_dinner_without_adjacent_food_stops() -> None:
    visit_date = date(2026, 9, 15)
    constraints = trip(days=1, startDate=visit_date, interests=["food", "history"])
    candidates = [
        score_candidate(place(id="coffee", slug="coffee", category="coffee", tags=("coffee",), average_visit_minutes=45), constraints),
        score_candidate(place(id="lunch", slug="lunch", category="food", tags=("food",), average_visit_minutes=60), constraints),
        score_candidate(place(id="dinner", slug="dinner", category="food", tags=("food",), average_visit_minutes=75), constraints),
        score_candidate(place(id="museum", slug="museum", category="museum", tags=("history",), average_visit_minutes=60), constraints),
        score_candidate(place(id="temple", slug="temple", category="history", tags=("history",),
                              average_visit_minutes=90, longitude=105.853), constraints),
        score_candidate(place(id="gate", slug="gate", category="history", tags=("history",),
                              average_visit_minutes=60, latitude=21.036), constraints),
    ]
    day = build_day(1, visit_date, candidates, constraints)
    meal_items = [item for item in day.items if item.place.category in {"food", "coffee"}]
    assert len(meal_items) == 3
    assert [item.start_minute for item in meal_items] == sorted(item.start_minute for item in meal_items)
    assert meal_items[0].start_minute < 11 * 60
    assert meal_items[1].start_minute >= 11 * 60
    assert meal_items[2].start_minute >= 17 * 60
    assert not any(
        first.place.category in {"food", "coffee"} and second.place.category in {"food", "coffee"}
        for first, second in pairwise(day.items)
    )
    # Each stop starts as soon as the traveler arrives from the previous one.
    assert gap_minutes(day) == 0
    assert all(
        second.start_minute == first.end_minute + second.travel_minutes
        for first, second in pairwise(day.items)
    )


def test_schedule_validator_catches_overlap_closing_duration_and_daily_limit() -> None:
    constraints = trip(days=1, startDate=date(2026, 9, 15))
    candidate = score_candidate(place(longitude=105.851), constraints)
    day = build_day(1, date(2026, 9, 15), [candidate], constraints)
    assert validate_days([day], constraints) == []
    item = day.items[0]
    assert "Overlapping activity or insufficient travel time" in validate_days([
        replace(day, items=(replace(item, start_minute=8 * 60),))
    ], constraints)
    assert "Place closed at scheduled time" in validate_days([
        replace(day, items=(replace(item, place=replace(item.place, opening_hours={"1": []})),))
    ], constraints)
    assert "Incorrect visit duration" in validate_days([
        replace(day, items=(replace(item, end_minute=item.end_minute + 1),))
    ], constraints)
    assert "Activity outside daily window" in validate_days([
        replace(day, items=(replace(item, end_minute=22 * 60),))
    ], constraints)


def test_special_closure_date_is_filtered_and_rejected_by_validator() -> None:
    from app.domain.planner.constraints import fits_opening_hours

    closed = place(special_closed_dates=("2026-09-15",))
    constraints = trip(days=1, startDate=date(2026, 9, 15))
    assert not fits_opening_hours(closed, constraints)
    available = trip(days=1, startDate=date(2026, 9, 17))
    assert fits_opening_hours(closed, available)
    scheduled = build_day(1, date(2026, 9, 17), [score_candidate(closed, available)], available)
    wrong_date = replace(scheduled, date=date(2026, 9, 15))
    assert "Place closed at scheduled time" in validate_days([wrong_date], constraints)


def test_seeded_places_generate_valid_three_day_itinerary() -> None:
    constraints = trip(startDate=date(2026, 9, 15))
    with SessionLocal() as session:
        places = [candidate_from_place(place) for place in PlaceRepository(session).list_active()]
    itinerary = build_itinerary(places, constraints)
    assert len(itinerary.days) == 3
    assert all(day.items for day in itinerary.days)
    assert itinerary.cost.total <= constraints.budget_total
    assert validate_days(list(itinerary.days), constraints) == []


def test_planner_returns_business_error_when_no_feasible_places() -> None:
    with pytest.raises(NoFeasibleItinerary):
        build_itinerary([], trip())


def test_best_match_lands_within_five_percent_of_the_budget() -> None:
    constraints = trip(days=1, budgetTotal=1_000_000, interests=["park"])
    places = [place(id=str(index), slug=f"park-{index}", category="park", tags=("park",),
                    average_cost=100_000, entrance_fee=0, average_visit_minutes=30)
              for index in range(5)]
    itinerary = build_itinerary(places, constraints)
    assert 950_000 <= itinerary.cost.total <= 1_000_000


def test_route_improvement_removes_zigzag_without_changing_stops() -> None:
    visit_date = date(2026, 9, 15)
    constraints = trip(days=1, startDate=visit_date, interests=["history"])
    # Stops on an east-west line: nearest-neighbour from the start alternates
    # sides (+1, -1, +3, -3 km) while the improved order sweeps each side once.
    stops = [
        place(id=slug, slug=slug, category="history", tags=("history",), longitude=105.85 + offset,
              average_visit_minutes=45)
        for slug, offset in (("east", 0.01), ("west", -0.01), ("far-east", 0.03), ("far-west", -0.03))
    ]
    candidates = [score_candidate(item, constraints) for item in stops]
    naive = build_day(1, visit_date, candidates, constraints, optimize_route=False)
    improved = build_day(1, visit_date, candidates, constraints)
    assert {item.place.id for item in improved.items} == {item.place.id for item in naive.items}
    assert improved.distance_km < naive.distance_km
    assert validate_days([improved], constraints) == []
    order = [item.place.id for item in improved.items]
    assert abs(order.index("east") - order.index("far-east")) == 1
    assert abs(order.index("west") - order.index("far-west")) == 1
    # Deterministic: the same input always yields the same route.
    assert [item.place.id for item in build_day(1, visit_date, candidates, constraints).items] == order


def test_route_improvement_trades_distance_against_idle_time_and_keeps_meals_apart() -> None:
    visit_date = date(2026, 9, 15)
    constraints = trip(days=1, startDate=visit_date, interests=["history", "park"])
    near_a = place(id="a", slug="a", category="history", tags=("history",), latitude=21.035, longitude=105.851, average_visit_minutes=45)
    near_b = place(id="b", slug="b", category="park", tags=("park",), latitude=21.036, longitude=105.852, average_visit_minutes=45)
    far = place(id="far", slug="far", category="history", tags=("history",), latitude=21.070, longitude=105.830, average_visit_minutes=60)
    far_lunch = place(id="lunch", slug="lunch", category="food", tags=("food",), latitude=21.069, longitude=105.831, average_visit_minutes=60)
    candidates = [score_candidate(item, constraints) for item in (far, near_a, near_b, far_lunch)]
    naive = build_day(1, visit_date, candidates, constraints, optimize_route=False)
    improved = build_day(1, visit_date, candidates, constraints)
    assert {item.place.id for item in improved.items} == {item.place.id for item in naive.items}
    assert route_objective(improved, constraints) <= route_objective(naive, constraints)
    assert gap_minutes(improved) <= gap_minutes(naive)
    assert validate_days([improved], constraints) == []
    assert all(
        not (item.place.category in {"food", "coffee"} and following.place.category in {"food", "coffee"})
        for item, following in pairwise(improved.items)
    )
    order = [item.place.id for item in improved.items]
    assert abs(order.index("far") - order.index("lunch")) == 1


def test_route_improvement_keeps_lunch_and_dinner_windows() -> None:
    visit_date = date(2026, 9, 15)
    constraints = trip(days=1, startDate=visit_date, interests=["food", "history"])
    stops = [
        place(id="museum", slug="museum", category="museum", tags=("history",), latitude=21.040, longitude=105.840, average_visit_minutes=60),
        place(id="temple", slug="temple", category="history", tags=("history",), latitude=21.030, longitude=105.860, average_visit_minutes=45),
        place(id="lunch", slug="lunch", category="food", tags=("food",), latitude=21.041, longitude=105.841, average_visit_minutes=60),
        place(id="dinner", slug="dinner", category="food", tags=("food",), latitude=21.031, longitude=105.861, average_visit_minutes=75),
    ]
    day = build_day(1, visit_date, [score_candidate(item, constraints) for item in stops], constraints)
    by_id = {item.place.id: item for item in day.items}
    assert 11 * 60 <= by_id["lunch"].start_minute <= 14 * 60
    assert by_id["dinner"].start_minute >= 17 * 60
    assert validate_days([day], constraints) == []


def test_nearby_restaurants_do_not_crowd_attractions_out_of_the_pool() -> None:
    """A large catalog of restaurants next to the start point must not push
    every museum and temple out of the candidate pool."""
    visit_date = date(2026, 9, 15)
    constraints = trip(days=1, startDate=visit_date, interests=["food", "history"], travelMode="walking")
    restaurants = [
        place(id=f"r{index}", slug=f"restaurant-{index}", category="food", tags=("food",),
              latitude=21.034 + (index % 10) * 0.0004, longitude=105.85 + (index // 10) * 0.0004,
              average_cost=120_000, average_visit_minutes=60, local_score=74)
        for index in range(150)
    ]
    attractions = [
        place(id=f"a{index}", slug=f"attraction-{index}", category="history", tags=("history",),
              latitude=21.040 + index * 0.002, longitude=105.840, average_cost=0,
              entrance_fee=30_000, average_visit_minutes=60, local_score=85)
        for index in range(6)
    ]
    itinerary = build_itinerary(restaurants + attractions, constraints)
    stops = [item.place for day in itinerary.days for item in day.items]
    assert sum(stop.category == "history" for stop in stops) >= 2
    assert sum(stop.category == "food" for stop in stops) <= 3
    assert validate_days(list(itinerary.days), constraints) == []

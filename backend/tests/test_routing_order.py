from datetime import date

from test_constraints_ranking import place, trip

from app.domain.planner.planner import generate_options, relocate_meals
from app.domain.planner.ranking import score_candidate
from app.domain.planner.scheduling import (
    _adjacent_meal_pairs,
    _neighbouring_orders,
    _schedule,
    build_day,
    edge_minutes,
    gap_minutes,
    improve_route,
    is_food_or_coffee,
    is_main_meal,
    meal_rhythm_issues,
)
from app.domain.planner.types import candidate_from_place
from app.domain.planner.validation import validate_days
from app.infrastructure.db.session import SessionLocal
from app.infrastructure.repositories.places import PlaceRepository

VISIT_DATE = date(2026, 9, 15)


def sight(identifier: str, latitude: float, longitude: float, minutes: int = 60):
    return place(id=identifier, slug=identifier, category="history", tags=("history",),
                 latitude=latitude, longitude=longitude, average_visit_minutes=minutes,
                 average_cost=0)


def test_close_stops_are_visited_together_instead_of_returning_later() -> None:
    # A and C are 150 m apart; B is about 4 km away. A -> B -> C would walk to B
    # and back; the route must visit A and C one after the other.
    constraints = trip(days=1, startDate=VISIT_DATE, interests=["history"])
    a = sight("a", 21.0350, 105.8510)
    b = sight("b", 21.0700, 105.8250)
    c = sight("c", 21.0360, 105.8520)
    by_id = {item.id: score_candidate(item, constraints) for item in (a, b, c)}

    def schedule(order):
        return _schedule(1, VISIT_DATE, order, by_id, constraints, None, None)

    naive = schedule([a, b, c])
    improved = improve_route([a, b, c], schedule, constraints)
    order = [item.place.id for item in improved.items]
    assert abs(order.index("a") - order.index("c")) == 1
    assert improved.distance_km < naive.distance_km
    assert validate_days([improved], constraints) == []


def test_off_route_lunch_is_swapped_for_a_comparable_one_on_the_route() -> None:
    constraints = trip(days=1, startDate=VISIT_DATE, interests=["food", "history"])
    morning = sight("morning", 21.0350, 105.8510, minutes=150)
    afternoon = sight("afternoon", 21.0360, 105.8520, minutes=150)
    far_lunch = place(id="far-lunch", slug="far-lunch", latitude=21.0700, longitude=105.8250)
    near_lunch = place(id="near-lunch", slug="near-lunch", latitude=21.0356, longitude=105.8514)
    candidates = [score_candidate(item, constraints) for item in (morning, afternoon, far_lunch)]
    day = build_day(1, VISIT_DATE, candidates, constraints)
    assert "far-lunch" in [item.place.id for item in day.items]
    available = candidates + [score_candidate(near_lunch, constraints)]
    [relocated] = relocate_meals([day], available, constraints, None, floor=None,
                                 ceiling=constraints.budget_total)
    ids = [item.place.id for item in relocated.items]
    assert "near-lunch" in ids and "far-lunch" not in ids
    assert relocated.distance_km < day.distance_km
    assert validate_days([relocated], constraints) == []


def test_generated_days_have_no_shorter_valid_visiting_order() -> None:
    with SessionLocal() as session:
        places = [candidate_from_place(item) for item in PlaceRepository(session).list_active()]
    for values in (
        {"days": 3, "interests": ["food", "history", "coffee", "local_culture"]},
        {"days": 2, "interests": ["nature", "checkin"], "travelMode": "motorbike"},
    ):
        constraints = trip(startDate=date(2026, 10, 17), **values)
        for option in generate_options(places, constraints):
            for day in option.days:
                stops = [item.place for item in day.items]
                lunch = next((item.place for item in day.items if is_main_meal(item.place)
                              and 11 * 60 <= item.start_minute < 14 * 60), None)
                dinner = next((item.place for item in day.items if is_main_meal(item.place)
                               and item.start_minute >= 17 * 60), None)
                breakfast = next((item.place for item in day.items if is_food_or_coffee(item.place)
                                  and not is_main_meal(item.place) and item.start_minute < 11 * 60), None)
                by_id = {stop.id: score_candidate(stop, constraints) for stop in stops}
                ids = {stop.id for stop in stops}
                for order in _neighbouring_orders(stops):
                    trial = _schedule(day.day_number, day.date, order, by_id, constraints, lunch, dinner, breakfast)
                    if ({item.place.id for item in trial.items} != ids
                            or gap_minutes(trial) > gap_minutes(day)
                            or _adjacent_meal_pairs(trial) > _adjacent_meal_pairs(day)
                            or meal_rhythm_issues(trial, constraints) > meal_rhythm_issues(day, constraints)
                            or edge_minutes(trial, constraints) > edge_minutes(day, constraints)
                            # A shorter route can need a paid ride the budget has no room for.
                            or option.cost.total - day.cost.total + trial.cost.total > constraints.budget_total):
                        continue
                    assert trial.distance_km >= day.distance_km - 0.3, (
                        values, option.option_type, day.day_number,
                        [stop.slug for stop in order], trial.distance_km, day.distance_km,
                    )

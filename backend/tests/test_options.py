from datetime import date

from test_constraints_ranking import trip

from app.domain.planner.config import BUDGET_TARGET_TOLERANCE
from app.domain.planner.planner import generate_options
from app.domain.planner.types import candidate_from_place
from app.domain.planner.validation import validate_days
from app.infrastructure.db.session import SessionLocal
from app.infrastructure.repositories.places import PlaceRepository


def test_three_seeded_strategies_are_distinct_and_valid() -> None:
    constraints = trip(startDate=date(2026, 9, 15), interests=[
        "food", "history", "coffee", "local_culture",
    ])
    with SessionLocal() as session:
        places = [candidate_from_place(place) for place in PlaceRepository(session).list_active()]
    options = generate_options(places, constraints)
    assert [option.option_type for option in options] == [
        "BEST_MATCH", "BUDGET_FRIENDLY", "EXPLORE_MORE",
    ]
    signatures = [
        {item.place.slug for day in option.days for item in day.items}
        for option in options
    ]
    assert len({frozenset(signature) for signature in signatures}) == 3
    # Every option fills its days without waiting, so Budget Friendly may use
    # several short free stops; Explore More still visits more than Best Match.
    assert len(signatures[0]) < len(signatures[2])
    assert options[1].cost.total <= options[0].cost.total
    for option in options:
        assert option.cost.total <= constraints.budget_total
        assert validate_days(list(option.days), constraints) == []


def test_best_match_and_explore_more_use_the_budget_within_tolerance() -> None:
    with SessionLocal() as session:
        places = [candidate_from_place(place) for place in PlaceRepository(session).list_active()]
    for values in (
        {"days": 3, "travelerCount": 2, "budgetTotal": 3_000_000},
        {"days": 1, "travelerCount": 2, "budgetTotal": 1_000_000},
        {"days": 2, "travelerCount": 2, "budgetTotal": 6_000_000, "travelMode": "motorbike"},
    ):
        constraints = trip(startDate=date(2026, 10, 17), interests=["food", "history", "local_culture"], **values)
        best, _, explore = generate_options(places, constraints)
        budget = constraints.budget_total
        assert budget * (1 - BUDGET_TARGET_TOLERANCE["BEST_MATCH"]) <= best.cost.total <= budget, values
        assert budget * (1 - BUDGET_TARGET_TOLERANCE["EXPLORE_MORE"]) <= explore.cost.total <= budget, values
        for option in (best, explore):
            assert validate_days(list(option.days), constraints) == []


def test_every_option_moves_straight_on_to_the_next_stop() -> None:
    with SessionLocal() as session:
        places = [candidate_from_place(place) for place in PlaceRepository(session).list_active()]
    for values in (
        {"days": 3, "travelerCount": 2, "budgetTotal": 3_000_000,
         "interests": ["food", "history", "coffee", "local_culture"]},
        {"days": 2, "travelerCount": 2, "budgetTotal": 2_000_000, "pace": "relaxed",
         "interests": ["food", "coffee"]},
        {"days": 1, "travelerCount": 2, "budgetTotal": 1_000_000, "interests": ["nature", "checkin"]},
    ):
        constraints = trip(startDate=date(2026, 10, 17), **values)
        for option in generate_options(places, constraints):
            for day in option.days:
                for previous, item in zip(day.items, day.items[1:]):
                    assert item.start_minute == previous.end_minute + item.travel_minutes, (
                        values, option.option_type, day.day_number, item.place.slug,
                    )


def test_a_short_day_from_my_dinh_still_gets_three_different_options() -> None:
    # One day, 09:00-19:00, from 1 Phan Tây Nhạc: the same must-see sights and
    # meals used to come back for every option.
    with SessionLocal() as session:
        places = [candidate_from_place(place) for place in PlaceRepository(session).list_active()]
    for start in (date(2026, 12, 10), date(2026, 10, 24)):
        constraints = trip(startDate=start, days=1, travelerCount=2, budgetTotal=1_500_000,
                           interests=["history", "food"], travelMode="motorbike", dailyStartTime="09:00",
                           dailyEndTime="19:00", startLocation={"name": "1 Phan Tây Nhạc", "latitude": 21.0405,
                                                                "longitude": 105.745})
        options = generate_options(places, constraints)
        signatures = {tuple(item.place.id for day in option.days for item in day.items) for option in options}
        assert len(signatures) == 3, start

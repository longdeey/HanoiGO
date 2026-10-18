from datetime import date

from test_constraints_ranking import trip

from app.domain.planner.planner import generate_options
from app.domain.planner.types import PlaceCandidate, candidate_from_place
from app.infrastructure.db.seed import seed_places
from app.infrastructure.db.session import SessionLocal
from app.infrastructure.repositories.places import PlaceRepository


def seeded_candidates() -> list[PlaceCandidate]:
    seed_places()
    with SessionLocal() as session:
        return [candidate_from_place(place) for place in PlaceRepository(session).list_active()]


def slugs(option: object) -> set[str]:
    from app.domain.planner.planner import PlannedItinerary

    assert isinstance(option, PlannedItinerary)
    return {item.place.slug for day in option.days for item in day.items}


def test_larger_budget_changes_best_match_and_uses_suitable_inventory() -> None:
    places = seeded_candidates()
    base = trip(startDate=date(2026, 9, 15), budgetTotal=3_000_000, interests=[
        "food", "history", "coffee", "local_culture",
    ])
    high = trip(startDate=date(2026, 9, 15), budgetTotal=10_000_000, interests=base.interests)
    base_option = generate_options(places, base)[0]
    high_option = generate_options(places, high)[0]
    assert slugs(base_option) != slugs(high_option)
    assert high_option.cost.total >= 4_000_000
    assert high_option.cost.total <= high.budget_total


def test_high_budget_motorbike_trip_reserves_feasible_stops_for_all_days() -> None:
    places = seeded_candidates()
    constraints = trip(
        startDate=date(2026, 9, 15), budgetTotal=10_000_000,
        startLocation={"name": "Old Quarter", "latitude": 21.034, "longitude": 105.85},
        travelMode="motorbike", interests=["food", "history", "coffee", "local_culture"],
        experiencePreferences=["local"],
    )
    options = generate_options(places, constraints)
    assert len(options) == 3
    assert all(len(option.days) == 3 and all(day.items for day in option.days) for option in options)
    assert all(len(day.items) >= 3 for day in options[0].days)
    assert all(option.cost.total <= constraints.budget_total for option in options)
    # Best Match uses the money offered: within 5% of the budget, never over it.
    assert 9_500_000 <= options[0].cost.total <= 10_000_000
    assert all(
        (item.place.average_cost + item.place.entrance_fee) * constraints.traveler_count
        <= constraints.budget_total * 0.5
        for day in options[0].days for item in day.items
    )
    for day in options[0].days:
        # A stop may stay longer than usual to avoid a wait, so classify meals
        # by the place's usual visit rather than the scheduled one.
        seated_meals = [item for item in day.items if item.place.category == "food"
                        and item.place.average_visit_minutes >= 60]
        assert len(seated_meals) <= 2
        if len(seated_meals) == 2:
            assert seated_meals[1].start_minute >= 17 * 60


def test_options_never_exceed_the_budget_and_budget_friendly_keeps_a_buffer() -> None:
    places = seeded_candidates()
    for budget in (3_000_000, 10_000_000):
        constraints = trip(startDate=date(2026, 9, 15), budgetTotal=budget, interests=[
            "food", "history", "coffee", "local_culture",
        ])
        best, budget_friendly, explore = generate_options(places, constraints)
        assert budget * 0.95 <= best.cost.total <= budget
        assert budget * 0.90 <= explore.cost.total <= budget
        assert budget_friendly.cost.total <= int(budget * 0.95)


def test_single_interest_changes_majority_of_best_match_places() -> None:
    places = seeded_candidates()
    food = generate_options(places, trip(startDate=date(2026, 9, 15), interests=["food"]))[0]
    history = generate_options(places, trip(startDate=date(2026, 9, 15), interests=["history"]))[0]
    overlap = len(slugs(food) & slugs(history)) / len(slugs(food) | slugs(history))
    # Every day now reserves meal slots, so some food overlap is intentional.
    assert overlap <= 0.5


def test_catalog_covers_multiple_hanoi_neighborhoods() -> None:
    places = seeded_candidates()
    assert len(places) >= 50
    assert any(place.longitude < 105.8 for place in places)
    assert any(place.longitude > 105.89 for place in places)
    assert any(place.latitude > 21.1 for place in places)
    assert any(place.latitude < 21.0 for place in places)

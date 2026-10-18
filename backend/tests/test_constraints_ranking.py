from dataclasses import replace
from datetime import date

import pytest
from pydantic import ValidationError

from app.domain.planner.constraints import (
    filter_candidates,
    fits_opening_hours,
    radius_for_constraints,
)
from app.domain.planner.ranking import (
    discovery_score,
    feedback_score,
    rank_candidates,
    score_candidate,
)
from app.domain.planner.types import PlaceCandidate, TripConstraints


def trip(**changes: object) -> TripConstraints:
    values = {
        "days": 3, "travelerCount": 2, "budgetTotal": 3_000_000,
        "startLocation": {"name": "Old Quarter", "latitude": 21.034, "longitude": 105.85},
        "interests": ["food", "history"], "dailyStartTime": "08:00", "dailyEndTime": "21:00",
    }
    values.update(changes)
    return TripConstraints.model_validate(values)


def place(**changes: object) -> PlaceCandidate:
    values = {
        "id": "1", "slug": "example", "latitude": 21.034, "longitude": 105.85,
        "category": "food", "tags": ("food",), "average_cost": 50_000,
        "entrance_fee": 0, "average_visit_minutes": 60, "indoor": True,
        "outdoor": False, "local_score": 80,
        "opening_hours": {str(day): [["08:00", "21:00"]] for day in range(7)},
        "suitable_for": ("couple",),
    }
    values.update(changes)
    return PlaceCandidate(**values)


@pytest.mark.parametrize("invalid", [
    {"budgetTotal": 0}, {"days": 0}, {"travelerCount": 0}, {"interests": []},
    {"dailyStartTime": "21:00", "dailyEndTime": "08:00"},
])
def test_invalid_trip_constraints_are_rejected(invalid: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        trip(**invalid)


def test_opening_hours_and_visit_duration_filtering() -> None:
    monday = trip(startDate=date(2026, 9, 14), days=1)
    closed = place(opening_hours={"0": []})
    short_window = place(opening_hours={"0": [["10:00", "10:30"]]})
    assert not fits_opening_hours(closed, monday)
    assert not fits_opening_hours(short_window, monday)
    assert filter_candidates([closed, short_window, place()], monday) == [place()]


def test_radius_active_and_budget_filtering() -> None:
    near = trip(travelRadiusMode="near", budgetTotal=100_000)
    candidates = [place(), place(slug="far", latitude=21.08), place(slug="inactive", is_active=False),
                  place(slug="expensive", average_cost=100_000)]
    assert filter_candidates(candidates, near) == [place()]


def test_radius_presets_are_bounded_by_travel_mode() -> None:
    walking_wide = trip(travelRadiusMode="wide", travelMode="walking")
    car_wide = trip(travelRadiusMode="wide", travelMode="car")
    car_outskirts = trip(travelRadiusMode="outskirts", travelMode="car")
    peripheral_city = trip(
        startLocation={"name": "Hòa Lạc", "latitude": 21.015, "longitude": 105.525},
        travelRadiusMode="balanced", travelMode="car",
    )
    assert radius_for_constraints(walking_wide) == 10.0
    assert radius_for_constraints(car_wide) == 30.0
    assert radius_for_constraints(car_outskirts) == 80.0
    assert radius_for_constraints(peripheral_city) == 15.0


def test_walking_wide_radius_does_not_include_a_far_place() -> None:
    walking = trip(travelRadiusMode="wide", travelMode="walking")
    far = place(slug="far", latitude=21.22)
    assert filter_candidates([place(), far], walking) == [place()]


def test_interest_budget_weather_and_score_bounds() -> None:
    constraints = trip()
    matching = place()
    unrelated = replace(matching, category="shopping", tags=("shopping",))
    assert score_candidate(matching, constraints).score > score_candidate(unrelated, constraints).score
    cheap = replace(matching, average_cost=0)
    costly = replace(matching, average_cost=200_000)
    assert score_candidate(cheap, constraints).score > score_candidate(costly, constraints).score
    assert score_candidate(matching, constraints, 0.9).score > score_candidate(
        replace(matching, indoor=False, outdoor=True), constraints, 0.9
    ).score
    for candidate in [matching, unrelated, cheap, costly]:
        assert 0 <= score_candidate(candidate, constraints).score <= 100


def test_ranking_is_deterministic() -> None:
    ranked = rank_candidates([place(slug="b"), place(slug="a")], trip())
    assert [item.place.slug for item in ranked] == ["a", "b"]


def test_final_score_follows_the_weighted_formula_without_bonuses() -> None:
    constraints = trip()
    standard = place()
    must_see = place(slug="must-see", highlight_level="must_see", rating_average=5.0, rating_count=20)
    # FeaturedTier and reviews belong to layer 2, so FinalScore is unchanged.
    assert score_candidate(standard, constraints).score == score_candidate(must_see, constraints).score


def test_discovery_score_weights_featured_tier_and_feedback() -> None:
    unrated = place()
    assert feedback_score(unrated) == pytest.approx(62.5)
    assert discovery_score(unrated) == round(0.3 * 40 + 0.7 * 62.5)
    loved = place(rating_average=5.0, rating_count=45)
    assert discovery_score(loved) == round(0.3 * 40 + 0.7 * 100 * (4.85 - 1) / 4)
    # A single perfect review moves the score less than many of them.
    assert feedback_score(place(rating_average=5.0, rating_count=1)) < feedback_score(loved)


def test_discovery_breaks_near_ties_but_not_clear_gaps() -> None:
    constraints = trip()
    best = place(id="a", slug="a-best", tags=("food", "history"))
    near_tie_loved = place(id="b", slug="b-loved", rating_average=5.0, rating_count=40)
    low_rated = place(id="c", slug="c-low", rating_average=1.0, rating_count=40)
    scores = {item.place.slug: item.score for item in (
        score_candidate(p, constraints) for p in (best, near_tie_loved, low_rated))}
    assert scores["a-best"] - scores["b-loved"] > 6
    assert scores["b-loved"] == scores["c-low"]
    ranked = rank_candidates([low_rated, near_tie_loved, best], constraints)
    assert [item.place.slug for item in ranked] == ["a-best", "b-loved", "c-low"]
    assert [item.rank for item in ranked] == [0, 1, 2]

    close = place(id="d", slug="d-close", local_score=95, rating_average=1.0, rating_count=40)
    close_score = score_candidate(close, constraints).score
    assert 0 < close_score - scores["b-loved"] <= 6
    ranked = rank_candidates([close, near_tie_loved], constraints)
    assert [item.place.slug for item in ranked] == ["b-loved", "d-close"]

from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from test_constraints_ranking import place, trip

from app.api.routes.trips import get_weather_provider
from app.domain.planner.budgeting import BudgetBreakdown
from app.domain.planner.config import DAY_EDGE_TOLERANCE_MINUTES
from app.domain.planner.constraints import filter_candidates
from app.domain.planner.planner import generate_options
from app.domain.planner.ranking import score_candidate
from app.domain.planner.scheduling import (
    PlannedDay,
    ScheduledItem,
    build_day,
    edge_minutes,
    is_light_food,
    is_main_dish,
    meal_rhythm_issues,
    minute_of_day,
    rain_on,
    trip_rain,
)
from app.domain.planner.types import candidate_from_place
from app.domain.planner.validation import validate_days
from app.infrastructure.db.session import SessionLocal
from app.infrastructure.repositories.places import PlaceRepository
from app.infrastructure.weather.provider import WeatherForecast, forecast_days
from app.main import app

VISIT_DATE = date(2026, 10, 20)


def food(slug: str, name: str = "", minutes: int = 60, **changes: object):
    return place(id=slug, slug=slug, name=name or slug, average_visit_minutes=minutes, **changes)


def day_of(constraints, *stops_with_start) -> PlannedDay:
    """A day visiting each stop at the given minute, in that order."""
    items = tuple(
        ScheduledItem(
            place=stop, sequence=sequence, start_minute=start,
            end_minute=start + stop.average_visit_minutes, visit_minutes=stop.average_visit_minutes,
            travel_minutes=0, travel_km=0.0, travel_cost=0, cost=BudgetBreakdown(), score=0, reasons=(),
        )
        for sequence, (stop, start) in enumerate(stops_with_start, start=1)
    )
    return PlannedDay(1, VISIT_DATE, items, BudgetBreakdown(), 0.0, 0)


def test_desserts_and_coffee_are_light_food_and_restaurants_are_main_dishes() -> None:
    assert is_light_food(food("che", "Chè Bốn Mùa Hàng Cân"))
    assert is_light_food(food("kem", "Kem Tràng Tiền", tags=("food", "dessert")))
    assert is_light_food(food("cafe", "Cộng", category="coffee"))
    assert not is_light_food(food("steak", "Le Monde Steak"))
    assert is_main_dish(food("pho", "Phở Bát Đàn"))
    assert not is_main_dish(place(slug="temple", category="history"))


def test_a_trip_with_several_interests_never_serves_two_main_dishes_in_a_row() -> None:
    constraints = trip(interests=["food", "history"])
    pho, bun_cha, che = food("pho", "Phở"), food("bun-cha", "Bún chả"), food("che", "Chè", minutes=30)
    temple = place(id="temple", slug="temple", category="history", average_visit_minutes=60)
    assert meal_rhythm_issues(day_of(constraints, (pho, 11 * 60), (bun_cha, 15 * 60)), constraints) == 1
    assert meal_rhythm_issues(day_of(constraints, (pho, 11 * 60), (che, 12 * 60 + 5),
                                     (temple, 13 * 60), (bun_cha, 17 * 60)), constraints) == 0
    # A dessert between them does not make two main dishes within two hours reasonable.
    assert meal_rhythm_issues(day_of(constraints, (pho, 11 * 60), (che, 12 * 60 + 5),
                                     (bun_cha, 12 * 60 + 40)), constraints) == 1


def test_a_food_trip_may_alternate_main_dishes_with_time_between_them() -> None:
    constraints = trip(interests=["food"])
    dishes = [food(f"dish-{index}", f"Quán {index}") for index in range(3)]
    spaced = day_of(constraints, (dishes[0], 11 * 60), (dishes[1], 12 * 60 + 40))
    assert meal_rhythm_issues(spaced, constraints) == 0
    rushed = day_of(constraints, (dishes[0], 11 * 60), (dishes[1], 12 * 60))
    assert meal_rhythm_issues(rushed, constraints) == 1
    three_in_a_row = day_of(constraints, (dishes[0], 11 * 60), (dishes[1], 12 * 60 + 40),
                            (dishes[2], 14 * 60 + 20))
    assert meal_rhythm_issues(three_in_a_row, constraints) == 1


def test_edge_minutes_counts_a_late_start_and_an_early_end_beyond_half_an_hour() -> None:
    constraints = trip(dailyStartTime="08:00", dailyEndTime="21:00")
    temple = place(id="temple", slug="temple", category="history", average_visit_minutes=60)
    lake = place(id="lake", slug="lake", category="park", average_visit_minutes=60)
    on_time = day_of(constraints, (temple, 8 * 60 + 20), (lake, 19 * 60 + 40))
    assert edge_minutes(on_time, constraints) == 0
    late_and_early = day_of(constraints, (temple, 9 * 60 + 30), (lake, 18 * 60))
    assert edge_minutes(late_and_early, constraints) == (90 - 30) + (120 - 30)


def test_must_see_places_stay_in_the_pool_whatever_the_interests() -> None:
    constraints = trip(interests=["food"])
    lake = place(id="lake", slug="hoan-kiem-lake", category="park", tags=("park",), highlight_level="must_see")
    plain = place(id="park", slug="plain-park", category="park", tags=("park",))
    pho = food("pho", "Phở")
    kept = {item.slug for item in filter_candidates([lake, plain, pho, food("bun", "Bún")], constraints)}
    assert "hoan-kiem-lake" in kept and "plain-park" not in kept


def test_each_day_is_planned_with_its_own_rain_forecast() -> None:
    rain = {VISIT_DATE: 0.9, VISIT_DATE + timedelta(days=1): None}
    assert rain_on(rain, VISIT_DATE) == 0.9
    assert rain_on(rain, VISIT_DATE + timedelta(days=1)) is None
    assert rain_on(0.3, VISIT_DATE) == 0.3
    assert trip_rain(rain) == 0.9 and trip_rain({VISIT_DATE: None}) is None
    constraints = trip(days=1, startDate=VISIT_DATE)
    indoor = place(id="indoor", slug="indoor", category="museum", indoor=True, outdoor=False)
    outdoor = place(id="outdoor", slug="outdoor", category="park", latitude=21.035, indoor=False, outdoor=True)
    scored = [score_candidate(indoor, constraints), score_candidate(outdoor, constraints)]
    day = build_day(1, VISIT_DATE, scored, constraints, rain)
    assert [item.place.id for item in day.items] == ["outdoor", "indoor"]


class DayByDayWeather:
    def forecast(self, latitude: float, longitude: float, day: date) -> WeatherForecast:
        if day.day % 2:
            return WeatherForecast(day, None, False, "Forecast not available for this date")
        return WeatherForecast(day, day.day / 100, True)


def test_every_trip_day_gets_a_forecast_entry() -> None:
    forecasts = forecast_days(DayByDayWeather(), 21.03, 105.85, VISIT_DATE, 3)
    assert [forecast.date for forecast in forecasts] == [VISIT_DATE + timedelta(days=n) for n in range(3)]
    app.dependency_overrides[get_weather_provider] = DayByDayWeather
    try:
        response = TestClient(app).get("/api/v1/weather/days", params={
            "latitude": 21.034, "longitude": 105.85, "start": VISIT_DATE.isoformat(), "days": 3,
        })
    finally:
        app.dependency_overrides.pop(get_weather_provider, None)
    assert response.status_code == 200
    days = response.json()
    assert [entry["date"] for entry in days] == ["2026-10-20", "2026-10-21", "2026-10-22"]
    assert days[0] == {"date": "2026-10-20", "available": True, "afternoonRainProbability": 0.2, "warning": None}
    assert days[1]["available"] is False and days[1]["warning"]


@pytest.mark.parametrize("values", [
    {"days": 3, "budgetTotal": 3_000_000, "interests": ["food", "history", "local_culture"]},
    {"days": 2, "budgetTotal": 2_000_000, "interests": ["food"]},
    {"days": 2, "budgetTotal": 2_000_000, "interests": ["history"], "dailyStartTime": "09:00", "dailyEndTime": "18:00"},
    {"days": 4, "budgetTotal": 4_000_000, "interests": ["food", "history", "coffee", "local_culture"], "pace": "relaxed"},
])
def test_generated_days_keep_hours_must_see_stops_and_meal_rhythm(values) -> None:
    with SessionLocal() as session:
        places = [candidate_from_place(item) for item in PlaceRepository(session).list_active()]
    constraints = trip(startDate=VISIT_DATE, **values)
    start = minute_of_day(constraints.daily_start_time)
    end = minute_of_day(constraints.daily_end_time)
    for option in generate_options(places, constraints):
        assert validate_days(list(option.days), constraints) == []
        for day in option.days:
            label = (option.option_type, day.day_number)
            first, last = day.items[0], day.items[-1]
            assert first.start_minute - first.travel_minutes - start <= DAY_EDGE_TOLERANCE_MINUTES, label
            assert end - last.end_minute <= DAY_EDGE_TOLERANCE_MINUTES, label
            assert any(item.place.highlight_level == "must_see" for item in day.items), label
            assert meal_rhythm_issues(day, constraints) == 0, label

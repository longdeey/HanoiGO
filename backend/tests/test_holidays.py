from dataclasses import replace
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from test_constraints_ranking import place, trip

from app.domain.holidays import annual_window_contains, holidays_between, load_holidays
from app.domain.lunar import lunar_to_solar, solar_term_date, solar_to_lunar
from app.domain.planner.constraints import filter_candidates, is_available_on
from app.infrastructure.db.osm_import import ImportedPlace, drop_curated_duplicates, load_snapshot
from app.infrastructure.db.seed import load_curated, seed_places
from app.main import app


@pytest.mark.parametrize(("lunar", "solar"), [
    ((2024, 1, 1), date(2024, 2, 10)),   # Tết Giáp Thìn
    ((2025, 1, 1), date(2025, 1, 29)),   # Tết Ất Tỵ
    ((2026, 1, 1), date(2026, 2, 17)),   # Tết Bính Ngọ
    ((2027, 1, 1), date(2027, 2, 6)),    # Tết Đinh Mùi
    ((2026, 3, 10), date(2026, 4, 26)),  # Giỗ Tổ Hùng Vương
    ((2026, 8, 15), date(2026, 9, 25)),  # Trung thu
    ((2025, 12, 23), date(2026, 2, 10)), # Ông Công Ông Táo
])
def test_lunar_dates_match_the_vietnamese_calendar(lunar: tuple[int, int, int], solar: date) -> None:
    assert lunar_to_solar(*lunar) == solar
    assert solar_to_lunar(solar)[:3] == lunar


def test_leap_month_and_round_trip() -> None:
    # 2025 has a leap sixth month starting on 25 July.
    assert lunar_to_solar(2025, 6, 1, leap=True) == date(2025, 7, 25)
    assert solar_to_lunar(date(2025, 7, 25)) == (2025, 6, 1, True)
    assert lunar_to_solar(2026, 6, 1, leap=True) is None
    day = date(2024, 1, 1)
    for _ in range(1100):
        year, month, lunar_day, leap = solar_to_lunar(day)
        assert lunar_to_solar(year, month, lunar_day, leap) == day
        day += timedelta(days=1)


def test_thanh_minh_solar_term() -> None:
    assert solar_term_date(2025, 15) == date(2025, 4, 4)
    assert solar_term_date(2026, 15) == date(2026, 4, 5)


def test_calendar_covers_the_whole_year_with_public_holidays() -> None:
    holidays = load_holidays()
    assert len({holiday.key for holiday in holidays}) == len(holidays) >= 30
    year = holidays_between(date(2027, 1, 1), date(2027, 12, 31))
    months = {item.start.month for item in year}
    assert months == set(range(1, 13))
    public = {item.holiday.key for item in year if item.holiday.is_public_holiday}
    assert {"new_year", "lunar_new_year", "hung_kings", "reunification_day",
            "labour_day", "national_day"} <= public
    tet = next(item for item in year if item.holiday.key == "lunar_new_year")
    eve = next(item for item in year if item.holiday.key == "lunar_new_year_eve")
    assert tet.start == date(2027, 2, 6) and eve.start == date(2027, 2, 5)


def test_holiday_place_slugs_exist_in_the_curated_catalog() -> None:
    curated = {data["slug"] for data in load_curated()["places"]}
    for holiday in load_holidays():
        assert set(holiday.place_slugs) <= curated, holiday.key


def test_lunar_festival_place_moves_with_the_lunar_calendar() -> None:
    tet = place(category="festival", tags=("festival",), annual_calendar="lunar",
                annual_month=1, annual_day=1, annual_duration_days=3)
    assert is_available_on(tet, date(2026, 2, 17))
    assert is_available_on(tet, date(2027, 2, 8))
    assert not is_available_on(tet, date(2027, 2, 9))
    assert not is_available_on(tet, date(2026, 2, 1))
    assert filter_candidates([tet], trip(startDate=date(2027, 2, 6), days=1, interests=["festival"])) == [tet]
    assert filter_candidates([tet], trip(startDate=date(2027, 3, 6), days=1, interests=["festival"])) == []


def test_annual_window_spanning_new_year() -> None:
    assert annual_window_contains("solar", 12, 31, 2, date(2027, 1, 1))
    assert not annual_window_contains("solar", 12, 31, 2, date(2027, 1, 2))


def test_trip_lists_a_holiday_without_any_event_place() -> None:
    seed_places()
    payload = {
        "language": "vi", "startDate": "2027-05-01", "days": 1,
        "travelerCount": 2, "budgetTotal": 2_000_000,
        "startLocation": {"name": "Old Quarter", "latitude": 21.034, "longitude": 105.85},
        "interests": ["history", "food"], "travelMode": "walking",
    }
    response = TestClient(app).post("/api/v1/trips/generate", json=payload)
    assert response.status_code == 200, response.text
    holidays = {item["key"]: item for item in response.json()["holidays"]}
    labour = holidays["labour_day"]
    assert labour["name"] == "Quốc tế Lao động 1/5"
    assert labour["tripDates"] == ["2027-05-01"] and labour["isPublicHoliday"]
    assert labour["relatedPlaces"] == [] and labour["suggestion"]


def test_holiday_calendar_endpoint() -> None:
    seed_places()
    response = TestClient(app).get("/api/v1/holidays", params={
        "start": "2027-02-01", "days": 14, "language": "en",
    })
    assert response.status_code == 200, response.text
    names = [item["name"] for item in response.json()]
    assert "Tet (Lunar New Year)" in names and "Lunar New Year's Eve" in names
    tet = next(item for item in response.json() if item["key"] == "lunar_new_year")
    assert any(place["slug"] == "tet-traditional-old-quarter" for place in tet["relatedPlaces"])


def test_snapshot_rows_duplicating_curated_places_are_dropped() -> None:
    snapshot = load_snapshot()
    kept = {item.slug for item in drop_curated_duplicates(snapshot)}
    assert "chua-thay-osm-550537567" not in kept          # same OSM element as curated Thay Pagoda
    nearby_food = ImportedPlace(
        slug="noodles-osm-1", osm_id="node/1", name_en="Noodles", name_vi="Bún", latitude=21.0287,
        longitude=105.8522, category="food", tags=["food"], average_cost=50_000, entrance_fee=0,
        average_visit_minutes=40, indoor=True, outdoor=False, local_score=60,
        opening_hours={}, hours_from_osm=False, description_en="", description_vi="",
        source="https://www.openstreetmap.org/node/1",
    )
    assert drop_curated_duplicates([nearby_food]) == [nearby_food]
    # A different pagoda 59 m from Phu Dong Temple is a separate venue.
    other_pagoda = replace(nearby_food, slug="chua-kien-bai-osm-2", name_en="Chùa Kiến Bái", name_vi="Chùa Kiến Bái",
                           latitude=21.0554316, longitude=105.9604847, category="history",
                           source="https://www.openstreetmap.org/node/2")
    assert drop_curated_duplicates([other_pagoda]) == [other_pagoda]

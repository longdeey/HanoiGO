from dataclasses import replace
from datetime import date

from fastapi.testclient import TestClient
from test_constraints_ranking import place, trip

from app.domain.planner.constraints import distance_km, filter_candidates, fits_opening_hours
from app.domain.planner.planner import generate_options
from app.domain.planner.ranking import score_candidate
from app.domain.planner.scheduling import build_day, opening_start
from app.domain.planner.types import candidate_from_place
from app.domain.planner.validation import validate_days
from app.infrastructure.db.seed import seed_places
from app.infrastructure.db.session import SessionLocal
from app.infrastructure.repositories.places import PlaceRepository
from app.main import app


def test_one_day_event_is_filtered_and_never_scheduled_on_the_wrong_date() -> None:
    event = place(
        category="festival", tags=("festival", "local_culture"),
        available_from=date(2026, 9, 25), available_until=date(2026, 9, 25),
        opening_hours={"4": [["19:00", "21:00"]]}, average_visit_minutes=60,
    )
    festival_day = trip(startDate=date(2026, 9, 25), days=1, interests=["festival"])
    day_before = trip(startDate=date(2026, 9, 24), days=1, interests=["festival"])
    assert fits_opening_hours(event, festival_day)
    assert not fits_opening_hours(event, day_before)
    assert filter_candidates([event], festival_day) == [event]
    assert filter_candidates([event], day_before) == []
    assert opening_start(event, date(2026, 9, 24), 8 * 60, 21 * 60) is None
    scheduled = build_day(1, date(2026, 9, 25), [score_candidate(event, festival_day)], festival_day)
    assert scheduled.items[0].start_minute >= 19 * 60
    assert validate_days([scheduled], festival_day) == []
    assert "Place closed at scheduled time" in validate_days([
        replace(scheduled, date=date(2026, 9, 24))
    ], day_before)


def test_seeded_mid_autumn_trip_has_date_specific_highlights_and_valid_options() -> None:
    seed_places()
    with SessionLocal() as session:
        places = [candidate_from_place(item) for item in PlaceRepository(session).list_active()]
    assert len(places) >= 85
    assert any("hiking" in item.tags for item in places)
    assert any("festival" in item.tags for item in places)
    request = {
        "language": "vi", "startDate": "2026-09-25", "days": 3,
        "travelerCount": 2, "budgetTotal": 3_000_000,
        "startLocation": {"name": "Phố cổ", "latitude": 21.034, "longitude": 105.85},
        "interests": ["festival", "local_culture", "food", "history"],
        "travelMode": "walking", "travelRadiusMode": "balanced", "pace": "balanced",
        "dailyStartTime": "08:00", "dailyEndTime": "21:00",
    }
    response = TestClient(app).post("/api/v1/trips/generate", json=request)
    assert response.status_code == 200, response.text
    payload = response.json()
    assert len(payload["options"]) == 3
    assert any("Hàng Mã" in item["place"]["name"] for item in payload["seasonalHighlights"])
    assert any("Đêm Trăng" in item["place"]["name"] for item in payload["seasonalHighlights"])
    for option in payload["options"]:
        assert option["budget"]["remaining"] >= 0
        for day in option["days"]:
            for item in day["items"]:
                if item["place"]["category"] == "festival" and not item["place"]["annual"]:
                    assert item["place"]["availableFrom"] <= day["date"] <= item["place"]["availableUntil"]
    assert any(
        any(item["place"]["slug"] == "hang-ma-mid-autumn" for day in option["days"] for item in day["items"])
        for option in payload["options"]
    )


def test_hiking_interest_and_outskirts_radius_produce_a_valid_nature_route() -> None:
    seed_places()
    with SessionLocal() as session:
        places = [candidate_from_place(item) for item in PlaceRepository(session).list_active()]
    constraints = trip(
        startDate=date(2026, 10, 1), days=2, budgetTotal=5_000_000,
        travelMode="car", travelRadiusMode="outskirts", interests=["hiking", "nature"],
        dailyStartTime="06:00", dailyEndTime="20:00",
    )
    options = generate_options(places, constraints)
    assert len(options) == 3
    assert any(
        "hiking" in item.place.tags for option in options for day in option.days for item in day.items
    )
    assert all(validate_days(list(option.days), constraints) == [] for option in options)


def test_event_highlights_disappear_after_the_verified_2026_window() -> None:
    payload = {
        "language": "en", "startDate": "2026-11-01", "days": 2,
        "travelerCount": 2, "budgetTotal": 3_000_000,
        "startLocation": {"name": "Old Quarter", "latitude": 21.034, "longitude": 105.85},
        "interests": ["history", "food"], "travelMode": "walking",
        "travelRadiusMode": "balanced", "pace": "balanced",
        "dailyStartTime": "08:00", "dailyEndTime": "21:00",
    }
    response = TestClient(app).post("/api/v1/trips/generate", json=payload)
    assert response.status_code == 200, response.text
    assert response.json()["seasonalHighlights"] == []


def test_annual_vietnamese_holiday_highlight_repeats_in_a_future_year() -> None:
    seed_places()
    payload = {
        "language": "vi", "startDate": "2027-09-02", "days": 1,
        "travelerCount": 2, "budgetTotal": 2_000_000,
        "startLocation": {"name": "Old Quarter", "latitude": 21.034, "longitude": 105.85},
        "interests": ["festival", "history"], "travelMode": "walking",
        "travelRadiusMode": "balanced", "pace": "balanced",
        "dailyStartTime": "08:00", "dailyEndTime": "21:00",
    }
    response = TestClient(app).post("/api/v1/trips/generate", json=payload)
    assert response.status_code == 200, response.text
    highlights = response.json()["seasonalHighlights"]
    assert any(item["place"]["slug"] == "national-day-hanoi" for item in highlights)
    assert any(item["place"]["annual"] for item in highlights)


def test_hòa_lạc_start_has_local_places_and_stays() -> None:
    seed_places()
    payload = {
        "language": "vi", "startDate": "2027-05-10", "days": 2,
        "travelerCount": 2, "budgetTotal": 3_000_000,
        "startLocation": {"name": "Hòa Lạc", "latitude": 21.015, "longitude": 105.525},
        "interests": ["nature", "food", "local_culture"], "travelMode": "motorbike",
        "travelRadiusMode": "balanced", "pace": "balanced",
        "dailyStartTime": "08:00", "dailyEndTime": "21:00",
    }
    response = TestClient(app).post("/api/v1/trips/generate", json=payload)
    assert response.status_code == 200, response.text
    payload = response.json()
    assert all(option["days"] for option in payload["options"])
    # Every option shows something famous around the base, not only downtown.
    for option in payload["options"]:
        assert any(item["place"]["highlightLevel"] != "standard"
                   and distance_km(21.015, 105.525, item["place"]["latitude"], item["place"]["longitude"]) <= 15
                   for day in option["days"] for item in day["items"]), option["type"]
    assert any(item["category"] == "accommodation" for item in payload["stayOptions"])

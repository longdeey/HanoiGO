from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import httpx
from fastapi.testclient import TestClient
from test_constraints_ranking import place, trip

from app.api.routes.trips import get_weather_provider
from app.domain.planner.ranking import score_candidate
from app.domain.planner.scheduling import build_day
from app.infrastructure.weather.provider import OpenMeteoWeatherProvider, WeatherForecast
from app.main import app


class RainyWeather:
    def forecast(self, latitude: float, longitude: float, day: date) -> WeatherForecast:
        return WeatherForecast(day, 0.9, True)


def test_weather_endpoint_uses_structured_provider() -> None:
    app.dependency_overrides[get_weather_provider] = RainyWeather
    response = TestClient(app).get("/api/v1/weather", params={
        "latitude": 21.034, "longitude": 105.85, "day": "2026-09-15",
    })
    assert response.status_code == 200
    assert response.json()["afternoonRainProbability"] == 0.9


def test_weather_provider_falls_back_after_bounded_failures(monkeypatch) -> None:
    attempts = 0

    def fail_get(self, url, *, params):
        nonlocal attempts
        attempts += 1
        raise httpx.ConnectError("offline")

    monkeypatch.setattr(httpx.Client, "get", fail_get)
    forecast = OpenMeteoWeatherProvider().forecast(21.034, 105.85, datetime.now(ZoneInfo("Asia/Ho_Chi_Minh")).date() + timedelta(days=2))
    assert attempts == OpenMeteoWeatherProvider.MAX_ATTEMPTS
    assert not forecast.available
    assert forecast.afternoon_rain_probability is None


def test_rainy_schedule_prioritizes_outdoor_before_indoor() -> None:
    constraints = trip(days=1, startDate=date(2026, 9, 15))
    indoor = place(id="indoor", slug="indoor", category="museum", latitude=21.034,
                   indoor=True, outdoor=False)
    outdoor = place(id="outdoor", slug="outdoor", category="park", latitude=21.035,
                    indoor=False, outdoor=True)
    scored = [score_candidate(indoor, constraints, 0.9), score_candidate(outdoor, constraints, 0.9)]
    day = build_day(1, date(2026, 9, 15), scored, constraints, 0.9)
    assert [item.place.id for item in day.items] == ["outdoor", "indoor"]

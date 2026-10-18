from collections.abc import Iterator
from datetime import date

import pytest

from app.api.routes.trips import get_weather_provider
from app.infrastructure.weather.provider import WeatherForecast
from app.main import app


class NeutralWeather:
    def forecast(self, latitude: float, longitude: float, day: date) -> WeatherForecast:
        return WeatherForecast(day, None, False, "Weather unavailable in tests")


@pytest.fixture(autouse=True)
def no_external_weather() -> Iterator[None]:
    app.dependency_overrides[get_weather_provider] = NeutralWeather
    yield
    app.dependency_overrides.pop(get_weather_provider, None)

import logging
from dataclasses import dataclass
from datetime import date
from typing import Protocol

import httpx

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class WeatherForecast:
    date: date
    afternoon_rain_probability: float | None
    available: bool
    warning: str | None = None


class WeatherProvider(Protocol):
    def forecast(self, latitude: float, longitude: float, day: date) -> WeatherForecast: ...


class OpenMeteoWeatherProvider:
    BASE_URL = "https://api.open-meteo.com/v1/forecast"
    TIMEOUT_SECONDS = 2.5
    MAX_ATTEMPTS = 2

    def forecast(self, latitude: float, longitude: float, day: date) -> WeatherForecast:
        params = {
            "latitude": latitude, "longitude": longitude,
            "hourly": "precipitation_probability", "timezone": "Asia/Ho_Chi_Minh",
            "start_date": day.isoformat(), "end_date": day.isoformat(),
        }
        for attempt in range(self.MAX_ATTEMPTS):
            try:
                with httpx.Client(timeout=self.TIMEOUT_SECONDS) as client:
                    response = client.get(self.BASE_URL, params=params)
                    response.raise_for_status()
                hourly = response.json()["hourly"]
                probabilities = [
                    probability for timestamp, probability in zip(
                        hourly["time"], hourly["precipitation_probability"], strict=True
                    ) if timestamp.startswith(day.isoformat()) and 14 <= int(timestamp[11:13]) <= 17
                    and probability is not None
                ]
                if not probabilities:
                    return WeatherForecast(day, None, False, "Forecast not available for this date")
                return WeatherForecast(day, max(probabilities) / 100, True)
            except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
                logger.warning("Weather provider attempt %s failed: %s", attempt + 1, type(exc).__name__)
        return WeatherForecast(day, None, False, "Weather service temporarily unavailable")

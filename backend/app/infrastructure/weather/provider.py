import logging
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Protocol
from zoneinfo import ZoneInfo

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


def forecast_days(
    provider: WeatherProvider, latitude: float, longitude: float, first: date, days: int,
) -> list[WeatherForecast]:
    """One forecast per trip day: in one request when the provider can, else day by day."""
    many = getattr(provider, "forecast_range", None)
    if callable(many):
        return many(latitude, longitude, first, days)
    return [provider.forecast(latitude, longitude, first + timedelta(days=offset)) for offset in range(days)]


class OpenMeteoWeatherProvider:
    BASE_URL = "https://api.open-meteo.com/v1/forecast"
    TIMEOUT_SECONDS = 2.5
    MAX_ATTEMPTS = 2

    # Open-Meteo forecasts 16 days ahead; later days say the forecast is not out yet.
    FORECAST_HORIZON_DAYS = 16

    def forecast(self, latitude: float, longitude: float, day: date) -> WeatherForecast:
        return self.forecast_range(latitude, longitude, day, 1)[0]

    def forecast_range(self, latitude: float, longitude: float, first: date, days: int) -> list[WeatherForecast]:
        wanted = [first + timedelta(days=offset) for offset in range(days)]
        today = datetime.now(ZoneInfo("Asia/Ho_Chi_Minh")).date()
        horizon = today + timedelta(days=self.FORECAST_HORIZON_DAYS - 1)
        in_range = [day for day in wanted if today <= day <= horizon]
        if not in_range:
            return [WeatherForecast(day, None, False, "Forecast not available for this date") for day in wanted]
        params = {
            "latitude": latitude, "longitude": longitude,
            "hourly": "precipitation_probability", "timezone": "Asia/Ho_Chi_Minh",
            "start_date": in_range[0].isoformat(), "end_date": in_range[-1].isoformat(),
        }
        for attempt in range(self.MAX_ATTEMPTS):
            try:
                with httpx.Client(timeout=self.TIMEOUT_SECONDS) as client:
                    response = client.get(self.BASE_URL, params=params)
                    response.raise_for_status()
                hourly = response.json()["hourly"]
                afternoon: dict[str, list[float]] = {}
                for timestamp, probability in zip(hourly["time"], hourly["precipitation_probability"], strict=True):
                    if probability is not None and 14 <= int(timestamp[11:13]) <= 17:
                        afternoon.setdefault(timestamp[:10], []).append(probability)
                return [
                    WeatherForecast(day, max(afternoon[day.isoformat()]) / 100, True)
                    if afternoon.get(day.isoformat())
                    else WeatherForecast(day, None, False, "Forecast not available for this date")
                    for day in wanted
                ]
            except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
                logger.warning("Weather provider attempt %s failed: %s", attempt + 1, type(exc).__name__)
        return [WeatherForecast(day, None, False, "Weather service temporarily unavailable") for day in wanted]

"""Year-round Vietnamese holiday calendar (data/vietnam_holidays.json)."""

import json
from dataclasses import dataclass
from datetime import date, timedelta
from functools import lru_cache
from pathlib import Path
from typing import Literal

from app.domain.lunar import lunar_to_solar, solar_term_date

HOLIDAYS_PATH = Path(__file__).resolve().parents[2] / "data" / "vietnam_holidays.json"

Calendar = Literal["solar", "lunar", "solar_term"]


@dataclass(frozen=True)
class Holiday:
    key: str
    calendar: Calendar
    kind: str
    name_vi: str
    name_en: str
    description_vi: str
    description_en: str
    suggestion_vi: str
    suggestion_en: str
    duration_days: int = 1
    month: int | None = None
    day: int | None = None
    longitude: float | None = None
    offset_days: int = 0
    place_slugs: tuple[str, ...] = ()

    @property
    def is_public_holiday(self) -> bool:
        return self.kind == "public_holiday"


@dataclass(frozen=True)
class HolidayOccurrence:
    holiday: Holiday
    start: date
    end: date  # inclusive

    def overlaps(self, first: date, last: date) -> bool:
        return self.start <= last and first <= self.end

    def dates_within(self, first: date, last: date) -> list[date]:
        day = max(self.start, first)
        result = []
        while day <= min(self.end, last):
            result.append(day)
            day += timedelta(days=1)
        return result


@lru_cache(maxsize=1)
def load_holidays(path: Path = HOLIDAYS_PATH) -> tuple[Holiday, ...]:
    rows = json.loads(path.read_text(encoding="utf-8"))["holidays"]
    return tuple(
        Holiday(**{**row, "place_slugs": tuple(row.get("place_slugs", ()))}) for row in rows
    )


def annual_start(calendar: Calendar, year: int, month: int | None, day: int | None,
                 longitude: float | None = None) -> date | None:
    """Solar start date of a recurring date in the solar year (or lunar year) ``year``."""
    if calendar == "solar_term":
        return solar_term_date(year, longitude or 0.0)
    if month is None or day is None:
        return None
    if calendar == "lunar":
        return lunar_to_solar(year, month, day)
    try:
        return date(year, month, day)
    except ValueError:
        return None


def annual_window_contains(calendar: Calendar, month: int, day: int, duration_days: int,
                           target: date, offset_days: int = 0) -> bool:
    """Whether ``target`` falls inside a recurring window, including windows spanning New Year."""
    for year in (target.year - 1, target.year, target.year + 1):
        start = annual_start(calendar, year, month, day)
        if start is None:
            continue
        start += timedelta(days=offset_days)
        if start <= target < start + timedelta(days=duration_days):
            return True
    return False


def holidays_between(first: date, last: date) -> list[HolidayOccurrence]:
    """Every holiday occurrence overlapping [first, last], ordered by date."""
    found: list[HolidayOccurrence] = []
    for holiday in load_holidays():
        for year in range(first.year - 1, last.year + 2):
            start = annual_start(holiday.calendar, year, holiday.month, holiday.day, holiday.longitude)
            if start is None:
                continue
            start += timedelta(days=holiday.offset_days)
            occurrence = HolidayOccurrence(
                holiday, start, start + timedelta(days=holiday.duration_days - 1)
            )
            if occurrence.overlaps(first, last):
                found.append(occurrence)
    return sorted(found, key=lambda item: (item.start, item.holiday.kind != "public_holiday",
                                           item.holiday.key))

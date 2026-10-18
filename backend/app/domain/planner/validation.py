from datetime import time

from app.domain.planner.budgeting import BudgetBreakdown
from app.domain.planner.constraints import is_available_on
from app.domain.planner.scheduling import PlannedDay, minute_of_day
from app.domain.planner.types import TripConstraints


def validate_days(days: list[PlannedDay], constraints: TripConstraints) -> list[str]:
    errors: list[str] = []
    if len(days) != constraints.days:
        errors.append("Incorrect number of days")
    seen: set[str] = set()
    total = BudgetBreakdown()
    for day_number, day in enumerate(days, start=1):
        if day.day_number != day_number or not day.items:
            errors.append(f"Day {day_number} has no valid activities or incorrect number")
        previous_end = minute_of_day(constraints.daily_start_time)
        for sequence, item in enumerate(day.items, start=1):
            if item.sequence != sequence:
                errors.append("Non-contiguous item sequence")
            if item.place.id in seen:
                errors.append("Duplicate place")
            seen.add(item.place.id)
            if item.start_minute < previous_end + item.travel_minutes:
                errors.append("Overlapping activity or insufficient travel time")
            if item.end_minute > minute_of_day(constraints.daily_end_time):
                errors.append("Activity outside daily window")
            if item.end_minute - item.start_minute != item.visit_minutes:
                errors.append("Incorrect visit duration")
            if not item.place.is_active:
                errors.append("Inactive place")
            valid_window = any(
                item.start_minute >= minute_of_day(time.fromisoformat(opening))
                and item.end_minute <= minute_of_day(time.fromisoformat(closing))
                for opening, closing in item.place.opening_hours.get(str(day.date.weekday()), [])
            )
            if not valid_window or not is_available_on(item.place, day.date):
                errors.append("Place closed at scheduled time")
            previous_end = item.end_minute
        total += day.cost
    if total.total > constraints.budget_total:
        errors.append("Budget exceeded")
    return errors

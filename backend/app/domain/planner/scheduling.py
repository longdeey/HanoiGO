from collections.abc import Callable, Iterator, Mapping
from dataclasses import dataclass, replace
from datetime import date, time

from app.domain.planner.budgeting import BudgetBreakdown, place_cost
from app.domain.planner.config import (
    DAY_EDGE_TOLERANCE_MINUTES,
    DINNER_START_MINUTE,
    EARLIEST_DINNER_MINUTE,
    EVENING_LEG_MINUTES,
    IDLE_MINUTE_KM_EQUIVALENT,
    LAST_DINNER_STRETCH_FACTOR,
    LIGHT_FOOD_WORDS,
    LUNCH_END_MINUTE,
    LUNCH_MORNING_OVERRUN_MINUTES,
    LUNCH_START_MINUTE,
    MAIN_DISH_SPACING_MINUTES,
    MAIN_MEAL_MINUTES,
    MAX_STAY_EXTENSION_SHARE,
    MAX_STAY_STRETCH_FACTOR,
    RAIN_AFTERNOON_START_MINUTE,
    RAIN_PROBABILITY_THRESHOLD,
    ROUTE_IMPROVEMENT_PASSES,
    ROUTE_MOVE_MAX_SEGMENT,
    TREATS_PER_DAY,
)
from app.domain.planner.constraints import distance_km, is_available_on
from app.domain.planner.ranking import ScoredCandidate
from app.domain.planner.routing import route_order, travel_leg
from app.domain.planner.types import PlaceCandidate, TripConstraints

# One afternoon rain probability for the whole trip, or one per day (None: no forecast).
RainForecast = float | None | Mapping[date, float | None]


def rain_on(rain: RainForecast, day: date) -> float | None:
    """The afternoon rain probability forecast for ``day``."""
    return rain.get(day) if isinstance(rain, Mapping) else rain


def trip_rain(rain: RainForecast) -> float | None:
    """One figure for ranking places: the wettest forecast day (None if no day has one)."""
    if not isinstance(rain, Mapping):
        return rain
    known = [value for value in rain.values() if value is not None]
    return max(known) if known else None


@dataclass(frozen=True)
class ScheduledItem:
    place: PlaceCandidate
    sequence: int
    start_minute: int
    end_minute: int
    visit_minutes: int
    travel_minutes: int
    travel_km: float
    travel_cost: int
    cost: BudgetBreakdown
    score: int
    reasons: tuple[str, ...]


@dataclass(frozen=True)
class PlannedDay:
    day_number: int
    date: date
    items: tuple[ScheduledItem, ...]
    cost: BudgetBreakdown
    distance_km: float
    travel_minutes: int


def minute_of_day(value: time) -> int:
    return value.hour * 60 + value.minute


def is_light_food(place: PlaceCandidate) -> bool:
    """A dessert, snack or drink (chè, kem, coffee...) rather than a main dish."""
    if place.category == "coffee" or "dessert" in place.tags:
        return True
    if place.category != "food":
        return False
    name = f" {place.name.lower()} "
    return any(f" {word} " in name or (len(word) > 4 and word in name) for word in LIGHT_FOOD_WORDS)


def is_main_dish(place: PlaceCandidate) -> bool:
    """Phở, bún chả, a restaurant meal: anything to eat that is not light food."""
    return place.category == "food" and not is_light_food(place)


def is_diverse_trip(constraints: TripConstraints) -> bool:
    """Several interests beyond eating and drinking (food with coffee is one taste)."""
    interests = set(constraints.interests)
    return len(interests) >= 2 and not interests <= {"food", "coffee"}


def meal_rhythm_issues(day: "PlannedDay", constraints: TripConstraints) -> int:
    """How often a day eats a main dish too soon after another.

    Every main dish starts at least MAIN_DISH_SPACING_MINUTES after the previous
    one. On a trip with several interests a main dish is never followed directly
    by another, nor a dessert or coffee by another light stop; a food-only or
    single-interest trip may serve two main dishes in a row, never three.
    """
    diverse = is_diverse_trip(constraints)
    spacing = MAIN_DISH_SPACING_MINUTES["diverse" if diverse else "single"]
    issues = run = 0
    previous_main: int | None = None
    for index, item in enumerate(day.items):
        if not is_main_dish(item.place):
            run = 0
            if diverse and index and is_light_food(item.place) and is_light_food(day.items[index - 1].place):
                issues += 1
            continue
        run += 1
        if previous_main is not None and item.start_minute - previous_main < spacing:
            issues += 1
        if run >= (2 if diverse else 3):
            issues += 1
        previous_main = item.start_minute
    return issues


def edge_minutes(day: "PlannedDay", constraints: TripConstraints) -> int:
    """How far the day starts late or ends early, beyond DAY_EDGE_TOLERANCE_MINUTES.

    The day starts when the traveler leaves for the first stop and ends when
    the last stop does; both stay within half an hour of the times they entered.
    """
    if not day.items:
        return 0
    first, last = day.items[0], day.items[-1]
    late = first.start_minute - first.travel_minutes - minute_of_day(constraints.daily_start_time)
    early = minute_of_day(constraints.daily_end_time) - last.end_minute
    return max(0, late - DAY_EDGE_TOLERANCE_MINUTES) + max(0, early - DAY_EDGE_TOLERANCE_MINUTES)


def is_main_meal(place: PlaceCandidate) -> bool:
    return place.category == "food" and place.average_visit_minutes >= MAIN_MEAL_MINUTES


def is_food_or_coffee(place: PlaceCandidate) -> bool:
    return place.category in {"food", "coffee"}


def gap_minutes(day: PlannedDay) -> int:
    """Time spent waiting between arriving at a stop and starting the visit."""
    return sum(
        max(0, second.start_minute - second.travel_minutes - first.end_minute)
        for first, second in zip(day.items, day.items[1:])
    )


def _opening_interval(place: PlaceCandidate, day: date, start: int, end: int) -> tuple[int, int] | None:
    """The opening interval (opening, closing minute) that contains [start, end]."""
    for opening, closing in place.opening_hours.get(str(day.weekday()), []):
        opened = minute_of_day(time.fromisoformat(opening))
        closed = minute_of_day(time.fromisoformat(closing))
        if opened <= start and end <= closed:
            return opened, closed
    return None


def _opening_close(place: PlaceCandidate, day: date, start: int, end: int) -> int | None:
    """Closing minute of the opening interval that contains [start, end]."""
    interval = _opening_interval(place, day, start, end)
    return None if interval is None else interval[1]


def fit_day_edges(
    items: list[ScheduledItem], day: date, constraints: TripConstraints,
    lunch: PlaceCandidate | None, dinner: PlaceCandidate | None,
) -> list[ScheduledItem]:
    """Start the day near the traveler's start time and end it near their end time.

    Absorbing waits pushes stops later, so a day can begin an hour after the
    traveler is ready; the first stop then starts earlier and lasts longer.
    Likewise the last stop stays longer when the day would end early. Both stay
    within opening hours, meal slots and the stretch limits of close_gaps; what
    remains is left to the planner, which adds stops.
    """
    if not items:
        return items
    items = list(items)
    tolerance = DAY_EDGE_TOLERANCE_MINUTES
    first = items[0]
    late = first.start_minute - first.travel_minutes - minute_of_day(constraints.daily_start_time) - tolerance
    interval = _opening_interval(first.place, day, first.start_minute, first.end_minute)
    if late > 0 and interval is not None:
        earlier = min(
            late, max(0, _stretch_limit(first.place) - first.visit_minutes),
            first.start_minute - max(interval[0], _earliest_start(first, dinner)),
        )
        if earlier > 0:
            items[0] = first = replace(first, start_minute=first.start_minute - earlier,
                                       visit_minutes=first.visit_minutes + earlier)
    last = items[-1]
    early = minute_of_day(constraints.daily_end_time) - tolerance - last.end_minute
    limit = _latest_end(last, day, constraints, lunch)
    last_stretch = (last.place.average_visit_minutes * LAST_DINNER_STRETCH_FACTOR
                    if dinner is not None and last.place.id == dinner.id else _stretch_limit(last.place))
    if early > 0 and limit is not None:
        longer = min(early, max(0, last_stretch - last.visit_minutes),
                     max(0, limit - last.end_minute))
        if longer > 0:
            items[-1] = last = replace(last, end_minute=last.end_minute + longer,
                                       visit_minutes=last.visit_minutes + longer)
        # Still early (typically dinner, where little else is open at night):
        # the last stop starts later and the stop before it stays longer, so
        # the evening is not cut short and no wait appears in between.
        early = minute_of_day(constraints.daily_end_time) - tolerance - last.end_minute
        if early > 0 and len(items) > 1:
            previous = items[-2]
            previous_limit = _latest_end(previous, day, constraints, lunch)
            if previous_limit is not None:
                push = min(early, max(0, limit - last.end_minute),
                           max(0, _stretch_limit(previous.place) - previous.visit_minutes),
                           max(0, previous_limit - previous.end_minute))
                if push > 0:
                    items[-2] = replace(previous, end_minute=previous.end_minute + push,
                                        visit_minutes=previous.visit_minutes + push)
                    items[-1] = replace(last, start_minute=last.start_minute + push,
                                        end_minute=last.end_minute + push)
    # Still early: the whole tail of the day moves later, an earlier stop that
    # is still open staying longer to make room (a long day, a quiet evening).
    target = minute_of_day(constraints.daily_end_time) - tolerance
    for index in range(len(items) - 3, -1, -1):
        early = target - items[-1].end_minute
        if early <= 0:
            break
        anchor = items[index]
        anchor_limit = _latest_end(anchor, day, constraints, lunch)
        if anchor_limit is None:
            continue
        push = min(early, max(0, _stretch_limit(anchor.place) - anchor.visit_minutes),
                   max(0, anchor_limit - anchor.end_minute))
        for later in items[index + 1:]:
            later_limit = _latest_end(later, day, constraints, lunch)
            push = min(push, 0 if later_limit is None else max(0, later_limit - later.end_minute))
        if push <= 0:
            continue
        items[index] = replace(anchor, end_minute=anchor.end_minute + push,
                               visit_minutes=anchor.visit_minutes + push)
        for position in range(index + 1, len(items)):
            later = items[position]
            items[position] = replace(later, start_minute=later.start_minute + push,
                                      end_minute=later.end_minute + push)
    return items


def close_gaps(
    items: list[ScheduledItem], day: date, constraints: TripConstraints,
    lunch: PlaceCandidate | None, dinner: PlaceCandidate | None = None,
) -> list[ScheduledItem]:
    """Make each stop end exactly when the traveler must leave for the next one.

    Walking backward through the day, a stop followed by a wait (the next place
    opens later, or dinner starts at a fixed hour) first stays longer, by up to
    ``MAX_STAY_EXTENSION_SHARE`` of its visit, then starts later. Both moves keep
    it inside its opening hours, the daily window and, for meals, the lunch or
    breakfast slot (a morning snack or coffee ends by the start of lunch).
    Pushing a stop later moves the wait to before it, where the previous stop
    absorbs it in turn; whatever is left ends up before the first stop, so the
    day simply starts later instead of pausing in the middle.

    A wait can still remain where a slot is fixed on both sides, typically
    after a lunch that must end by LUNCH_END_MINUTE. A second, forward pass
    then lets the stop after the wait start as soon as the traveler arrives
    (while open and, for meals, within their slot) or the stop before it stay longer,
    up to ``MAX_STAY_STRETCH_FACTOR`` times its usual visit. A day with too
    few stops for its hours can keep a wait; the planner adds stops to such days.
    """
    items = list(items)
    for index in range(len(items) - 2, -1, -1):
        item, following = items[index], items[index + 1]
        gap = following.start_minute - following.travel_minutes - item.end_minute
        if gap <= 0:
            continue
        limit = _latest_end(item, day, constraints, lunch)
        if limit is None:
            continue
        room = max(0, limit - item.end_minute)
        extend = min(gap, room, int(item.visit_minutes * MAX_STAY_EXTENSION_SHARE))
        shift = min(gap - extend, room - extend)
        if extend <= 0 and shift <= 0:
            continue
        items[index] = replace(
            item, start_minute=item.start_minute + shift,
            end_minute=item.end_minute + shift + extend,
            visit_minutes=item.visit_minutes + extend,
        )
    for index in range(1, len(items)):
        previous, item = items[index - 1], items[index]
        gap = item.start_minute - item.travel_minutes - previous.end_minute
        if gap > 0:
            stretch = _stretch_limit(item.place) - item.visit_minutes
            earlier = min(gap, max(0, stretch), item.start_minute - _earliest_start(item, dinner))
            if earlier > 0 and _opening_close(
                item.place, day, item.start_minute - earlier, item.end_minute,
            ) is not None:
                items[index] = replace(item, start_minute=item.start_minute - earlier,
                                       visit_minutes=item.visit_minutes + earlier)
                gap -= earlier
        if gap > 0:
            limit = _latest_end(previous, day, constraints, lunch) or previous.end_minute
            stretch = _stretch_limit(previous.place) - previous.visit_minutes
            longer = min(gap, max(0, stretch), max(0, limit - previous.end_minute))
            if longer > 0:
                items[index - 1] = replace(previous, end_minute=previous.end_minute + longer,
                                           visit_minutes=previous.visit_minutes + longer)
    return items


def _stretch_limit(place: PlaceCandidate) -> int:
    kind = "food" if is_food_or_coffee(place) else "sight"
    return place.average_visit_minutes * MAX_STAY_STRETCH_FACTOR[kind]


def _earliest_start(item: ScheduledItem, dinner: PlaceCandidate | None) -> int:
    """Earliest minute a meal may be moved to: dinner keeps its evening slot and
    any other seated meal starts no earlier than lunch."""
    if dinner is not None and item.place.id == dinner.id:
        return EARLIEST_DINNER_MINUTE
    if is_main_meal(item.place):
        return LUNCH_START_MINUTE
    return 0


def _latest_end(
    item: ScheduledItem, day: date, constraints: TripConstraints, lunch: PlaceCandidate | None,
) -> int | None:
    """Latest minute a scheduled stop may end: its closing time, the daily
    window and, for meals, the lunch slot or (for a morning snack) lunchtime."""
    closing = _opening_close(item.place, day, item.start_minute, item.end_minute)
    if closing is None:
        return None
    limit = min(closing, minute_of_day(constraints.daily_end_time))
    if lunch is not None and item.place.id == lunch.id:
        limit = min(limit, LUNCH_END_MINUTE)
    elif (is_food_or_coffee(item.place) and not is_main_meal(item.place)
          and item.start_minute < LUNCH_START_MINUTE):
        limit = min(limit, LUNCH_START_MINUTE)
    return limit


def opening_start(
    place: PlaceCandidate, day: date, earliest: int, latest: int
) -> int | None:
    if not is_available_on(place, day):
        return None
    for opening, closing in place.opening_hours.get(str(day.weekday()), []):
        opened = minute_of_day(time.fromisoformat(opening))
        closed = minute_of_day(time.fromisoformat(closing))
        start = max(earliest, opened)
        if is_main_meal(place) and start < LUNCH_START_MINUTE:
            start = LUNCH_START_MINUTE
        if start + place.average_visit_minutes <= min(closed, latest):
            return start
    return None


def build_day(
    day_number: int, day: date, candidates: list[ScoredCandidate],
    constraints: TripConstraints, rain_probability: RainForecast = None,
    allow_premium_food: bool = False, optimize_route: bool = True, max_cost: int | None = None,
) -> PlannedDay:
    """Schedule one day. Meal slots and opening hours shape the order first;
    ``optimize_route`` then shortens the route without changing the stops,
    keeping the day's cost (rides included) within ``max_cost`` when given."""
    rain_probability = rain_on(rain_probability, day)
    by_id = {candidate.place.id: candidate for candidate in candidates}
    earliest = minute_of_day(constraints.daily_start_time)
    latest = minute_of_day(constraints.daily_end_time)
    breakfast = next((candidate.place for candidate in candidates
                      if is_food_or_coffee(candidate.place)
                      and candidate.place.average_visit_minutes < MAIN_MEAL_MINUTES
                      and opening_start(candidate.place, day, earliest, min(latest, LUNCH_START_MINUTE - 30))
                      is not None), None)
    meals = [candidate.place for candidate in candidates
             if is_main_meal(candidate.place) and candidate.place != breakfast]
    lunch = next((place for place in meals if opening_start(
        place, day, max(earliest, LUNCH_START_MINUTE), min(latest, LUNCH_END_MINUTE)
    ) is not None), None)
    dinner = next((place for place in meals if place != lunch and opening_start(
        place, day, max(earliest, EARLIEST_DINNER_MINUTE), latest
    ) is not None), None)
    meal_ids = {place.id for place in (breakfast, lunch, dinner) if place is not None}
    # Food and coffee are reserved for the three meal slots. This prevents
    # routes such as bun cha -> pho or cafe -> cafe while preserving one
    # breakfast, lunch and dinner whenever the catalog has a feasible choice.
    premium_food = []
    if allow_premium_food:
        premium_food = [candidate.place for candidate in candidates
                        if candidate.place.id not in meal_ids
                        and is_food_or_coffee(candidate.place)
                        and (candidate.place.average_cost + candidate.place.entrance_fee) >= 500_000]
        premium_food = sorted(premium_food, key=lambda place: (-place.average_cost, place.slug))[:1]
    afternoon_bridge = next(
        (
            candidate.place for candidate in candidates
            if candidate.place.id not in meal_ids
            and not is_food_or_coffee(candidate.place)
            and opening_start(
                candidate.place, day, max(earliest, 14 * 60),
                min(latest, DINNER_START_MINUTE),
            ) is not None
        ),
        None,
    )
    bridge_id = afternoon_bridge.id if afternoon_bridge is not None else None
    # On a food-and-coffee trip every selected meal is a stop; a free stroll
    # added between meals does not change that.
    food_only_day = bool(candidates) and set(constraints.interests) <= {"food", "coffee"}
    # A dessert (or, on a coffee trip, a café) right after lunch and dinner:
    # light food never takes a meal slot's place nor waits elsewhere in the day.
    treats: list[PlaceCandidate] = []
    if not food_only_day:
        treats = [candidate.place for candidate in candidates
                  # A café counts too: coffee after a meal is how Hanoi spends its evenings.
                  if candidate.place.id not in meal_ids and is_light_food(candidate.place)
                  and candidate.place not in premium_food and candidate.place.id != bridge_id
                  ][:TREATS_PER_DAY]
    treat_ids = {place.id for place in treats}
    other_places = [candidate.place for candidate in candidates
                    if candidate.place.id not in meal_ids | treat_ids
                    and (
                        food_only_day
                        or not is_food_or_coffee(candidate.place)
                        or candidate.place in premium_food
                        or candidate.place.id == bridge_id
                    )]
    daytime = [place for place in other_places
               if (opening_start(place, day, earliest, latest) or latest) < DINNER_START_MINUTE]
    evening_short = False
    if dinner is not None:
        # The evening is filled up to the traveler's end time: a lake, a walking
        # street or a market open after dinner moves there from the day,
        # outdoor and nightlife stops first, until the evening's stops can
        # cover it (each may stay longer, see close_gaps), and beyond that only
        # what no longer fits before dinner.
        after_dinner = EARLIEST_DINNER_MINUTE + dinner.average_visit_minutes
        evening_span = (latest - DAY_EDGE_TOLERANCE_MINUTES - after_dinner
                        - (treats[1].average_visit_minutes if len(treats) > 1 else 0))
        evening_only = [place for place in other_places if place not in daytime]
        evening_load = sum(place.average_visit_minutes + EVENING_LEG_MINUTES for place in evening_only)
        evening_reach = sum(_stretch_limit(place) + EVENING_LEG_MINUTES for place in evening_only)
        daytime_left = DINNER_START_MINUTE - earliest - sum(
            place.average_visit_minutes + EVENING_LEG_MINUTES
            for place in (breakfast, lunch, afternoon_bridge, *treats[:1]) if place is not None
        )
        daytime_load = sum(place.average_visit_minutes + EVENING_LEG_MINUTES for place in daytime)
        for place in sorted(
            (place for place in daytime if not is_food_or_coffee(place) and place.id != bridge_id
             and opening_start(place, day, after_dinner, latest) is not None),
            key=lambda place: ("nightlife" not in place.tags, place.indoor),
        ):
            cost = place.average_visit_minutes + EVENING_LEG_MINUTES
            if evening_load + place.average_visit_minutes > evening_span or (
                evening_reach >= evening_span and daytime_load <= daytime_left
            ):
                continue
            daytime.remove(place)
            daytime_load -= cost
            evening_load += cost
            evening_reach += _stretch_limit(place) + EVENING_LEG_MINUTES
        evening_short = evening_reach < evening_span
    evening = [place for place in other_places if place not in daytime]
    ordered_daytime = route_order(
        daytime, constraints.start_location.latitude, constraints.start_location.longitude,
    )
    if breakfast is not None:
        ordered_daytime.insert(0, breakfast)
    if afternoon_bridge is not None:
        ordered_daytime = [place for place in ordered_daytime if place.id != afternoon_bridge.id]
    lunch_position = min(2, len(ordered_daytime))
    if lunch is not None:
        # The morning holds as many stops as finish around lunchtime; the
        # rest are scheduled afterward. The route is still optimized within blocks.
        lunch_position = _lunch_position(ordered_daytime, day, constraints)
        ordered_daytime.insert(lunch_position, lunch)
    if afternoon_bridge is not None:
        # A bridge activity is deliberately placed after lunch so an all-day
        # café cannot be consumed in the morning and leave the afternoon empty.
        ordered_daytime.insert(min(lunch_position + 1, len(ordered_daytime)), afternoon_bridge)
    last_lat = ordered_daytime[-1].latitude if ordered_daytime else constraints.start_location.latitude
    last_lon = ordered_daytime[-1].longitude if ordered_daytime else constraints.start_location.longitude
    evening_anchor_lat = dinner.latitude if dinner is not None else last_lat
    evening_anchor_lon = dinner.longitude if dinner is not None else last_lon
    ordered_evening = route_order(evening, evening_anchor_lat, evening_anchor_lon)
    if rain_probability is not None and rain_probability >= RAIN_PROBABILITY_THRESHOLD:
        # Keep nearby order within each group, but visit outdoor stops before rainy afternoons.
        ordered_daytime.sort(key=lambda place: place.indoor)
        ordered_evening.sort(key=lambda place: place.indoor)
    ordered = ordered_daytime + ([dinner] if dinner is not None else []) + ordered_evening
    treated_meals = [meal for meal in (lunch, dinner) if meal is not None]
    if len(treats) == 1 and evening_short:
        # A single dessert or café goes after dinner when the evening would
        # otherwise end well before the traveler's end time.
        treated_meals = [dinner]
    for meal, treat in zip(treated_meals, treats):
        ordered.insert(ordered.index(meal) + 1, treat)
    rainy = rain_probability is not None and rain_probability >= RAIN_PROBABILITY_THRESHOLD

    def schedule(order: list[PlaceCandidate]) -> PlannedDay:
        return _schedule(day_number, day, order, by_id, constraints, lunch, dinner, breakfast)

    planned = schedule(ordered)
    if optimize_route and len(ordered) >= 3:
        planned = improve_route(ordered, schedule, constraints, rainy, max_cost)
    return planned


def _lunch_position(order: list[PlaceCandidate], day: date, constraints: TripConstraints) -> int:
    """Index before the first morning stop that would run well past the start of lunch."""
    latest = minute_of_day(constraints.daily_end_time)
    minute = minute_of_day(constraints.daily_start_time)
    lat = constraints.start_location.latitude
    lon = constraints.start_location.longitude
    for position, place in enumerate(order):
        _, leg_minutes, _ = travel_leg(
            lat, lon, place.latitude, place.longitude,
            constraints.travel_mode, constraints.traveler_count,
        )
        start = opening_start(place, day, minute + leg_minutes, latest)
        if start is None:
            continue
        end = start + place.average_visit_minutes
        if end > LUNCH_START_MINUTE + LUNCH_MORNING_OVERRUN_MINUTES:
            return position
        minute, lat, lon = end, place.latitude, place.longitude
    return len(order)


def _schedule(
    day_number: int, day: date, ordered: list[PlaceCandidate],
    by_id: dict[str, ScoredCandidate], constraints: TripConstraints,
    lunch: PlaceCandidate | None, dinner: PlaceCandidate | None,
    breakfast: PlaceCandidate | None = None,
) -> PlannedDay:
    latest = minute_of_day(constraints.daily_end_time)
    current_minute = minute_of_day(constraints.daily_start_time)
    lat = constraints.start_location.latitude
    lon = constraints.start_location.longitude
    items: list[ScheduledItem] = []
    total_cost = BudgetBreakdown()
    total_km = 0.0
    travel_minutes = 0
    for place in ordered:
        leg_km, leg_minutes, leg_cost = travel_leg(
            lat, lon, place.latitude, place.longitude,
            constraints.travel_mode, constraints.traveler_count,
        )
        visit_earliest = current_minute + leg_minutes
        visit_latest = latest
        if lunch is not None and place.id == lunch.id:
            visit_earliest = max(visit_earliest, LUNCH_START_MINUTE)
            visit_latest = min(visit_latest, LUNCH_END_MINUTE)
        elif dinner is not None and place.id == dinner.id:
            visit_earliest = max(visit_earliest, EARLIEST_DINNER_MINUTE)
        elif breakfast is not None and place.id == breakfast.id:
            # Breakfast stays a morning meal wherever the route puts it.
            visit_latest = min(visit_latest, LUNCH_START_MINUTE)
        start = opening_start(place, day, visit_earliest, visit_latest)
        if start is None:
            continue
        cost = place_cost(place, constraints.traveler_count)
        item = ScheduledItem(
            place=place, sequence=len(items) + 1, start_minute=start,
            end_minute=start + place.average_visit_minutes,
            visit_minutes=place.average_visit_minutes, travel_minutes=leg_minutes,
            travel_km=leg_km, travel_cost=leg_cost, cost=cost,
            score=by_id[place.id].score, reasons=by_id[place.id].reasons,
        )
        items.append(item)
        total_cost += cost + BudgetBreakdown(transport=leg_cost)
        total_km += leg_km
        travel_minutes += leg_minutes
        current_minute = item.end_minute
        lat, lon = place.latitude, place.longitude
    items = fit_day_edges(close_gaps(items, day, constraints, lunch, dinner), day, constraints, lunch, dinner)
    return PlannedDay(day_number, day, tuple(items), total_cost, round(total_km, 3), travel_minutes)


def idle_minutes(day: PlannedDay, constraints: TripConstraints) -> int:
    """Waiting time between the end of one stop and the start of the next."""
    idle = 0
    previous_end = minute_of_day(constraints.daily_start_time)
    for item in day.items:
        idle += item.start_minute - (previous_end + item.travel_minutes)
        previous_end = item.end_minute
    return idle


def unfilled_minutes(day: PlannedDay, constraints: TripConstraints) -> int:
    """Idle time plus the part of the day left empty at its end.

    A day that finishes at 9:00 has no wait between stops but is mostly empty;
    the planner adds stops until the day reaches the traveler's end time, less
    DAY_EDGE_TOLERANCE_MINUTES.
    """
    if not day.items:
        return 0
    covered_until = minute_of_day(constraints.daily_end_time) - DAY_EDGE_TOLERANCE_MINUTES
    return idle_minutes(day, constraints) + max(0, covered_until - day.items[-1].end_minute)


def route_objective(day: PlannedDay, constraints: TripConstraints) -> float:
    """Route length plus waiting between stops. Starting the day a little later
    is not penalized: a shorter route that begins at 9:30 instead of 8:30 is better."""
    return day.distance_km + gap_minutes(day) * IDLE_MINUTE_KM_EQUIVALENT


def _adjacent_meal_pairs(day: PlannedDay) -> int:
    return sum(
        is_food_or_coffee(first.place) and is_food_or_coffee(second.place)
        for first, second in zip(day.items, day.items[1:])
    )


def _rain_inversions(day: PlannedDay) -> int:
    """Pairs where an indoor stop precedes an outdoor one; kept low on rainy days."""
    return sum(
        first.place.indoor and not second.place.indoor
        for index, first in enumerate(day.items) for second in day.items[index + 1:]
    )


def _outdoor_afternoon_stops(day: PlannedDay) -> int:
    return sum(
        not item.place.indoor and item.start_minute >= RAIN_AFTERNOON_START_MINUTE
        for item in day.items
    )


def _neighbouring_orders(order: list[PlaceCandidate]) -> Iterator[list[PlaceCandidate]]:
    count = len(order)
    for start in range(count - 1):
        for end in range(start + 1, count):
            # 2-opt: reverse one segment.
            yield order[:start] + order[start:end + 1][::-1] + order[end + 1:]
            # Swap two stops: A -> B -> X -> C becomes A -> C -> X -> B.
            if end > start + 1:
                swapped = list(order)
                swapped[start], swapped[end] = swapped[end], swapped[start]
                yield swapped
    # or-opt: move a run of one to three stops somewhere else.
    for length in range(1, min(ROUTE_MOVE_MAX_SEGMENT, count - 1) + 1):
        for source in range(count - length + 1):
            segment = order[source:source + length]
            remaining = order[:source] + order[source + length:]
            for target in range(len(remaining) + 1):
                if target != source:
                    yield remaining[:target] + segment + remaining[target:]


def _route_length(
    order: list[PlaceCandidate], constraints: TripConstraints,
    cache: dict[tuple[str, str], float],
) -> float:
    """Straight-line length of a visiting order from the start point."""
    total = 0.0
    previous_id = "__start__"
    latitude = constraints.start_location.latitude
    longitude = constraints.start_location.longitude
    for place in order:
        key = (previous_id, place.id)
        if key not in cache:
            cache[key] = distance_km(latitude, longitude, place.latitude, place.longitude)
        total += cache[key]
        previous_id, latitude, longitude = place.id, place.latitude, place.longitude
    return total


def improve_route(
    order: list[PlaceCandidate], schedule: Callable[[list[PlaceCandidate]], PlannedDay],
    constraints: TripConstraints, rainy: bool = False, max_cost: int | None = None,
) -> PlannedDay:
    """Deterministic first-improvement local search over the visiting order.

    Only orders that are geometrically shorter are scheduled, which keeps the
    search cheap enough to run until no move helps. A move is accepted only when
    the same stops remain scheduled (opening hours and meal slots still hold),
    no new wait appears between stops, meals stay separated by other activities
    and main dishes no closer together (meal_rhythm_issues), a day within the
    traveler's hours stays within them, the cost stays within ``max_cost`` (a
    shorter route can need a paid ride),
    rainy-day outdoor-first ordering is not weakened, and the distance-plus-idle
    objective strictly improves.
    """
    best = schedule(order)
    scheduled_ids = frozenset(item.place.id for item in best.items)
    best_objective = route_objective(best, constraints)
    meal_limit = _adjacent_meal_pairs(best)
    rhythm_limit = meal_rhythm_issues(best, constraints)
    within_hours = edge_minutes(best, constraints) == 0
    cost_limit = None if max_cost is None else max(max_cost, best.cost.total)
    gap_limit = gap_minutes(best)
    inversion_limit = _rain_inversions(best)
    afternoon_limit = _outdoor_afternoon_stops(best)
    cache: dict[tuple[str, str], float] = {}
    best_length = _route_length(order, constraints, cache)
    for _ in range(ROUTE_IMPROVEMENT_PASSES):
        improved = False
        for candidate_order in _neighbouring_orders(order):
            length = _route_length(candidate_order, constraints, cache)
            if length >= best_length - 1e-9:
                continue
            trial = schedule(candidate_order)
            if len(trial.items) != len(best.items) or frozenset(
                item.place.id for item in trial.items
            ) != scheduled_ids:
                continue
            if (_adjacent_meal_pairs(trial) > meal_limit or gap_minutes(trial) > gap_limit
                    or meal_rhythm_issues(trial, constraints) > rhythm_limit
                    or (within_hours and edge_minutes(trial, constraints) > 0)
                    or (cost_limit is not None and trial.cost.total > cost_limit)):
                continue
            if rainy and (
                _rain_inversions(trial) > inversion_limit
                or _outdoor_afternoon_stops(trial) > afternoon_limit
            ):
                continue
            objective = route_objective(trial, constraints)
            if objective < best_objective - 1e-9:
                order, best, best_objective = candidate_order, trial, objective
                best_length = length
                improved = True
                break
        if not improved:
            break
    return best

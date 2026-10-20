from dataclasses import dataclass
from datetime import date, datetime, timedelta
from math import ceil
from typing import Literal
from zoneinfo import ZoneInfo

from app.domain.planner.budgeting import BudgetBreakdown, place_cost
from app.domain.planner.clustering import group_for_day
from app.domain.planner.config import (
    BUDGET_FILL_MAX_STEPS,
    BUDGET_FILL_POOL_SIZE,
    BUDGET_MEAL_QUALITY_VND,
    BUDGET_TARGET_TOLERANCE,
    EARLIEST_DINNER_MINUTE,
    ESTIMATED_COST_BUFFER_SHARE,
    FAMOUS_DISTANCE_BONUS_KM,
    FAMOUS_MEAL_BONUS,
    FAR_FROM_BASE_KM,
    FUTURE_DAY_BUDGET_SHARE,
    GAP_FILL_FILLER_POOL_SIZE,
    GAP_FILL_MAX_STEPS,
    GAP_FILL_NEARBY_KM,
    GAP_FILL_START_TOLERANCE_MINUTES,
    GAP_FILL_SWAP_POOL,
    GRAB_RATE_VND_PER_KM,
    HANOI_CENTRE,
    LIGHT_FOOD_POOL_SIZE,
    LOCAL_STOP_RADIUS_KM,
    LUNCH_END_MINUTE,
    LUNCH_START_MINUTE,
    MAX_BALANCED_STOP_BUDGET_SHARE,
    MAX_CANDIDATES,
    MAX_FAMOUS_PER_DAY,
    MAX_MEAL_DAY_BUDGET_SHARE,
    MEAL_ALTERNATES,
    MEAL_DISTANCE_PENALTY_PER_KM,
    MEAL_SWAP_CANDIDATES,
    MEAL_SWAP_MIN_GAIN_KM,
    MEAL_SWAP_SCORE_SLACK,
    META_TAGS,
    MISSING_MEAL_POOL_SIZE,
    MUST_SEE_PER_DAY,
    OUTER_START_KM,
    REPAIR_MAX_STEPS,
    REPAIR_POOL_SIZE,
    REPAIR_SWAP_SIGHTS,
    SAME_DISH_PENALTY,
)
from app.domain.planner.constraints import (
    daily_distance_cap_km,
    distance_km,
    filter_candidates,
    free_stroll_candidates,
    serves_interest,
)
from app.domain.planner.ranking import ScoredCandidate, famous_tier_rank, rank_candidates
from app.domain.planner.routing import travel_leg
from app.domain.planner.scheduling import (
    PlannedDay,
    RainForecast,
    build_day,
    edge_minutes,
    gap_minutes,
    idle_minutes,
    is_food_or_coffee,
    is_light_food,
    is_main_dish,
    is_main_meal,
    meal_rhythm_issues,
    minute_of_day,
    opening_start,
    trip_rain,
    unfilled_minutes,
)
from app.domain.planner.types import PlaceCandidate, TripConstraints
from app.domain.planner.validation import validate_days


class NoFeasibleItinerary(Exception):
    suggestions = (
        "Increase budget", "Increase travel radius", "Extend daily hours",
    )


@dataclass(frozen=True)
class PlannedItinerary:
    option_type: str
    days: tuple[PlannedDay, ...]
    cost: BudgetBreakdown
    distance_km: float
    travel_minutes: int
    match_score: int


def select_day(
    day_number: int, day_date: date, choices: list[ScoredCandidate],
    constraints: TripConstraints, budget_remaining: int, target_count: int,
    rain_probability: RainForecast, max_single_stop_cost: int | None = None,
    prefer_affordable_meals: bool = False, must_see_count: int = 1,
) -> PlannedDay:
    ordered = group_for_day(choices, len(choices))
    mandatory_non_meals: list[ScoredCandidate] = []
    mandatory_ids: set[str] = set()
    start_minute = minute_of_day(constraints.daily_start_time)
    end_minute = minute_of_day(constraints.daily_end_time)
    # Every day visits one or two of Hanoi's must-see places (notable ones once
    # the trip has used them all), the second one close to the first.
    highlights = must_see_choices(ordered, day_date, constraints, max_single_stop_cost)
    famous = famous_choices(ordered, day_date, constraints, max_single_stop_cost)
    start_lat, start_lon = constraints.start_location.latitude, constraints.start_location.longitude
    outer_base = distance_km(start_lat, start_lon, *HANOI_CENTRE) > OUTER_START_KM

    def near_base(candidate: ScoredCandidate) -> bool:
        return distance_km(start_lat, start_lon, candidate.place.latitude,
                           candidate.place.longitude) <= FAR_FROM_BASE_KM

    local_day = outer_base and day_number % 2 == 1 and any(near_base(candidate) for candidate in famous)
    if local_day:
        # A day around an outer base: its famous places stand in for the
        # must-see sights downtown, which get a day of their own.
        highlights = ([candidate for candidate in highlights if near_base(candidate)]
                      or [candidate for candidate in famous if near_base(candidate)])
        famous = [candidate for candidate in famous if near_base(candidate)]
    for _ in range(min(must_see_count, len(highlights))):
        first = mandatory_non_meals[0].place if mandatory_non_meals else None
        pick = min(
            (candidate for candidate in highlights if candidate.place.id not in mandatory_ids),
            key=lambda candidate: (
                0.0 if first is None else round(meal_anchor_distance_km(candidate, first), 1) * 4,
            ) + (-candidate.score, candidate.place.slug),
        )
        mandatory_non_meals.append(pick)
        mandatory_ids.add(pick.place.id)
    # Each interest the traveler picked gets a famous place of its own when
    # the must-see stops do not already serve it (a craft village for "craft",
    # a famous park or mountain for "nature"...), close to the day's other stops.
    for interest in constraints.interests:
        if interest in {"food", "coffee", "festival"} or len(mandatory_non_meals) >= MAX_FAMOUS_PER_DAY:
            continue
        if any(serves_interest(entry.place, interest) for entry in mandatory_non_meals):
            continue
        anchor = mandatory_non_meals[0].place if mandatory_non_meals else None
        pick = min(
            (candidate for candidate in famous
             if candidate.place.id not in mandatory_ids and serves_interest(candidate.place, interest)),
            key=lambda candidate: (
                round(meal_anchor_distance_km(candidate, anchor), 1)
                - FAMOUS_DISTANCE_BONUS_KM * famous_tier_rank(candidate.place),
                -candidate.score, candidate.place.slug,
            ),
            default=None,
        )
        if pick is not None:
            mandatory_non_meals.append(pick)
            mandatory_ids.add(pick.place.id)
    forced_famous = list(mandatory_non_meals)
    if "festival" in constraints.interests:
        seasonal_choices = [candidate for candidate in ordered
                            if candidate.place.category == "festival"
                            and opening_start(
                                candidate.place, day_date, start_minute, end_minute,
                            ) is not None]
        seasonal = min(
            seasonal_choices,
            key=lambda candidate: (
                candidate.place.highlight_level != "must_see",
                -candidate.score,
                candidate.place.slug,
            ),
            default=None,
        )
        if seasonal is not None and seasonal.place.id not in mandatory_ids:
            mandatory_non_meals.insert(0, seasonal)
            mandatory_ids.add(seasonal.place.id)
    if outer_base and (local_day or all(near_base(entry) for entry in mandatory_non_meals)):
        # Staying outside the centre: the day also shows what is famous near
        # the traveler's base, unless it is the day's outing to far sights.
        local_choices = [candidate for candidate in ordered
                         if candidate.place.id not in mandatory_ids
                         and candidate.place.category not in {"accommodation", "festival"}
                         and not is_food_or_coffee(candidate.place)
                         and distance_km(start_lat, start_lon, candidate.place.latitude,
                                         candidate.place.longitude) <= LOCAL_STOP_RADIUS_KM
                         and opening_start(candidate.place, day_date, start_minute, end_minute) is not None]
        local = max(local_choices, key=lambda candidate: (famous_tier_rank(candidate.place), candidate.score),
                    default=None)
        if local is not None:
            mandatory_non_meals.append(local)
            mandatory_ids.add(local.place.id)
    mandatory: list[ScoredCandidate] = []
    used_meal_ids: set[str] = set()
    alternates: dict[str, list[ScoredCandidate]] = {}
    anchor = (mandatory_non_meals or ordered)[0].place if (mandatory_non_meals or ordered) else None
    slots = (
        ("breakfast", lambda place: is_food_or_coffee(place) and place.average_visit_minutes < 60,
         minute_of_day(constraints.daily_start_time), min(minute_of_day(constraints.daily_end_time), 10 * 60 + 30)),
        ("lunch", is_main_meal, max(minute_of_day(constraints.daily_start_time), 11 * 60), min(minute_of_day(constraints.daily_end_time), 14 * 60)),
        ("dinner", is_main_meal, max(minute_of_day(constraints.daily_start_time), EARLIEST_DINNER_MINUTE), minute_of_day(constraints.daily_end_time)),
    )
    for _, predicate, earliest, latest in slots:
        eligible_meals = [candidate for candidate in ordered
                          if candidate.place.id not in used_meal_ids | mandatory_ids
                          and predicate(candidate.place)
                          and (max_single_stop_cost is None or
                               place_cost(candidate.place, constraints.traveler_count).total <= max_single_stop_cost)
                          # One meal never takes most of the day's money from the sights;
                          # the budget top-up can still upgrade it later.
                          and place_cost(candidate.place, constraints.traveler_count).total
                          <= budget_remaining * MAX_MEAL_DAY_BUDGET_SHARE
                          and opening_start(candidate.place, day_date, earliest, latest) is not None]
        # Use an affordable meal first so the three daily meal slots survive
        # the hard budget check even when a premium restaurant ranks highly.
        # Meals near the day's main attraction keep the route compact.
        eaten = {dish_of(entry.place) for entry in mandatory if entry.place.id in used_meal_ids}
        ranked_meals = sorted(
            eligible_meals,
            key=lambda candidate: (
                (
                    # A cheaper meal across town costs more in rides than it saves,
                    # and a well-known eatery is worth a little more than an anonymous one.
                    place_cost(candidate.place, constraints.traveler_count).total
                    + 2 * GRAB_RATE_VND_PER_KM * meal_anchor_distance_km(candidate, anchor)
                    - BUDGET_MEAL_QUALITY_VND * (candidate.score + FAMOUS_MEAL_BONUS * famous_tier_rank(candidate.place))
                    + BUDGET_MEAL_QUALITY_VND * SAME_DISH_PENALTY * (dish_of(candidate.place) in eaten),
                    round(meal_anchor_distance_km(candidate, anchor), 1),
                )
                if prefer_affordable_meals else (
                    MEAL_DISTANCE_PENALTY_PER_KM * meal_anchor_distance_km(candidate, anchor)
                    - candidate.score
                    - FAMOUS_MEAL_BONUS * famous_tier_rank(candidate.place)
                    - place_cost(candidate.place, constraints.traveler_count).total / 100_000
                    # Chả cá for lunch and again for dinner is one dish too many.
                    + SAME_DISH_PENALTY * (dish_of(candidate.place) in eaten),
                ),
                -candidate.score,
                candidate.place.slug,
            ),
        )
        if ranked_meals:
            selected_meal = ranked_meals[0]
            mandatory.append(selected_meal)
            used_meal_ids.add(selected_meal.place.id)
            # The next choices, then the cheapest ones for when money runs short.
            spare = [candidate for candidate in ranked_meals[1:] if candidate.place.id not in used_meal_ids]
            cheapest = sorted(spare, key=lambda candidate: (
                place_cost(candidate.place, constraints.traveler_count).total, candidate.place.slug,
            ))
            alternates[selected_meal.place.id] = list({
                candidate.place.id: candidate
                for candidate in spare[:MEAL_ALTERNATES] + cheapest[:MEAL_ALTERNATES // 2]
            }.values())
    # A festival or local stop, then the meals, then the must-see stops: these
    # cost little, and one of them replaces a sight below if it did not fit.
    picked = {entry.place.id for entry in forced_famous}
    ordered = (
        [entry for entry in mandatory_non_meals if entry.place.id not in picked] + mandatory
        + [entry for entry in mandatory_non_meals if entry.place.id in picked]
        + [candidate for candidate in ordered if candidate.place.id not in used_meal_ids | mandatory_ids]
    )
    # The forced stops and every meal slot always fit within the day's target.
    target_count = max(target_count, len(mandatory_non_meals) + len(mandatory))
    selected: list[ScoredCandidate] = []
    allow_premium_food = False
    # Greedy trials use the fast heuristic order; the chosen set is route
    # optimized once at the end, which can only shorten the day.
    current = build_day(
        day_number, day_date, selected, constraints, rain_probability, allow_premium_food,
        optimize_route=False,
    )
    for first_choice in ordered:
        meal_slot = first_choice.place.id in used_meal_ids
        # A meal that does not fit gives way to the next one for its slot.
        for candidate in [first_choice] + alternates.get(first_choice.place.id, []):
            if (candidate.place.id in {entry.place.id for entry in selected}
                    or (max_single_stop_cost is not None
                        and place_cost(candidate.place, constraints.traveler_count).total
                        > max_single_stop_cost)):
                continue
            trial = build_day(
                day_number, day_date, selected + [candidate], constraints, rain_probability,
                allow_premium_food, optimize_route=False,
            )
            trial_ids = {item.place.id for item in trial.items}
            if (candidate.place.id not in trial_ids
                    or any(item.place.id not in trial_ids for item in current.items)
                    or trial.cost.total > budget_remaining
                    or trial.distance_km > daily_distance_cap_km(constraints)
                    # Meal slots come first; any other food must not crowd the meals.
                    or (not meal_slot
                        and meal_rhythm_issues(trial, constraints) > meal_rhythm_issues(current, constraints))):
                continue
            selected.append(candidate)
            current = trial
            break
        else:
            continue
        if len(selected) >= target_count and (
            idle_minutes(current, constraints) <= 120 or len(selected) > target_count
        ):
            break
    if famous and not any(famous_tier_rank(item.place) for item in current.items):
        # No famous stop fitted as chosen: take the first one that fits in
        # place of a sight already picked (must-see places first).
        swaps = [None] + [entry for entry in reversed(selected)
                          if entry.place.id not in used_meal_ids and not is_food_or_coffee(entry.place)]
        for highlight in sorted(famous, key=lambda entry: -famous_tier_rank(entry.place)):
            fitted = next((
                (selection, trial) for selection, trial in (
                    (selection, build_day(day_number, day_date, selection, constraints, rain_probability,
                                          allow_premium_food, optimize_route=False))
                    for selection in ([entry for entry in selected if entry is not dropped] + [highlight]
                                      for dropped in swaps)
                )
                if {entry.place.id for entry in selection} <= {item.place.id for item in trial.items}
                and trial.cost.total <= budget_remaining
                and trial.distance_km <= daily_distance_cap_km(constraints)
            ), None)
            if fitted is not None:
                selected, current = fitted
                break
    if not current.items:
        raise NoFeasibleItinerary(f"No feasible activities on day {day_number}")
    return build_day(
        day_number, day_date, selected, constraints, rain_probability, allow_premium_food,
    )


def is_highlight(place: PlaceCandidate) -> bool:
    return place.highlight_level == "must_see" and not is_food_or_coffee(place)


def must_see_choices(
    candidates: list[ScoredCandidate], day: date, constraints: TripConstraints,
    max_single_stop_cost: int | None = None,
) -> list[ScoredCandidate]:
    """Must-see places open on ``day``, or notable sights once none is left."""
    start = minute_of_day(constraints.daily_start_time)
    end = minute_of_day(constraints.daily_end_time)
    open_sights = [
        candidate for candidate in candidates
        if not is_food_or_coffee(candidate.place) and candidate.place.category != "festival"
        and (max_single_stop_cost is None
             or place_cost(candidate.place, constraints.traveler_count).total <= max_single_stop_cost)
        and opening_start(candidate.place, day, start, end) is not None
    ]
    return ([candidate for candidate in open_sights if is_highlight(candidate.place)]
            or [candidate for candidate in open_sights if candidate.place.highlight_level == "notable"])


def famous_choices(
    candidates: list[ScoredCandidate], day: date, constraints: TripConstraints,
    max_single_stop_cost: int | None = None,
) -> list[ScoredCandidate]:
    """Must-see and notable sights open on ``day`` (food and seasonal events aside)."""
    start = minute_of_day(constraints.daily_start_time)
    end = minute_of_day(constraints.daily_end_time)
    return [
        candidate for candidate in candidates
        if famous_tier_rank(candidate.place) and not is_food_or_coffee(candidate.place)
        and candidate.place.category != "festival"
        and (max_single_stop_cost is None
             or place_cost(candidate.place, constraints.traveler_count).total <= max_single_stop_cost)
        and opening_start(candidate.place, day, start, end) is not None
    ]


EATERY_WORDS = ("quán", "quan", "nhà hàng", "nha hang", "cửa hàng", "cua hang", "tiệm", "tiem")


def dish_of(place: PlaceCandidate) -> str:
    """The dish an eatery is named after: its first two words ("chả cá", "bún chả")."""
    name = place.name.lower()
    for word in EATERY_WORDS:
        if name.startswith(word + " "):
            name = name[len(word) + 1:]
    return " ".join(name.split()[:2])


def meal_anchor_distance_km(candidate: ScoredCandidate, anchor: PlaceCandidate | None) -> float:
    if anchor is None:
        return 0.0
    return distance_km(
        anchor.latitude, anchor.longitude, candidate.place.latitude, candidate.place.longitude,
    )


def spend_priority(item: ScoredCandidate, constraints: TripConstraints) -> float:
    place_terms = set(item.place.tags) | {item.place.category}
    if not (set(constraints.interests) & place_terms):
        return float(item.score)
    item_cost = (item.place.average_cost + item.place.entrance_fee) * constraints.traveler_count
    # Prefer a relevant experience that can use a sensible share of one day's
    # allowance. The per-stop cap below keeps a single premium meal from
    # absorbing most of a multi-day trip.
    daily_allowance = constraints.budget_total / constraints.days
    return item.score + 25 * min(1.0, item_cost / daily_allowance)


def _same_slot(a: PlaceCandidate, b: PlaceCandidate) -> bool:
    """Whether ``b`` can take ``a``'s place without changing the shape of the day."""
    return is_food_or_coffee(a) == is_food_or_coffee(b) and is_main_meal(a) == is_main_meal(b)


def _fill_budget_pass(
    days: list[PlannedDay], available: list[ScoredCandidate], constraints: TripConstraints,
    rain_probability: RainForecast, floor: int, ceiling: int, max_single_stop_cost: int | None,
) -> list[PlannedDay]:
    """Raise a plan's total cost into [floor, ceiling] by adding or upgrading stops.

    Each step tries, on every day, adding one unused candidate or swapping a stop
    for a costlier one of the same kind (meal for meal, sight for sight). Moves
    must keep every stop schedulable, add no waiting between stops, keep the day
    within its distance cap and the trip within ``ceiling``; the move that best closes the gap wins, ties going
    to the better-ranked candidate. The result is best effort when the catalog
    near the route cannot absorb the money (for example a huge walking budget).
    """
    by_id = {candidate.place.id: candidate for candidate in available}
    days = list(days)
    # The stops each changed day was built from, in that order: meal slots go
    # to the first fitting place, so the route is optimized from the same list.
    changed: dict[int, list[ScoredCandidate]] = {}
    for _ in range(BUDGET_FILL_MAX_STEPS):
        total = sum(day.cost.total for day in days)
        gap = floor - total
        if gap <= 0:
            break
        used = {item.place.id for day in days for item in day.items}
        best: tuple[tuple[int, int, int], int, PlannedDay, list[ScoredCandidate]] | None = None
        for index, day in enumerate(days):
            current = changed.get(index) or [by_id[item.place.id] for item in day.items if item.place.id in by_id]
            if len(current) != len(day.items):
                continue
            room = ceiling - (total - day.cost.total)
            limit = room if max_single_stop_cost is None else min(room, max_single_stop_cost)
            baseline = build_day(
                day.day_number, day.date, current, constraints, rain_probability,
                allow_premium_food=False, optimize_route=False,
            )
            waiting = gap_minutes(baseline)
            rhythm = meal_rhythm_issues(baseline, constraints)
            edges = edge_minutes(baseline, constraints)
            pool = [
                candidate for candidate in available
                if candidate.place.id not in used
                and 0 < place_cost(candidate.place, constraints.traveler_count).total <= limit
                and opening_start(candidate.place, day.date, minute_of_day(constraints.daily_start_time),
                                  minute_of_day(constraints.daily_end_time)) is not None
            ]
            # Costlier candidates close the gap in fewer steps; the best-ranked
            # ones keep the plan relevant when the costly ones cannot be scheduled.
            # Sights and meals are shortlisted separately (the costliest and the
            # best-ranked of each) so neither kind crowds out the other.
            party_cost = {entry.place.id: place_cost(entry.place, constraints.traveler_count).total
                          for entry in pool}
            half = BUDGET_FILL_POOL_SIZE // 2
            shortlist = []
            for food in (False, True):
                kind = [entry for entry in pool if is_food_or_coffee(entry.place) == food]
                shortlist += list({
                    entry.place.id: entry for entry in (
                        sorted(kind, key=lambda entry: (-party_cost[entry.place.id], entry.rank))[:half]
                        + sorted(kind, key=lambda entry: entry.rank)[:half]
                    )
                }.values())
            for candidate in shortlist:
                trials = [current + [candidate]] + [
                    current[:position] + [candidate] + current[position + 1:]
                    for position, existing in enumerate(current)
                    if _same_slot(existing.place, candidate.place)
                    and not is_highlight(existing.place)
                    and place_cost(candidate.place, constraints.traveler_count).total
                    > place_cost(existing.place, constraints.traveler_count).total
                ]
                for selection in trials:
                    trial = build_day(
                        day.day_number, day.date, selection, constraints, rain_probability,
                        allow_premium_food=False, optimize_route=False,
                    )
                    kept = {item.place.id for item in trial.items}
                    gain = trial.cost.total - day.cost.total
                    if (gain <= 0 or trial.cost.total > room
                            or any(item.place.id not in kept for item in selection)
                            or gap_minutes(trial) > waiting
                            or meal_rhythm_issues(trial, constraints) > rhythm
                            or edge_minutes(trial, constraints) > edges
                            or trial.distance_km > daily_distance_cap_km(constraints)):
                        continue
                    key = (min(gain, gap), -candidate.rank, -index)
                    if best is None or key > best[0]:
                        best = (key, index, trial, selection)
        if best is None:
            break
        _, index, trial, selection = best
        days[index] = trial
        changed[index] = selection
    for index, selection in sorted(changed.items()):
        day = days[index]
        others = sum(other.cost.total for other in days) - day.cost.total
        optimized = build_day(
            day.day_number, day.date, selection, constraints,
            rain_probability, allow_premium_food=False, max_cost=ceiling - others,
        )
        # A different route changes the fares; keep it only if the trip still
        # fits and no new wait appears.
        if (others + optimized.cost.total <= ceiling and gap_minutes(optimized) <= gap_minutes(day)
                and len(optimized.items) == len(day.items)
                and meal_rhythm_issues(optimized, constraints) <= meal_rhythm_issues(day, constraints)
                and edge_minutes(optimized, constraints) <= edge_minutes(day, constraints)):
            days[index] = optimized
    return days


def fill_budget(
    days: list[PlannedDay], available: list[ScoredCandidate], constraints: TripConstraints,
    rain_probability: RainForecast, floor: int, ceiling: int, max_single_stop_cost: int | None,
) -> list[PlannedDay]:
    """Run fill passes until the plan reaches ``floor`` or stops improving.

    Route optimization at the end of a pass can shorten rides and lower fares,
    dropping a plan that had reached the floor back under it, so the check is
    repeated on the optimized days.
    """
    for _ in range(3):
        before = sum(day.cost.total for day in days)
        days = _fill_budget_pass(
            days, available, constraints, rain_probability, floor, ceiling, max_single_stop_cost,
        )
        after = sum(day.cost.total for day in days)
        if after >= floor or after <= before:
            break
    return days


def fill_schedule_gaps(
    days: list[PlannedDay], available: list[ScoredCandidate], constraints: TripConstraints,
    rain_probability: RainForecast, ceiling: int, max_single_stop_cost: int | None,
    prefer: Literal["rank", "cost", "distance"] = "rank",
    fillers: list[ScoredCandidate] | None = None,
) -> list[PlannedDay]:
    """Add stops to days that still wait between activities, start late or end early.

    The scheduler absorbs short waits by staying longer or starting later, but
    a lone stop between lunch and a 17:00 dinner cannot fill four hours. Each
    step adds the unused candidate that most reduces the waiting between stops,
    then the empty start or end of the day; ``prefer`` breaks ties toward the
    best-ranked, cheapest or closest candidate. Every stop must stay
    schedulable and the day within its distance cap. The money left under
    ``ceiling`` is shared evenly by the days still to fill, so the first day
    cannot spend what a later day needs. ``fillers`` (free strolls outside the
    traveler's interests) are tried only when no candidate in ``available`` helps.
    """
    fillers = fillers or []
    by_id = {candidate.place.id: candidate for candidate in available + fillers}
    food_only = set(constraints.interests) <= {"food", "coffee"}
    earliest = minute_of_day(constraints.daily_start_time)
    latest = minute_of_day(constraints.daily_end_time)
    days = list(days)
    for index, day in enumerate(days):
        current = [by_id[item.place.id] for item in day.items if item.place.id in by_id]
        if len(current) != len(day.items) or (
            gap_minutes(day) == 0 and edge_minutes(day, constraints) == 0
            and unfilled_minutes(day, constraints) <= GAP_FILL_START_TOLERANCE_MINUTES
        ):
            continue
        room = day.cost.total + (ceiling - sum(other.cost.total for other in days)) // (len(days) - index)
        limit = room if max_single_stop_cost is None else min(room, max_single_stop_cost)
        base = build_day(day.day_number, day.date, current, constraints, rain_probability,
                         optimize_route=False)
        changed = False
        for _ in range(GAP_FILL_MAX_STEPS):
            waiting = gap_minutes(base)
            idle = unfilled_minutes(base, constraints)
            if waiting == 0 and edge_minutes(base, constraints) == 0 and idle <= GAP_FILL_START_TOLERANCE_MINUTES:
                break
            used = {item.place.id for other in days for item in other.items} | {
                candidate.place.id for candidate in current
            }
            # build_day reserves food for the meal slots, so sights fill a gap,
            # with a dessert after a meal; on food-and-coffee trips every stop is food.
            pool = [
                candidate for candidate in available
                if candidate.place.id not in used
                and place_cost(candidate.place, constraints.traveler_count).total <= limit
                and opening_start(candidate.place, day.date, earliest, latest) is not None
            ]
            if not food_only:
                # Desserts and cafés on the day's route first: one after dinner
                # often carries the evening to the traveler's end time.
                light = sorted((entry for entry in pool if is_light_food(entry.place)),
                               key=lambda entry: not near_route(entry, current, constraints))
                # A day that lost its lunch or dinner on the way gets one back.
                mains = sorted((entry for entry in pool if is_main_meal(entry.place)),
                               key=lambda entry: min((distance_km(entry.place.latitude, entry.place.longitude,
                                                                  stop.place.latitude, stop.place.longitude)
                                                      for stop in current), default=0.0))
                missing_meal = (not has_meal_between(base, LUNCH_START_MINUTE, LUNCH_END_MINUTE)
                                and earliest < LUNCH_END_MINUTE and latest > LUNCH_START_MINUTE + 60) or (
                    not has_meal_between(base, EARLIEST_DINNER_MINUTE, latest)
                    and latest >= EARLIEST_DINNER_MINUTE + 90)
                pool = ([entry for entry in pool if not is_food_or_coffee(entry.place)] + light[:LIGHT_FOOD_POOL_SIZE]
                        + (mains[:MISSING_MEAL_POOL_SIZE] if missing_meal else []))
            if food_only:
                # The best-ranked meals, and the cheapest ones for when the
                # budget is nearly spent.
                half = BUDGET_FILL_POOL_SIZE // 2
                cheapest = sorted(pool, key=lambda entry: (
                    place_cost(entry.place, constraints.traveler_count).total, entry.rank,
                ))
                light = [entry for entry in pool if is_light_food(entry.place)][:LIGHT_FOOD_POOL_SIZE]
                pool = list({entry.place.id: entry for entry in pool[:half] + cheapest[:half] + light}.values())
            nearby = [entry for entry in pool if near_route(entry, current, constraints)]
            best = _best_gap_filler(base, current, nearby, constraints, rain_probability, room, prefer)
            strolls = [entry for entry in fillers if entry.place.id not in used
                       and opening_start(entry.place, day.date, earliest, latest) is not None]
            if best is None and strolls:
                best = _best_gap_filler(base, current, [entry for entry in strolls
                                                        if near_route(entry, current, constraints)],
                                        constraints, rain_probability, room, prefer)
            if best is None:
                best = _best_gap_filler(base, current, [entry for entry in pool if entry not in nearby],
                                        constraints, rain_probability, room, prefer)
            if best is None and strolls:
                best = _best_gap_filler(base, current, strolls, constraints, rain_probability, room, prefer)
            if best is None:
                # A full day can still wait, start late or end early: trade an extra
                # stop (never a must-see or a seated meal) for one that fits better.
                mains = sum(is_main_meal(entry.place) for entry in current)
                options = sorted(pool, key=lambda entry: not near_route(entry, current, constraints))[
                    :GAP_FILL_SWAP_POOL] + strolls[:GAP_FILL_SWAP_POOL]
                for dropped in reversed(current):
                    if is_highlight(dropped.place) or (
                        is_main_meal(dropped.place) and not (food_only and mains > 2)
                    ):
                        continue
                    reduced = [entry for entry in current if entry is not dropped]
                    best = _best_gap_filler(base, reduced, options, constraints, rain_probability, room, prefer)
                    if best is not None:
                        current = reduced
                        break
            if best is None:
                break
            candidate, base = best
            current.append(candidate)
            changed = True
        # The optimized route starts from the heuristic order and never adds a
        # wait to it, so it is preferred whenever it fits the money (shorter
        # rides change fares); an unchanged day keeps its own route if that
        # waits less.
        optimized = build_day(day.day_number, day.date, current, constraints, rain_probability, max_cost=room)
        versions = [version for version in ([optimized, base] if changed else [day, optimized])
                    if {item.place.id for item in version.items} == {entry.place.id for entry in current}]
        days[index] = min((version for version in versions if version.cost.total <= room),
                          key=lambda version: (gap_minutes(version), meal_rhythm_issues(version, constraints),
                                               edge_minutes(version, constraints), version.distance_km),
                          default=base)
    return days


def has_meal_between(day: PlannedDay, earliest: int, latest: int) -> bool:
    """Whether the day has a seated meal starting within [earliest, latest]."""
    return any(is_main_meal(item.place) and earliest <= item.start_minute <= latest for item in day.items)


def near_route(candidate: ScoredCandidate, stops: list[ScoredCandidate], constraints: TripConstraints) -> bool:
    """Whether a candidate lies within GAP_FILL_NEARBY_KM of one of the day's stops."""
    limit = GAP_FILL_NEARBY_KM[constraints.travel_mode]
    return any(distance_km(candidate.place.latitude, candidate.place.longitude,
                           stop.place.latitude, stop.place.longitude) <= limit for stop in stops)


def _best_gap_filler(
    base: PlannedDay, current: list[ScoredCandidate], pool: list[ScoredCandidate],
    constraints: TripConstraints, rain_probability: RainForecast, room: int,
    prefer: Literal["rank", "cost", "distance"],
) -> tuple[ScoredCandidate, PlannedDay] | None:
    """The pool candidate whose addition most reduces waiting, then a late start
    or early end, then the empty time, without crowding the meals."""
    waiting = gap_minutes(base)
    edges = edge_minutes(base, constraints)
    idle = unfilled_minutes(base, constraints)
    rhythm = meal_rhythm_issues(base, constraints)
    best: tuple[tuple[float, ...], ScoredCandidate, PlannedDay] | None = None
    for candidate in pool:
        selection = current + [candidate]
        trial = build_day(base.day_number, base.date, selection, constraints,
                          rain_probability, optimize_route=False)
        kept = {item.place.id for item in trial.items}
        if (any(entry.place.id not in kept for entry in selection)
                or trial.cost.total > room
                or trial.distance_km > daily_distance_cap_km(constraints)):
            continue
        trial_waiting = gap_minutes(trial)
        trial_edges = edge_minutes(trial, constraints)
        trial_idle = unfilled_minutes(trial, constraints)
        if (trial_waiting, trial_edges, trial_idle) >= (waiting, edges, idle) or (
            meal_rhythm_issues(trial, constraints) > rhythm
        ):
            continue
        tie_break = {
            "rank": 0.0,
            "cost": -float(trial.cost.total),
            "distance": -trial.distance_km,
        }[prefer]
        key = (waiting - trial_waiting, (edges - trial_edges) // 15, (idle - trial_idle) // 15,
               tie_break, famous_tier_rank(candidate.place), -candidate.rank)
        if best is None or key > best[0]:
            best = (key, candidate, trial)
    return None if best is None else (best[1], best[2])


def relocate_meals(
    days: list[PlannedDay], available: list[ScoredCandidate], constraints: TripConstraints,
    rain_probability: RainForecast, floor: int | None, ceiling: int, cheaper_only: bool = False,
) -> list[PlannedDay]:
    """Swap meals for comparable ones that sit on the route instead of off it.

    Reordering cannot remove every detour: a dinner fixed at 17:00 next to the
    lunch spot still sends the afternoon sight across town and back. Here each
    meal may be replaced by an unused meal of the same kind (breakfast snack,
    seated meal or coffee) whose FinalScore is at most MEAL_SWAP_SCORE_SLACK
    lower, when that makes the optimized day at least MEAL_SWAP_MIN_GAIN_KM
    shorter, keeps every stop schedulable, adds no wait and keeps the trip within
    ``ceiling`` (and above ``floor`` if it already was). ``cheaper_only`` keeps
    Budget Friendly from paying more for a shorter route.
    """
    by_id = {candidate.place.id: candidate for candidate in available}
    meals = [candidate for candidate in available if is_food_or_coffee(candidate.place)]
    days = list(days)
    for index, day in enumerate(days):
        if any(item.place.id not in by_id for item in day.items):
            continue
        for meal_id in [item.place.id for item in day.items if is_food_or_coffee(item.place)]:
            items = list(day.items)
            position = next(
                (offset for offset, item in enumerate(items) if item.place.id == meal_id), None,
            )
            if position is None:
                continue
            meal = items[position].place
            previous = items[position - 1].place if position else None
            following = items[position + 1].place if position + 1 < len(items) else None

            used = {item.place.id for other in days for item in other.items}
            old_cost = place_cost(meal, constraints.traveler_count).total
            current_detour = _detour_km(meal, previous, following, constraints)
            options = sorted(
                (
                    candidate for candidate in meals
                    if candidate.place.id not in used
                    and _same_slot(meal, candidate.place)
                    and candidate.score >= by_id[meal_id].score - MEAL_SWAP_SCORE_SLACK
                    and _detour_km(candidate.place, previous, following, constraints)
                    < current_detour - MEAL_SWAP_MIN_GAIN_KM
                    and (not cheaper_only
                         or place_cost(candidate.place, constraints.traveler_count).total <= old_cost)
                ),
                key=lambda candidate: (
                    _detour_km(candidate.place, previous, following, constraints), candidate.rank,
                ),
            )[:MEAL_SWAP_CANDIDATES]
            total = sum(other.cost.total for other in days)
            for candidate in options:
                selection = [candidate if item.place.id == meal_id else by_id[item.place.id]
                             for item in items]
                trial = build_day(day.day_number, day.date, selection, constraints, rain_probability,
                                  max_cost=ceiling - (total - day.cost.total))
                new_total = total - day.cost.total + trial.cost.total
                if ({item.place.id for item in trial.items} != {entry.place.id for entry in selection}
                        or trial.distance_km > day.distance_km - MEAL_SWAP_MIN_GAIN_KM
                        or gap_minutes(trial) > gap_minutes(day)
                        or meal_rhythm_issues(trial, constraints) > meal_rhythm_issues(day, constraints)
                        or new_total > ceiling
                        or (floor is not None and total >= floor > new_total)
                        or (cheaper_only and trial.cost.total > day.cost.total)):
                    continue
                day = days[index] = trial
                break
    return days


def _detour_km(
    place: PlaceCandidate, previous: PlaceCandidate | None, following: PlaceCandidate | None,
    constraints: TripConstraints,
) -> float:
    """Distance from the previous stop (or the start) to ``place`` and on to the next stop."""
    latitude, longitude = (
        (previous.latitude, previous.longitude) if previous is not None
        else (constraints.start_location.latitude, constraints.start_location.longitude)
    )
    length = distance_km(latitude, longitude, place.latitude, place.longitude)
    if following is not None:
        length += distance_km(place.latitude, place.longitude, following.latitude, following.longitude)
    return length


def repair_meal_rhythm(
    days: list[PlannedDay], available: list[ScoredCandidate], constraints: TripConstraints,
    rain_probability: RainForecast, ceiling: int, fillers: list[ScoredCandidate] | None = None,
) -> list[PlannedDay]:
    """Separate main dishes that still come too close together.

    Each step tries, on a day with meal_rhythm_issues, adding a sight or a
    dessert between the dishes, swapping a main dish for light food, or, on a
    day with more than two main dishes, swapping one for a sight or dropping it.
    The move that removes the most issues wins, provided it adds no wait, keeps
    the day's edges and every stop schedulable, and keeps the trip within
    ``ceiling``. Moves are compared on the heuristic route; the winner's route is
    then optimized when that keeps all of the above.
    """
    fillers = fillers or []
    by_id = {candidate.place.id: candidate for candidate in available + fillers}
    earliest = minute_of_day(constraints.daily_start_time)
    latest = minute_of_day(constraints.daily_end_time)
    days = list(days)
    for index, day in enumerate(days):
        for _ in range(REPAIR_MAX_STEPS):
            issues = meal_rhythm_issues(day, constraints)
            current = [by_id[item.place.id] for item in day.items if item.place.id in by_id]
            if issues == 0 or len(current) != len(day.items):
                break
            used = {item.place.id for other in days for item in other.items}
            room = ceiling - (sum(other.cost.total for other in days) - day.cost.total)
            open_unused = [
                candidate for candidate in available + fillers
                if candidate.place.id not in used
                and opening_start(candidate.place, day.date, earliest, latest) is not None
            ]
            sights = [entry for entry in open_unused if not is_food_or_coffee(entry.place)][:REPAIR_POOL_SIZE]
            light = [entry for entry in open_unused if is_light_food(entry.place)][:LIGHT_FOOD_POOL_SIZE]
            mains = [entry for entry in current if is_main_dish(entry.place)]
            selections = [current + [entry] for entry in sights + light]
            selections += [[entry if item is main else item for item in current]
                           for main in mains for entry in light]
            if len(mains) > 2:
                selections += [[item for item in current if item is not main] for main in mains]
                selections += [[entry if item is main else item for item in current]
                               for main in mains for entry in sights[:REPAIR_SWAP_SIGHTS]]

            def acceptable(
                trial: PlannedDay, selection: list[ScoredCandidate], room: int = room, day: PlannedDay = day,
            ) -> bool:
                return ({entry.place.id for entry in selection} == {item.place.id for item in trial.items}
                        and trial.cost.total <= room
                        and gap_minutes(trial) <= gap_minutes(day)
                        and edge_minutes(trial, constraints) <= edge_minutes(day, constraints)
                        and trial.distance_km <= daily_distance_cap_km(constraints))

            best: tuple[tuple[int, int, int], PlannedDay, list[ScoredCandidate]] | None = None
            for selection in selections:
                trial = build_day(day.day_number, day.date, selection, constraints, rain_probability,
                                  optimize_route=False)
                trial_issues = meal_rhythm_issues(trial, constraints)
                if trial_issues >= issues or not acceptable(trial, selection):
                    continue
                key = (trial_issues, len(selection) < len(current), trial.cost.total)
                if best is None or key < best[0]:
                    best = (key, trial, selection)
            if best is None:
                break
            _, trial, selection = best
            optimized = build_day(day.day_number, day.date, selection, constraints, rain_probability,
                                  max_cost=room)
            if (acceptable(optimized, selection)
                    and meal_rhythm_issues(optimized, constraints) <= meal_rhythm_issues(trial, constraints)):
                trial = optimized
            day = days[index] = trial
    return days


def minimum_future_cost(
    candidates: list[ScoredCandidate], constraints: TripConstraints,
    first_day: date, remaining_days: int,
) -> int:
    total = 0
    for offset in range(remaining_days):
        day_date = first_day + timedelta(days=offset)
        possible_costs: list[int] = []
        for item in candidates:
            if opening_start(
                item.place, day_date, minute_of_day(constraints.daily_start_time),
                minute_of_day(constraints.daily_end_time),
            ) is None:
                continue
            _, _, fare = travel_leg(
                constraints.start_location.latitude, constraints.start_location.longitude,
                item.place.latitude, item.place.longitude,
                constraints.travel_mode, constraints.traveler_count,
            )
            possible_costs.append(place_cost(item.place, constraints.traveler_count).total + fare)
        if not possible_costs:
            raise NoFeasibleItinerary(f"No suitable places on day {offset + 1}")
        total += min(possible_costs)
    return total


def build_itinerary(
    places: list[PlaceCandidate], constraints: TripConstraints,
    rain_probability: RainForecast = None,
    option_type: Literal["BEST_MATCH", "BUDGET_FRIENDLY", "EXPLORE_MORE"] = "BEST_MATCH",
    priority: str | None = None,
    avoid_ids: frozenset[str] = frozenset(),
) -> PlannedItinerary:
    ranked = rank_candidates(filter_candidates(places, constraints), constraints, trip_rain(rain_probability))
    if priority == "REDUCE_COST" or (priority is None and option_type == "BUDGET_FRIENDLY"):
        ranked = sorted(
            ranked,
            key=lambda item: (
                item.place.average_cost + item.place.entrance_fee,
                item.rank,
            ),
        )
    elif priority == "REDUCE_DISTANCE":
        ranked = sorted(ranked, key=lambda item: (
            distance_km(
                item.place.latitude, item.place.longitude,
                constraints.start_location.latitude, constraints.start_location.longitude,
            ),
            item.rank,
        ))
    elif priority == "PREFER_INDOOR":
        ranked = sorted(ranked, key=lambda item: (not item.place.indoor, item.rank))
    elif priority == "MORE_LOCAL":
        ranked = sorted(ranked, key=lambda item: (-item.place.local_score, item.rank))
    elif priority == "MORE_FOOD":
        ranked = sorted(ranked, key=lambda item: (item.place.category not in {"food", "coffee"}, item.rank))
    elif priority == "MORE_CHECKIN":
        ranked = sorted(ranked, key=lambda item: ("checkin" not in item.place.tags, item.rank))
    elif priority == "REGENERATE_DAY":
        ranked = sorted(ranked, key=lambda item: (-item.place.local_score, item.place.slug))
    elif option_type == "EXPLORE_MORE":
        # Variety counts thematic tags only; bookkeeping tags such as
        # "outskirts" must not pull the route across the city, and the
        # overall score (which includes distance) breaks ties before raw
        # popularity does.
        ranked = sorted(
            ranked,
            key=lambda item: (item.place.id in avoid_ids,
                              -len((set(item.place.tags) | {item.place.category}) - META_TAGS),
                              item.rank),
        )
    elif priority is None and option_type == "BEST_MATCH":
        ranked = sorted(ranked, key=lambda item: (
            (item.place.average_cost + item.place.entrance_fee) * constraints.traveler_count
            > constraints.budget_total * MAX_BALANCED_STOP_BUDGET_SHARE,
            -spend_priority(item, constraints), item.rank,
        ))
    # The candidate cap applies to attractions only, in ranked order. Meal
    # candidates are kept in full so every day still has affordable
    # breakfast/lunch/dinner choices after geographic and date filtering,
    # and a large catalog of nearby restaurants cannot crowd every museum
    # and temple out of the pool (build_day limits food to the meal slots).
    activity_ids = {
        candidate.place.id for candidate in [
            candidate for candidate in ranked if not is_food_or_coffee(candidate.place)
        ][:MAX_CANDIDATES]
    } | {candidate.place.id for candidate in ranked if is_highlight(candidate.place)}
    available = [
        candidate for candidate in ranked
        if candidate.place.id in activity_ids or is_food_or_coffee(candidate.place)
    ]
    if len(available) < constraints.days:
        raise NoFeasibleItinerary("Not enough suitable places for each day")
    days: list[PlannedDay] = []
    used_ids: set[str] = set()
    base_date = constraints.start_date or datetime.now(ZoneInfo("Asia/Ho_Chi_Minh")).date()
    planning_limit = max(1, int(constraints.budget_total * (1 - ESTIMATED_COST_BUFFER_SHARE)))
    target_count = {"BEST_MATCH": 5, "BUDGET_FRIENDLY": 3, "EXPLORE_MORE": 8}[option_type]
    target_count += {"relaxed": -2, "balanced": 0, "active": 2}[constraints.pace]
    if option_type == "BEST_MATCH" and (
        constraints.budget_total / (constraints.traveler_count * constraints.days) >= 1_000_000
    ):
        target_count += 2
    # At least the three meal slots, so a relaxed budget day is not one snack
    # at breakfast; gap filling then covers the rest of the day.
    target_count = max(3, target_count)
    if priority == "REDUCE_COST":
        target_count = 3
    elif priority == "REDUCE_DISTANCE":
        target_count = min(target_count, 4)
    balanced_stop_limit = (
        int(constraints.budget_total * MAX_BALANCED_STOP_BUDGET_SHARE)
        if option_type in {"BEST_MATCH", "EXPLORE_MORE"} and priority is None and constraints.days > 1
        else None
    )
    for day_number in range(1, constraints.days + 1):
        day_date = base_date + timedelta(days=day_number - 1)
        choices = [item for item in available if item.place.id not in used_ids]
        remaining = planning_limit - sum(day.cost.total for day in days)
        future_count = constraints.days - day_number
        minimum_reserve = minimum_future_cost(
            choices, constraints, day_date + timedelta(days=1), future_count,
        )
        fair_reserve = ceil(
            planning_limit * FUTURE_DAY_BUDGET_SHARE * future_count / constraints.days
        )
        # Two must-see stops on a full day while enough are left for the days to come.
        highlights_left = sum(is_highlight(item.place) for item in choices)
        must_see_count = (
            MUST_SEE_PER_DAY if target_count >= 4 and highlights_left >= MUST_SEE_PER_DAY * (future_count + 1)
            else 1
        )
        try:
            day = select_day(
                day_number, day_date, choices, constraints,
                remaining - max(minimum_reserve, fair_reserve),
                min(target_count, len(choices)), rain_probability, balanced_stop_limit,
                prefer_affordable_meals=(option_type == "BUDGET_FRIENDLY" or priority == "REDUCE_COST"),
                must_see_count=must_see_count,
            )
        except NoFeasibleItinerary:
            try:
                day = select_day(
                    day_number, day_date, choices, constraints,
                    remaining - minimum_reserve,
                    min(target_count, len(choices)), rain_probability, balanced_stop_limit,
                    prefer_affordable_meals=(option_type == "BUDGET_FRIENDLY" or priority == "REDUCE_COST"),
                    must_see_count=must_see_count,
                )
            except NoFeasibleItinerary:
                day = select_day(
                    day_number, day_date, choices, constraints,
                    remaining - minimum_reserve,
                    min(target_count, len(choices)), rain_probability,
                    prefer_affordable_meals=(option_type == "BUDGET_FRIENDLY" or priority == "REDUCE_COST"),
                    must_see_count=must_see_count,
                )
        days.append(day)
        used_ids.update(item.place.id for item in day.items)
    tolerance = BUDGET_TARGET_TOLERANCE.get(option_type)
    fills_budget = tolerance is not None and priority is None
    gap_fill_preference: Literal["rank", "cost", "distance"] = (
        "cost" if priority == "REDUCE_COST" or (priority is None and option_type == "BUDGET_FRIENDLY")
        else "distance" if priority == "REDUCE_DISTANCE" else "rank"
    )
    available_ids = {candidate.place.id for candidate in available}
    fillers = rank_candidates(
        [place for place in free_stroll_candidates(places, constraints) if place.id not in available_ids],
        constraints, trip_rain(rain_probability),
    )[:GAP_FILL_FILLER_POOL_SIZE]

    def fill_gaps(planned: list[PlannedDay]) -> list[PlannedDay]:
        return fill_schedule_gaps(
            planned, available, constraints, rain_probability,
            # Filling idle time outranks the estimate buffer, but never the budget.
            ceiling=constraints.budget_total,
            max_single_stop_cost=balanced_stop_limit, prefer=gap_fill_preference,
            fillers=fillers,
        )

    # Stops come first so the money is not all spent on upgrades before a
    # half-empty afternoon can be filled; upgrades can change visit lengths,
    # so gaps are checked again afterward.
    floor = ceil(constraints.budget_total * (1 - tolerance)) if fills_budget and tolerance is not None else None

    def top_up(planned: list[PlannedDay]) -> list[PlannedDay]:
        if floor is None:
            return planned
        # Free strolls added to fill gaps are part of the day too: without them
        # a day holding one could not be upgraded at all.
        return fill_budget(
            planned, available + fillers, constraints, rain_probability, floor=floor,
            ceiling=constraints.budget_total, max_single_stop_cost=balanced_stop_limit,
        )

    days = fill_gaps(days)
    if floor is not None:
        days = fill_gaps(top_up(days))
    days = relocate_meals(
        days, available + fillers, constraints, rain_probability, floor=floor,
        ceiling=constraints.budget_total, cheaper_only=gap_fill_preference == "cost",
    )
    days = repair_meal_rhythm(
        days, available, constraints, rain_probability, ceiling=constraints.budget_total, fillers=fillers,
    )
    # A shorter route ends a little earlier; keep each day near the traveler's hours.
    days = fill_gaps(days)
    # Shorter routes mean lower fares, which can drop a plan back under its floor.
    if floor is not None and sum(day.cost.total for day in days) < floor:
        days = top_up(days)
    total = BudgetBreakdown()
    for day in days:
        total += day.cost
    errors = validate_days(days, constraints)
    if errors:
        raise NoFeasibleItinerary("; ".join(errors))
    scores = [item.score for day in days for item in day.items]
    return PlannedItinerary(
        option_type, tuple(days), total, round(sum(day.distance_km for day in days), 3),
        sum(day.travel_minutes for day in days), round(sum(scores) / len(scores)),
    )


def generate_options(
    places: list[PlaceCandidate], constraints: TripConstraints,
    rain_probability: RainForecast = None,
) -> tuple[PlannedItinerary, PlannedItinerary, PlannedItinerary]:
    best = build_itinerary(places, constraints, rain_probability, "BEST_MATCH")
    budget = build_itinerary(places, constraints, rain_probability, "BUDGET_FRIENDLY")
    best_ids = frozenset(item.place.id for day in best.days for item in day.items)
    budget_ids = frozenset(item.place.id for day in budget.days for item in day.items)
    explore = build_itinerary(
        places, constraints, rain_probability, "EXPLORE_MORE",
        avoid_ids=best_ids | budget_ids,
    )
    explore_signature = tuple(item.place.id for day in explore.days for item in day.items)
    best_signature = tuple(item.place.id for day in best.days for item in day.items)
    budget_signature = tuple(item.place.id for day in budget.days for item in day.items)
    # Narrow geographic/interest filters may not have enough feasible stops
    # for three completely disjoint routes: try a best-match variation, then
    # other orderings (local favourites, shorter rides, photo spots) before
    # reporting an infeasible trip.
    for variation in (None, "MORE_LOCAL", "REDUCE_DISTANCE", "MORE_CHECKIN"):
        if explore_signature not in {best_signature, budget_signature}:
            break
        try:
            explore = build_itinerary(
                places, constraints, rain_probability, "EXPLORE_MORE", priority=variation, avoid_ids=best_ids,
            )
        except NoFeasibleItinerary:
            continue
        explore_signature = tuple(item.place.id for day in explore.days for item in day.items)
    options = (best, budget, explore)
    signatures = [
        tuple(item.place.id for day in option.days for item in day.items)
        for option in options
    ]
    if len(set(signatures)) != 3:
        raise NoFeasibleItinerary("Could not produce three distinct itineraries")
    return options

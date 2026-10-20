from datetime import date

from test_constraints_ranking import place, trip

from app.domain.planner.constraints import distance_km, serves_interest
from app.domain.planner.planner import select_day
from app.domain.planner.ranking import famous_tier_rank, rank_candidates

VISIT_DATE = date(2026, 10, 20)
HOURS = {str(day): [["07:00", "21:30"]] for day in range(7)}


def sight(slug: str, latitude: float, longitude: float, category: str = "history", tags: tuple = ("history",),
          level: str = "standard", minutes: int = 60):
    return place(id=slug, slug=slug, name=slug, latitude=latitude, longitude=longitude, category=category,
                 tags=tags, highlight_level=level, average_visit_minutes=minutes, average_cost=0,
                 entrance_fee=0, opening_hours=HOURS, indoor=False, outdoor=True)


def meals(latitude: float, longitude: float, count: int = 8):
    return [place(id=f"meal-{latitude}-{n}", slug=f"meal-{latitude}-{n}", name=f"Quán {n}",
                  latitude=latitude + n * 0.001, longitude=longitude, category="food", tags=("food",),
                  average_cost=60_000, average_visit_minutes=60 if n % 3 else 40, opening_hours=HOURS)
            for n in range(count)]


def plan_day(places, constraints, target_count: int = 4, day_number: int = 1):
    """One day with a small stop target: only the stops chosen up front, then meals."""
    ranked = rank_candidates(places, constraints)
    return select_day(day_number, VISIT_DATE, ranked, constraints, constraints.budget_total, target_count, None)


def test_every_interest_gets_a_famous_place_of_its_own() -> None:
    constraints = trip(days=1, startDate=VISIT_DATE, interests=["history", "craft"], budgetTotal=2_000_000)
    places = [
        sight("must-see-temple", 21.035, 105.851, level="must_see"),
        *[sight(f"plain-temple-{n}", 21.036 + n * 0.001, 105.852) for n in range(6)],
        *[sight(f"plain-craft-shop-{n}", 21.034, 105.853 + n * 0.001, category="local_experience",
                tags=("craft",)) for n in range(4)],
        # Further away, but the famous craft village is what a "craft" traveler came for.
        sight("famous-craft-village", 21.06, 105.89, category="local_experience", tags=("craft", "local_culture"),
              level="notable", minutes=90),
        *meals(21.034, 105.85),
    ]
    day = plan_day(places, constraints)
    slugs = {item.place.slug for item in day.items}
    assert {"must-see-temple", "famous-craft-village"} <= slugs
    for interest in ("history", "craft"):
        assert any(serves_interest(item.place, interest) and famous_tier_rank(item.place) for item in day.items)


def test_a_trip_based_outside_the_centre_alternates_local_days_and_outings() -> None:
    # Staying in Sơn Tây, about 35 km from Hoàn Kiếm, with a radius that reaches downtown.
    base = (21.138, 105.505)
    constraints = trip(days=2, startDate=VISIT_DATE, interests=["history"], budgetTotal=3_000_000,
                       travelMode="car", travelRadiusMode="outskirts",
                       startLocation={"name": "Sơn Tây", "latitude": base[0], "longitude": base[1]})
    places = [
        sight("hoan-kiem-must-see", 21.0288, 105.8523, level="must_see", tags=("history", "local_culture")),
        sight("ancient-village", 21.152, 105.475, level="notable", tags=("history", "local_culture"), minutes=120),
        sight("plain-pagoda", 21.130, 105.500),
        *meals(21.139, 105.505), *meals(21.03, 105.85, 6),
    ]

    def from_base(item) -> float:
        return distance_km(base[0], base[1], item.place.latitude, item.place.longitude)

    # Day 1 stays around the base: its famous village and meals nearby, no ride downtown.
    local = plan_day(places, constraints, day_number=1)
    assert "ancient-village" in {item.place.slug for item in local.items}
    assert all(from_base(item) <= 15 for item in local.items)
    # Day 2 is the outing to the must-see sight, without riding back for a local stop.
    outing = plan_day(places, constraints, day_number=2)
    assert "hoan-kiem-must-see" in {item.place.slug for item in outing.items}
    assert not any(item.place.slug in {"ancient-village", "plain-pagoda"} for item in outing.items)


def test_meals_stay_near_the_route_and_vary_the_dish() -> None:
    constraints = trip(days=1, startDate=VISIT_DATE, interests=["history", "food"], budgetTotal=2_000_000)
    near = [place(id=f"cha-ca-{n}", slug=f"cha-ca-{n}", name=f"Chả cá Số {n}", latitude=21.034 + n * 0.001,
                  longitude=105.85, category="food", tags=("food",), average_cost=120_000,
                  average_visit_minutes=60, opening_hours=HOURS, highlight_level="notable") for n in range(2)]
    other = place(id="bun-cha", slug="bun-cha", name="Bún chả Hàng Mành", latitude=21.036, longitude=105.851,
                  category="food", tags=("food",), average_cost=80_000, average_visit_minutes=60,
                  opening_hours=HOURS)
    # Cheapest of all, but 15 km out of town.
    far_snack = place(id="far-banh-mi", slug="far-banh-mi", name="Bánh mì xa", latitude=21.10, longitude=105.72,
                      category="food", tags=("food",), average_cost=10_000, average_visit_minutes=30,
                      opening_hours=HOURS)
    snack = place(id="xoi", slug="xoi", name="Xôi Yến", latitude=21.035, longitude=105.851, category="food",
                  tags=("food",), average_cost=35_000, average_visit_minutes=30, opening_hours=HOURS)
    places = [sight("must-see-temple", 21.035, 105.851, level="must_see"), *near, other, far_snack, snack]
    ranked = rank_candidates(places, constraints)
    for affordable in (False, True):
        day = select_day(1, VISIT_DATE, ranked, constraints, constraints.budget_total, 4, None,
                         prefer_affordable_meals=affordable)
        slugs = [item.place.slug for item in day.items]
        assert "far-banh-mi" not in slugs, (affordable, slugs)
        assert sum(slug.startswith("cha-ca") for slug in slugs) <= 1, (affordable, slugs)


def test_a_quiet_evening_still_ends_near_the_travelers_end_time_with_dinner() -> None:
    from app.domain.planner.planner import build_itinerary
    from app.domain.planner.scheduling import edge_minutes, is_main_meal

    day_hours = {str(day): [["08:00", "17:00"]] for day in range(7)}
    late_hours = {str(day): [["06:00", "22:00"]] for day in range(7)}
    constraints = trip(days=1, startDate=VISIT_DATE, interests=["history", "food"], budgetTotal=2_000_000,
                       dailyStartTime="08:00", dailyEndTime="21:00")
    sights = [place(id=f"temple-{n}", slug=f"temple-{n}", name=f"Đền {n}", latitude=21.035 + n * 0.002,
                    longitude=105.851, category="history", tags=("history",), average_visit_minutes=60,
                    average_cost=0, entrance_fee=0, opening_hours=day_hours, highlight_level="notable" if n == 0 else "standard")
              for n in range(4)]
    eateries = [place(id=f"eat-{n}", slug=f"eat-{n}", name=f"Quán {['Phở', 'Bún chả', 'Chả cá', 'Lẩu', 'Cơm'][n]} {n}",
                      latitude=21.034 + n * 0.001, longitude=105.852, category="food", tags=("food",),
                      average_cost=90_000, average_visit_minutes=60 if n else 30, opening_hours=late_hours)
                for n in range(5)]
    # The temples close at 17:00; only a café keeps the evening going.
    cafe = place(id="cafe", slug="cafe", name="Cà phê Phố", latitude=21.036, longitude=105.852, category="coffee",
                 tags=("coffee",), average_cost=40_000, average_visit_minutes=45, opening_hours=late_hours)
    day = build_itinerary(sights + eateries + [cafe], constraints).days[0]
    assert any(is_main_meal(item.place) and item.start_minute >= 17 * 60 for item in day.items), "no dinner"
    assert edge_minutes(day, constraints) == 0, [(item.place.slug, item.start_minute, item.end_minute, item.travel_minutes) for item in day.items]

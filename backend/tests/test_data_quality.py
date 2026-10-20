from app.domain.planner.constraints import distance_km
from app.infrastructure.db.osm_import import (
    COMMUNE_QUOTA,
    catalog_places,
    commune_of,
    drop_curated_duplicates,
    is_closed,
    is_generic_name,
    load_communes,
    load_snapshot,
    map_element,
)
from app.infrastructure.db.seed import load_curated


def test_generic_names_are_rejected_but_proper_names_are_kept() -> None:
    for name in ("Bánh cuốn nóng gia truyền", "Chợ đêm", "Đình làng", "Quán Ăn", "Cafe", "Quan Com",
                 "Phở 10", "Thưc Đơn"):
        assert is_generic_name(name), name
    for name in ("Chùa Láng", "Phở Thìn", "Bún chả Hương Liên", "Đình Chèm", "Cà phê Giảng"):
        assert not is_generic_name(name), name
    # A house number identifies a venue only when the address backs it up.
    assert is_generic_name("Bánh Mì 25")
    assert not is_generic_name("Bánh Mì 25", {"addr:street": "Hàng Cá"})


def test_closed_and_non_destination_places_are_skipped() -> None:
    assert is_closed({"disused:amenity": "restaurant"}, "Phở Hùng")
    assert is_closed({"opening_hours": "closed"}, "Phở Hùng")
    assert is_closed({}, "Phở Hùng (đã đóng cửa)")
    assert not is_closed({"opening_hours": "06:00-14:00"}, "Phở Hùng")
    def element(name: str, **tags: str) -> dict:
        return {"type": "node", "id": 1, "lat": 21.03, "lon": 105.85, "tags": {"name": name, **tags}}
    assert map_element(element("Đài tưởng niệm liệt sĩ xã Kim Liên", historic="memorial")) is None
    assert map_element(element("Công ty Cổ phần ABC", historic="building")) is None
    assert map_element(element("Pizza Hut Hàng Bài", amenity="restaurant", cuisine="pizza")) is None
    # A named quán serving a Vietnamese dish is kept even without detail tags.
    local = map_element(element("Bún riêu Cô Lan", amenity="fast_food"))
    assert local is not None and "local_culture" in local.tags and "vietnamese_cuisine" in local.signals


def test_communes_cover_hanoi_after_the_2025_reorganisation() -> None:
    communes = load_communes()
    assert len(communes) == 126
    assert commune_of(21.0287, 105.8522) == "Phường Hoàn Kiếm"
    assert commune_of(20.617877, 105.7463786) == "Xã Hương Sơn"


def test_catalog_reaches_almost_every_commune_with_local_food() -> None:
    snapshot = drop_curated_duplicates(load_snapshot())
    curated = [data for data in load_curated()["places"] if data["category"] != "festival"]
    covered: dict[str, set[str]] = {}
    for latitude, longitude, kind in (
        [(p.latitude, p.longitude, "food" if p.category in {"food", "coffee"} or "food" in p.tags
          else "attraction") for p in snapshot]
        + [(d["latitude"], d["longitude"], "food" if d["category"] in {"food", "coffee"} else "attraction")
           for d in curated]
    ):
        commune = commune_of(latitude, longitude)
        if commune:
            covered.setdefault(commune, set()).add(kind)
    # OpenStreetMap has no named places at all in a handful of rural communes.
    assert len(covered) >= 118
    assert sum("food" in kinds for kinds in covered.values()) >= 80
    assert COMMUNE_QUOTA["food"] >= 3 and COMMUNE_QUOTA["attraction"] >= 3


def test_curated_places_are_real_and_sourced() -> None:
    for data in load_curated()["places"]:
        source = data["source"]
        assert source.startswith("https://"), data["slug"]
        assert "openstreetmap.org/copyright" not in source, data["slug"]
        if data["category"] in {"food", "coffee"}:
            # "Bánh Mì 25" is named after its house number, backed by the address it lists;
            # "Bếp 1996" by the map listing of that one restaurant.
            named_by_address = "Địa chỉ:" in data.get("description_vi", "")
            map_listing = any(key in source for key in ("?cid=", "place_id:"))
            assert (not is_generic_name(data["name_vi"]) or named_by_address or map_listing
                    or data["slug"] == "quan-an-ngon"), data["slug"]
    snapshot = load_snapshot()
    assert all(not is_generic_name(place.name_vi) or any(c.isdigit() for c in place.name_vi)
               for place in snapshot)
    local_food = [place for place in snapshot if place.category == "food" and "local_culture" in place.tags]
    assert len(local_food) >= 600


def test_every_commune_has_famous_places_and_eateries_nearby() -> None:
    """Wherever a trip starts in Hanoi, famous sights and real eateries are within reach."""
    places = [(p.latitude, p.longitude, p.category, p.highlight_level) for p in catalog_places()] + [
        (d["latitude"], d["longitude"], d["category"], d.get("highlight_level", "standard"))
        for d in load_curated()["places"] if d["category"] != "festival"
    ]
    for name, _, rings in load_communes():
        ring = max(rings, key=len)
        longitude = sum(x for x, _ in ring) / len(ring)
        latitude = sum(y for _, y in ring) / len(ring)
        nearby = [(category, level) for lat, lon, category, level in places
                  if distance_km(latitude, longitude, lat, lon) <= 10]
        assert any(level != "standard" and category not in {"food", "coffee"} for category, level in nearby), name
        assert sum(category in {"food", "coffee"} for category, _ in nearby) >= 3, name

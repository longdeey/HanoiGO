import json

import httpx
from sqlalchemy import delete, select

from app.infrastructure.db.models import Place
from app.infrastructure.db.osm_import import (
    CATEGORY_CAPS,
    COMMUNE_QUOTA,
    ImportedPlace,
    OverpassUnavailable,
    apply_category_caps,
    deduplicate,
    fetch_elements,
    import_places,
    map_element,
    parse_opening_hours,
    select_with_coverage,
    slugify,
)
from app.infrastructure.db.session import SessionLocal


def test_opening_hours_parser_handles_common_osm_formats() -> None:
    assert parse_opening_hours("24/7")["6"] == [["00:00", "23:59"]]
    assert parse_opening_hours("08:00-17:00")["0"] == [["08:00", "17:00"]]
    split = parse_opening_hours("Mo-Fr 08:00-12:00,13:30-17:00; Sa,Su 09:00-18:00")
    assert split["0"] == [["08:00", "12:00"], ["13:30", "17:00"]]
    assert split["5"] == [["09:00", "18:00"]]
    closed_monday = parse_opening_hours("Mo off; Tu-Su 08:30-17:00")
    assert closed_monday["0"] == [] and closed_monday["1"] == [["08:30", "17:00"]]
    assert parse_opening_hours("Mo-Su 18:00-02:00")["3"] == [["18:00", "23:59"]]
    assert parse_opening_hours("sunrise-sunset") is None
    assert parse_opening_hours("") is None


def test_map_element_classifies_places_and_estimates_costs() -> None:
    pagoda = map_element({
        "type": "node", "id": 1, "lat": 21.05, "lon": 105.83,
        "tags": {"name": "Chùa Kim Liên", "name:en": "Kim Lien Pagoda",
                 "amenity": "place_of_worship", "wikidata": "Q1",
                 "opening_hours": "Mo-Su 06:00-18:00"},
    })
    assert pagoda is not None
    assert pagoda.category == "history" and pagoda.slug == "kim-lien-pagoda-osm-1"
    assert pagoda.hours_from_osm and pagoda.opening_hours["0"] == [["06:00", "18:00"]]
    assert pagoda.source == "https://www.openstreetmap.org/node/1"
    assert "wikipedia" in pagoda.signals
    # Unremarkable places of worship and bare restaurants are skipped.
    assert map_element({"type": "node", "id": 2, "lat": 21.0, "lon": 105.8,
                        "tags": {"name": "Đình làng", "amenity": "place_of_worship"}}) is None
    assert map_element({"type": "node", "id": 3, "lat": 21.0, "lon": 105.8,
                        "tags": {"name": "Quán ăn", "amenity": "restaurant"}}) is None
    street_food = map_element({
        "type": "way", "id": 4, "center": {"lat": 21.03, "lon": 105.85},
        "tags": {"name": "Bún chả Đắc Kim", "amenity": "restaurant", "cuisine": "bun_cha",
                 "addr:street": "Hàng Mành"},
    })
    assert street_food is not None
    assert street_food.category == "food" and street_food.average_cost == 70_000
    assert street_food.average_visit_minutes < 60
    assert "local_culture" in street_food.tags and "vietnamese_cuisine" in street_food.signals
    franchise = map_element({"type": "node", "id": 7, "lat": 21.03, "lon": 105.85,
                             "tags": {"name": "Pizza Hut Hàng Bài", "amenity": "restaurant", "cuisine": "pizza",
                                      "opening_hours": "10:00-22:00"}})
    # Franchises are real but not the local food this planner is about.
    assert franchise is None
    branded_cafe = map_element({"type": "node", "id": 12, "lat": 21.03, "lon": 105.85,
                                "tags": {"name": "Highlands Coffee", "amenity": "cafe", "brand": "Highlands Coffee",
                                         "addr:street": "Tràng Tiền"}})
    assert branded_cafe is None
    independent_foreign = map_element({"type": "node", "id": 13, "lat": 21.03, "lon": 105.85,
                                       "tags": {"name": "Sanmaru Ramen", "amenity": "restaurant", "cuisine": "ramen"}})
    assert independent_foreign is not None and "local_culture" not in independent_foreign.tags
    assert independent_foreign.local_score < street_food.local_score
    peak = map_element({"type": "node", "id": 5, "lat": 21.07, "lon": 105.37,
                        "tags": {"name": "Đỉnh Ba Vì", "natural": "peak"}})
    assert peak is not None
    assert peak.category == "hiking" and {"hiking", "outskirts", "hidden_gem"} <= set(peak.tags)
    assert map_element({"type": "node", "id": 6, "lat": 21.0, "lon": 105.8, "tags": {"name": "x"}}) is None
    # Linear infrastructure with a tourism tag is not a visitable stop.
    assert map_element({"type": "way", "id": 8, "center": {"lat": 21.0, "lon": 105.8},
                        "tags": {"name": "Đường sắt Hà Nội", "railway": "rail", "tourism": "attraction"}}) is None
    market = map_element({"type": "node", "id": 9, "lat": 21.04, "lon": 105.85,
                          "tags": {"name": "Chợ Hôm", "amenity": "marketplace"}})
    assert market is not None
    # A market is where travelers find local food, so it counts toward food coverage.
    assert market.category == "shopping" and "food" in market.tags
    assert market.local_score < 62


def test_deduplicate_prefers_curated_rows_and_richer_osm_records() -> None:
    base = map_element({"type": "node", "id": 10, "lat": 21.0287, "lon": 105.8522,
                        "tags": {"name": "Hồ Hoàn Kiếm", "leisure": "park"}})
    twin_a = map_element({"type": "node", "id": 11, "lat": 21.045, "lon": 105.840,
                          "tags": {"name": "Cafe Pho Co", "amenity": "cafe", "addr:street": "A"}})
    twin_b = map_element({"type": "way", "id": 12, "center": {"lat": 21.0451, "lon": 105.8401},
                          "tags": {"name": "Cafe Pho Co", "amenity": "cafe", "addr:street": "A",
                                   "website": "https://example.com", "opening_hours": "08:00-22:00"}})
    assert base and twin_a and twin_b
    kept = deduplicate([base, twin_a, twin_b], existing=[("Hoan Kiem Lake", "Hồ Hoàn Kiếm", 21.0287, 105.8522)])
    assert [place.osm_id for place in kept] == ["way/12"]


def _cafe(index: int, score: int, commune: str | None = None) -> ImportedPlace:
    return ImportedPlace(
        slug=f"cafe-{index}-osm-{index}", osm_id=f"node/{index}", name_en=f"Cafe {index}",
        name_vi=f"Cà phê {index}", latitude=21.0, longitude=105.8, category="coffee",
        tags=["coffee"], average_cost=50_000, entrance_fee=0, average_visit_minutes=45,
        indoor=True, outdoor=False, local_score=score,
        opening_hours={str(day): [["07:00", "22:00"]] for day in range(7)},
        hours_from_osm=False, description_en="", description_vi="", source="https://osm",
        commune=commune,
    )


def test_category_caps_keep_the_best_scored_places() -> None:
    cap = CATEGORY_CAPS["coffee"]
    rows = [_cafe(index, 60 + index % 20) for index in range(cap + 20)]
    kept = apply_category_caps(rows)
    assert len(kept) == cap
    dropped = [row for row in rows if row not in kept]
    assert min(place.local_score for place in kept) >= max(place.local_score for place in dropped)


def test_every_commune_keeps_its_best_places_beyond_the_cap() -> None:
    cap = CATEGORY_CAPS["coffee"]
    city = [_cafe(index, 80) for index in range(cap)]
    rural = [_cafe(cap + index, 50, "Xã Tản Viên") for index in range(COMMUNE_QUOTA["food"] + 2)]
    kept = select_with_coverage(city + rural)
    assert sum(place.commune == "Xã Tản Viên" for place in kept) == COMMUNE_QUOTA["food"]
    assert len(kept) == cap + COMMUNE_QUOTA["food"]


def test_fetch_elements_retries_then_reports_unavailable() -> None:
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(504, text="busy")

    try:
        fetch_elements('nwr["historic"]["name"]', endpoints=("https://overpass.test/api",),
                       attempts=2, transport=httpx.MockTransport(handler), pause_seconds=0)
    except OverpassUnavailable:
        pass
    else:
        raise AssertionError("expected OverpassUnavailable")
    assert calls == 2
    ok = httpx.MockTransport(lambda request: httpx.Response(200, json={"elements": [
        {"type": "node", "id": 7, "lat": 21.0, "lon": 105.8, "tags": {"name": "Đền Voi Phục", "historic": "monument"}},
    ]}))
    elements = fetch_elements('nwr["historic"]["name"]', endpoints=("https://overpass.test/api",),
                              attempts=1, transport=ok, pause_seconds=0)
    assert [map_element(element).slug for element in elements] == ["den-voi-phuc-osm-7"]


def test_import_places_is_idempotent_and_marks_estimates(tmp_path) -> None:
    rows = [map_element({
        "type": "node", "id": 900_000_001, "lat": 21.16, "lon": 105.46,
        "tags": {"name": "Đình thử nghiệm", "name:en": "Test Communal House", "historic": "monument",
                 "opening_hours": "07:00-18:00"},
    })]
    assert rows[0] is not None
    snapshot = tmp_path / "snapshot.json"
    snapshot.write_text(json.dumps([rows[0].__dict__], ensure_ascii=False), encoding="utf-8")
    try:
        assert import_places(rows) == (1, 0, 0)
        assert import_places(rows) == (0, 1, 0)
        with SessionLocal() as session:
            place = session.scalar(select(Place).where(Place.slug == rows[0].slug))
            assert place is not None
            assert place.category == "history" and place.is_active
            assert not place.price_verified and not place.hours_verified and not place.verified
            assert place.hours_source == place.source == "https://www.openstreetmap.org/node/900000001"
            assert "outskirts" in place.tags
            assert session.scalar(select(Place.slug).where(Place.slug == slugify("Test Communal House") + "-osm-900000001"))
    finally:
        with SessionLocal.begin() as session:
            session.execute(delete(Place).where(Place.slug == rows[0].slug))


def test_boundary_helpers_clip_to_the_city_polygon() -> None:
    from app.infrastructure.db.osm_import import (
        boundary_bbox,
        boundary_rings,
        overpass_query,
        point_in_rings,
    )

    # A square around central Hanoi (lon, lat pairs as GeoJSON) with a bounding box.
    boundary = {
        "geojson": {"type": "Polygon", "coordinates": [[
            [105.80, 21.00], [105.90, 21.00], [105.90, 21.10], [105.80, 21.10], [105.80, 21.00],
        ]]},
        "boundingbox": ["21.00", "21.10", "105.80", "105.90"],
    }
    rings = boundary_rings(boundary)
    assert point_in_rings(21.05, 105.85, rings)
    assert not point_in_rings(21.05, 105.95, rings)
    assert not point_in_rings(20.95, 105.85, rings)
    bbox = boundary_bbox(boundary)
    assert bbox == (21.0, 105.8, 21.1, 105.9)
    query = overpass_query('nwr["historic"]["name"]', bbox)
    assert "(21.0000,105.8000,21.1000,105.9000)" in query and "out center tags" in query
    multi = {"geojson": {"type": "MultiPolygon", "coordinates": [
        boundary["geojson"]["coordinates"],
        [[[106.0, 21.2], [106.1, 21.2], [106.1, 21.3], [106.0, 21.3], [106.0, 21.2]]],
    ]}, "boundingbox": ["21.0", "21.3", "105.8", "106.1"]}
    assert point_in_rings(21.25, 106.05, boundary_rings(multi))

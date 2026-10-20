from dataclasses import replace

from sqlalchemy import delete, select

from app.infrastructure.db.models import Place
from app.infrastructure.db.osm_import import (
    FIXABLE_FIELDS,
    HIGHLIGHT_LEVELS,
    apply_curation,
    catalog_places,
    import_places,
    load_curation,
    load_snapshot,
    map_element,
)
from app.infrastructure.db.seed import load_curated
from app.infrastructure.db.session import SessionLocal


def element(name: str, **tags: str) -> dict:
    return {"type": "node", "id": 900_000_100, "lat": 21.03, "lon": 105.85, "tags": {"name": name, **tags}}


def test_residential_parks_and_anonymous_statues_are_not_imported() -> None:
    for name, tags in (
        ("Công Viên C Khu Chung Cư Vân Canh", {"leisure": "park"}),
        ("Park A - Van Canh Resident Area", {"leisure": "park"}),
        ("Công viên A", {"leisure": "park"}),
        ("Vườn hoa số 3", {"leisure": "garden"}),
        ("Sân chơi khu đô thị Tân Tây Đô", {"leisure": "park"}),
        ("Tượng Phật", {"historic": "memorial"}),
        ("Nhà văn hóa thôn Đông", {"tourism": "attraction"}),
        ("Trụ sở Bộ Ngoại giao", {"historic": "building"}),
    ):
        assert map_element(element(name, **tags)) is None, name
    for name, tags in (
        ("Công viên Thống Nhất", {"leisure": "park"}),
        ("Vườn hoa Lý Thái Tổ", {"leisure": "garden"}),
        ("Tượng Phật Quan Âm", {"historic": "memorial"}),
        ("Chùa Phật Tích", {"amenity": "place_of_worship"}),
    ):
        assert map_element(element(name, **tags)) is not None, name


def test_curation_excludes_promotes_and_fixes_imported_places() -> None:
    park = map_element(element("Công viên Hòa Bình", leisure="park"))
    temple = replace(park, slug="den-thu-osm-2", name_vi="Đen thu", name_en="Den thu", category="park")
    junk = replace(park, slug="junk-osm-3")
    curation = {
        "exclude": {"junk-osm-3": "residential park"},
        "promote": {park.slug: {"level": "notable", "entrance_fee": 10_000, "average_visit_minutes": 90}},
        "fix": {"den-thu-osm-2": {"name_vi": "Đền Thử", "category": "history", "slug": "ignored"}},
    }
    curated = {place.slug: place for place in apply_curation([park, temple, junk], curation)}
    assert set(curated) == {park.slug, "den-thu-osm-2"}
    assert curated[park.slug].highlight_level == "notable"
    assert (curated[park.slug].entrance_fee, curated[park.slug].average_visit_minutes) == (10_000, 90)
    assert curated["den-thu-osm-2"].name_vi == "Đền Thử" and curated["den-thu-osm-2"].category == "history"
    assert curated["den-thu-osm-2"].highlight_level == "standard"


def test_import_records_the_reviewed_highlight_level() -> None:
    place = replace(map_element(element("Đình thử nghiệm nổi tiếng", historic="monument")),
                    slug="dinh-thu-nghiem-noi-tieng-osm-900000100", highlight_level="notable")
    try:
        import_places([place])
        with SessionLocal() as session:
            stored = session.scalar(select(Place).where(Place.slug == place.slug))
            assert stored is not None and stored.highlight_level == "notable"
    finally:
        with SessionLocal.begin() as session:
            session.execute(delete(Place).where(Place.slug == place.slug))


def test_the_curation_file_matches_the_snapshot() -> None:
    curation = load_curation()
    snapshot = {place.slug for place in load_snapshot()}
    from app.domain.stories import load_stories  # stories link to places that must stay
    protected = {slug for story in load_stories() for slug in story.place_slugs}
    assert set(curation["exclude"]) <= snapshot
    assert set(curation["promote"]) <= snapshot and set(curation["fix"]) <= snapshot
    assert not protected & set(curation["exclude"])
    assert all(entry["level"] in HIGHLIGHT_LEVELS for entry in curation["promote"].values())
    assert all(set(fields) <= set(FIXABLE_FIELDS) for fields in curation["fix"].values())
    assert all(reason for reason in curation["exclude"].values())


def test_the_reported_junk_is_gone_from_the_catalog() -> None:
    catalog = {place.slug for place in catalog_places()}
    for slug in ("cong-vien-c-khu-chung-cu-van-canh-osm-548258526", "park-a-van-canh-resident-area-osm-548066437",
                 "park-b-van-canh-resident-area-osm-548066438", "tuong-phat-osm-5129868129",
                 "san-choi-khu-do-thi-tan-tay-do-osm-1365437934"):
        assert slug not in catalog, slug
    curated = {place["slug"] for place in load_curated()["places"]}
    assert not curated & {"sushi-hokkaido"}

import json
import re
from pathlib import Path

from fastapi.testclient import TestClient

from app.domain.stories import LANGUAGES, STORIES_PATH, load_stories, story_for_place
from app.infrastructure.db.session import SessionLocal
from app.infrastructure.repositories.places import PlaceRepository
from app.main import app

client = TestClient(app)
DATA = Path(__file__).resolve().parents[1] / "data"
FRONTEND_DATA = Path(__file__).resolve().parents[2] / "frontend" / "src" / "data"
FRONTEND_IMAGES = FRONTEND_DATA / "hanoi-images.ts"
STORY_PHOTOS = FRONTEND_DATA / "story-photos.ts"
FESTIVAL_PHOTOS = FRONTEND_DATA / "festival-photos.ts"
# Plain years and ranges ("1886", "1805 – 1812") are written the same in both languages.
NUMERIC_YEAR = re.compile(r"[\d\s–-]+")


def catalog_slugs() -> set[str]:
    curated = json.loads((DATA / "curated_places.json").read_text(encoding="utf-8"))["places"]
    osm = json.loads((DATA / "osm_hanoi_places.json").read_text(encoding="utf-8"))
    return {place["slug"] for place in curated} | {place["slug"] for place in osm}


def test_every_story_is_complete_sourced_and_linked_to_real_places() -> None:
    rows = json.loads(STORIES_PATH.read_text(encoding="utf-8"))["stories"]
    stories = load_stories()
    assert len(stories) == len(rows) >= 12
    assert len({story.slug for story in stories}) == len(stories)
    linked = [slug for story in stories for slug in story.place_slugs]
    # One place, one story: a second link would silently hide the first.
    assert len(linked) == len(set(linked))
    assert set(linked) <= catalog_slugs()
    image_keys = set(re.findall(r'^  "([\w-]+)": \{', FRONTEND_IMAGES.read_text(encoding="utf-8"), re.MULTILINE))
    for photos in (STORY_PHOTOS, FESTIVAL_PHOTOS):
        image_keys |= set(re.findall(r'key: "([\w-]+)"', photos.read_text(encoding="utf-8")))
    for story in stories:
        assert story.sources and all(source.url.startswith("https://") for source in story.sources), story.slug
        if story.featured:
            assert story.image_key in image_keys, story.slug
        for language in LANGUAGES:
            text = story.texts[language]
            assert text.title and text.teaser, (story.slug, language)
            assert len(text.sections) >= 2 and all(section.body for section in text.sections), (story.slug, language)
        # Both languages tell the same story: same structure, same years ("Thế kỷ XV" may read "15th century").
        vi, en = story.texts["vi"], story.texts["en"]
        assert len(vi.sections) == len(en.sections), story.slug
        assert len(vi.timeline) == len(en.timeline), story.slug
        for vi_entry, en_entry in zip(vi.timeline, en.timeline):
            if NUMERIC_YEAR.fullmatch(vi_entry.year):
                assert vi_entry.year == en_entry.year, (story.slug, vi_entry.year)
        assert len(vi.tips) == len(en.tips), story.slug


def test_story_list_puts_featured_landmarks_first() -> None:
    response = client.get("/api/v1/stories", params={"language": "vi"})
    assert response.status_code == 200
    stories = response.json()
    featured = [story["featured"] for story in stories]
    assert featured == sorted(featured, reverse=True)
    temple = next(story for story in stories if story["slug"] == "van-mieu-quoc-tu-giam")
    assert temple["title"].startswith("Văn Miếu")
    assert temple["imageKey"] == "van-mieu-quoc-tu-giam-2" and temple["readingMinutes"] >= 1


def test_story_detail_links_the_landmark_and_nearby_stories() -> None:
    response = client.get("/api/v1/stories/van-mieu-quoc-tu-giam", params={"language": "en"})
    assert response.status_code == 200, response.text
    story = response.json()
    assert story["sections"] and story["sources"] and story["timeline"]
    assert story["place"]["slug"] == "temple-of-literature"
    assert story["place"]["story"]["slug"] == "van-mieu-quoc-tu-giam"
    nearby = [item["slug"] for item in story["nearby"]]
    assert "chua-mot-cot" in nearby
    distances = [item["distanceKm"] for item in story["nearby"]]
    assert distances == sorted(distances) and all(distance <= 2.0 for distance in distances)
    missing = client.get("/api/v1/stories/not-a-story")
    assert missing.status_code == 404


def test_places_with_a_story_carry_a_link_to_it() -> None:
    with SessionLocal() as session:
        repository = PlaceRepository(session)
        tower = repository.get_by_slug("turtle-tower-osm-178995269")
        cafe = next(place for place in repository.list_active() if story_for_place(place.slug) is None)
        tower_id, cafe_id = tower.id, cafe.id
    linked = client.get(f"/api/v1/places/{tower_id}", params={"language": "vi"}).json()
    assert linked["story"]["slug"] == "ho-hoan-kiem-thap-rua"
    assert linked["story"]["readingMinutes"] >= 1
    assert client.get(f"/api/v1/places/{cafe_id}").json()["story"] is None


def test_one_site_listed_twice_in_the_catalog_is_planned_once() -> None:
    from datetime import date

    from test_constraints_ranking import trip

    from app.domain.planner.constraints import drop_duplicate_sites
    from app.domain.planner.planner import generate_options
    from app.domain.planner.types import candidate_from_place

    with SessionLocal() as session:
        places = [candidate_from_place(place) for place in PlaceRepository(session).list_active()]
    by_slug = {place.slug: place for place in places}
    citadel, gate = by_slug["imperial-citadel"], by_slug["doan-mon-gate-osm-696389268"]
    assert drop_duplicate_sites([citadel, gate]) == [citadel]
    # Without its main entry (closed, out of range), the secondary entry stays plannable.
    assert drop_duplicate_sites([gate]) == [gate]
    constraints = trip(startDate=date(2026, 10, 20), days=2, budgetTotal=2_000_000,
                       interests=["history", "local_culture", "food"])
    groups = [set(story.place_slugs) for story in load_stories() if story.same_site]
    for option in generate_options(places, constraints):
        planned = {item.place.slug for day in option.days for item in day.items}
        assert all(len(planned & group) <= 1 for group in groups), option.option_type

"""History and culture stories about Hanoi landmarks (data/place_stories.json).

A story belongs to one landmark but may be linked to several catalog slugs,
because the curated catalog and the OpenStreetMap import can both describe the
same site (for example the lake and its Turtle Tower). Text is kept in
Vietnamese and English; every story lists the sources its facts come from.
"""

import json
from dataclasses import dataclass
from functools import lru_cache
from math import ceil
from pathlib import Path

STORIES_PATH = Path(__file__).resolve().parents[2] / "data" / "place_stories.json"
LANGUAGES = ("vi", "en")
# Reading speed used for the "N min read" estimate.
WORDS_PER_MINUTE = 200


@dataclass(frozen=True)
class StorySection:
    heading: str
    body: str


@dataclass(frozen=True)
class TimelineEntry:
    year: str
    text: str


@dataclass(frozen=True)
class StoryText:
    title: str
    teaser: str
    sections: tuple[StorySection, ...]
    timeline: tuple[TimelineEntry, ...]
    tips: tuple[str, ...]

    @property
    def word_count(self) -> int:
        parts = [self.teaser, *(section.heading + " " + section.body for section in self.sections),
                 *(entry.text for entry in self.timeline), *self.tips]
        return sum(len(part.split()) for part in parts)


@dataclass(frozen=True)
class StorySource:
    title: str
    url: str


@dataclass(frozen=True)
class Story:
    slug: str
    place_slugs: tuple[str, ...]
    # The linked places are one visit (for example the lake and its Turtle
    # Tower); the first slug is the main catalog entry.
    same_site: bool
    image_key: str | None
    featured: bool
    themes: tuple[str, ...]
    texts: dict[str, StoryText]
    sources: tuple[StorySource, ...]

    def text(self, language: str) -> StoryText:
        return self.texts.get(language) or self.texts["en"]

    def reading_minutes(self, language: str) -> int:
        return max(1, ceil(self.text(language).word_count / WORDS_PER_MINUTE))


def _text(row: dict) -> StoryText:
    return StoryText(
        title=row["title"], teaser=row["teaser"],
        sections=tuple(StorySection(item["heading"], item["body"]) for item in row["sections"]),
        timeline=tuple(TimelineEntry(str(item["year"]), item["text"]) for item in row.get("timeline", [])),
        tips=tuple(row.get("tips", [])),
    )


@lru_cache(maxsize=1)
def load_stories(path: Path = STORIES_PATH) -> tuple[Story, ...]:
    rows = json.loads(path.read_text(encoding="utf-8"))["stories"]
    return tuple(
        Story(
            slug=row["slug"], place_slugs=tuple(row["place_slugs"]),
            same_site=bool(row.get("same_site", False)),
            image_key=row.get("image_key"), featured=bool(row.get("featured", False)),
            themes=tuple(row.get("themes", [])),
            texts={language: _text(row[language]) for language in LANGUAGES},
            sources=tuple(StorySource(item["title"], item["url"]) for item in row["sources"]),
        )
        for row in rows
    )


@lru_cache(maxsize=1)
def _by_place_slug() -> dict[str, Story]:
    return {place_slug: story for story in load_stories() for place_slug in story.place_slugs}


def story_for_place(place_slug: str) -> Story | None:
    return _by_place_slug().get(place_slug)


@lru_cache(maxsize=1)
def duplicate_site_entries() -> dict[str, str]:
    """Secondary catalog slug -> main slug, for stories whose places are one visit."""
    return {
        slug: story.place_slugs[0]
        for story in load_stories() if story.same_site
        for slug in story.place_slugs[1:]
    }


def get_story(slug: str) -> Story | None:
    return next((story for story in load_stories() if story.slug == slug), None)

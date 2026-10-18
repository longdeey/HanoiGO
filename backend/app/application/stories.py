from sqlalchemy import select
from sqlalchemy.orm import Session

from app.application.schemas import (
    NearbyStoryResponse,
    StoryResponse,
    StorySectionResponse,
    StorySourceResponse,
    StorySummaryResponse,
    StoryTimelineResponse,
)
from app.application.trips import _place_response
from app.domain.planner.constraints import distance_km
from app.domain.stories import Story, get_story, load_stories
from app.infrastructure.db.models import Place

# Other stories within this distance are offered as "nearby" reading.
NEARBY_STORY_RADIUS_KM = 2.0
NEARBY_STORY_LIMIT = 4


def _summary(story: Story, language: str) -> StorySummaryResponse:
    text = story.text(language)
    return StorySummaryResponse(
        slug=story.slug, title=text.title, teaser=text.teaser, imageKey=story.image_key,
        readingMinutes=story.reading_minutes(language), themes=list(story.themes),
        featured=story.featured,
    )


def list_stories(language: str) -> list[StorySummaryResponse]:
    """Every story, featured ones first, each group in file order."""
    stories = sorted(load_stories(), key=lambda story: not story.featured)
    return [_summary(story, language) for story in stories]


def _landmarks(session: Session) -> dict[str, Place]:
    """The first active catalog place of each story: the landmark it is about."""
    slugs = {slug for story in load_stories() for slug in story.place_slugs}
    places = {place.slug: place for place in session.scalars(
        select(Place).where(Place.slug.in_(slugs), Place.is_active.is_(True)),
    )}
    return {
        story.slug: place for story in load_stories()
        if (place := next((places[slug] for slug in story.place_slugs if slug in places), None))
    }


def story_detail(session: Session, slug: str, language: str) -> StoryResponse | None:
    story = get_story(slug)
    if story is None:
        return None
    text = story.text(language)
    landmarks = _landmarks(session)
    place = landmarks.get(story.slug)
    nearby: list[NearbyStoryResponse] = []
    if place is not None:
        for other in load_stories():
            other_place = landmarks.get(other.slug)
            if other.slug == story.slug or other_place is None:
                continue
            distance = distance_km(place.latitude, place.longitude,
                                   other_place.latitude, other_place.longitude)
            if distance <= NEARBY_STORY_RADIUS_KM:
                nearby.append(NearbyStoryResponse(
                    **_summary(other, language).model_dump(), distanceKm=round(distance, 1),
                ))
        nearby.sort(key=lambda item: (item.distanceKm, item.slug))
    return StoryResponse(
        **_summary(story, language).model_dump(),
        sections=[StorySectionResponse(heading=item.heading, body=item.body) for item in text.sections],
        timeline=[StoryTimelineResponse(year=item.year, text=item.text) for item in text.timeline],
        tips=list(text.tips),
        sources=[StorySourceResponse(title=item.title, url=item.url) for item in story.sources],
        place=_place_response(place, language) if place is not None else None,
        nearby=nearby[:NEARBY_STORY_LIMIT],
    )

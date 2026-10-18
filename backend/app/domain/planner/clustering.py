from app.domain.planner.constraints import distance_km
from app.domain.planner.ranking import ScoredCandidate


def group_for_day(
    candidates: list[ScoredCandidate], count: int
) -> list[ScoredCandidate]:
    if not candidates or count <= 0:
        return []
    anchor = candidates[0].place
    return [candidates[0], *sorted(
        candidates[1:],
        key=lambda item: (
            distance_km(anchor.latitude, anchor.longitude,
                        item.place.latitude, item.place.longitude) - item.score * 0.02,
            -item.score, item.place.slug,
        ),
    )[:count - 1]]

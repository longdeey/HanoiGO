from app.domain.planner.config import FAMOUS_DISTANCE_BONUS_KM
from app.domain.planner.constraints import distance_km
from app.domain.planner.ranking import ScoredCandidate, famous_tier_rank


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
                        item.place.latitude, item.place.longitude) - item.score * 0.02
            - FAMOUS_DISTANCE_BONUS_KM * famous_tier_rank(item.place),
            -item.score, item.place.slug,
        ),
    )[:count - 1]]

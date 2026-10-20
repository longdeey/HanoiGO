from dataclasses import dataclass, replace

from app.domain.planner.config import (
    DISCOVERY_TIE_THRESHOLD,
    DISCOVERY_WEIGHTS,
    FEATURED_TIER_SCORES,
    FEEDBACK_PRIOR_RATING,
    FEEDBACK_PRIOR_WEIGHT,
    SCORE_WEIGHTS,
)
from app.domain.planner.constraints import distance_km, radius_for_constraints
from app.domain.planner.types import PlaceCandidate, TripConstraints


@dataclass(frozen=True)
class ScoredCandidate:
    place: PlaceCandidate
    # Layer 1: FinalScore, 0..100.
    score: int
    reasons: tuple[str, ...]
    # Layer 2: DiscoveryScore, 0..100. Only orders places whose FinalScore is
    # within DISCOVERY_TIE_THRESHOLD of each other.
    discovery_score: int = 0
    # Position in the two-layer order produced by rank_candidates.
    rank: int = 0


def featured_tier(place: PlaceCandidate) -> float:
    return FEATURED_TIER_SCORES.get(place.highlight_level, FEATURED_TIER_SCORES["standard"])


def famous_tier_rank(place: PlaceCandidate) -> int:
    """2 for a must-see place, 1 for a notable one, 0 otherwise."""
    return {"must_see": 2, "notable": 1}.get(place.highlight_level, 0)


def feedback_score(place: PlaceCandidate) -> float:
    """Bayesian average of 1-5 star reviews, mapped to 0..100."""
    rating = (
        FEEDBACK_PRIOR_RATING * FEEDBACK_PRIOR_WEIGHT + place.rating_average * place.rating_count
    ) / (FEEDBACK_PRIOR_WEIGHT + place.rating_count)
    return max(0.0, min(100.0, 100 * (rating - 1) / 4))


def discovery_score(place: PlaceCandidate) -> int:
    return round(
        DISCOVERY_WEIGHTS["featured"] * featured_tier(place)
        + DISCOVERY_WEIGHTS["feedback"] * feedback_score(place)
    )


def score_candidate(
    place: PlaceCandidate, constraints: TripConstraints, rain_probability: float | None = None
) -> ScoredCandidate:
    interest_terms = set(constraints.interests)
    place_terms = set(place.tags) | {place.category}
    interest = 100 * len(interest_terms & place_terms) / len(interest_terms)
    radius = radius_for_constraints(constraints)
    geography = max(0.0, 100 * (1 - distance_km(
        constraints.start_location.latitude, constraints.start_location.longitude,
        place.latitude, place.longitude,
    ) / radius))
    window_minutes = (
        constraints.daily_end_time.hour * 60 + constraints.daily_end_time.minute
        - constraints.daily_start_time.hour * 60 - constraints.daily_start_time.minute
    )
    time_fit = min(100.0, 100 * window_minutes / max(place.average_visit_minutes, 1))
    # A budget is a ceiling, yet a balanced plan should use the resources the
    # traveler offers. Compare a single stop with a typical five-stop day;
    # low-budget trips still prefer cheaper places.
    target_cost_per_stop = constraints.budget_total / (
        constraints.traveler_count * constraints.days * 5
    )
    place_price = place.average_cost + place.entrance_fee
    tolerance = target_cost_per_stop * (2 if place_price <= target_cost_per_stop else 1.5)
    budget_fit = max(0.0, 100 * (1 - abs(
        place_price - target_cost_per_stop
    ) / max(tolerance, 1)))
    weather_fit = 50.0 if rain_probability is None else (
        100.0 if (rain_probability >= 0.6) == place.indoor else 20.0
    )
    traveler_fit = 100.0 if place.suitable_for else 50.0
    preference_bonus = 0.0
    if "local" in constraints.experience_preferences and place.experience_type == "local":
        preference_bonus += 10.0
    if "hidden_gem" in constraints.experience_preferences and "hidden_gem" in place.tags:
        preference_bonus += 10.0
    if "checkin" in constraints.experience_preferences and "checkin" in place.tags:
        preference_bonus += 10.0
    components = {
        "interest": interest, "geography": geography, "time": time_fit,
        "budget": budget_fit, "weather": weather_fit,
        "local": min(100.0, place.local_score + preference_bonus), "traveler": traveler_fit,
    }
    # FinalScore = Interest*0.30 + Geography*0.20 + TimeFit*0.15 + BudgetFit*0.10
    #            + WeatherFit*0.10 + LocalValue*0.10 + TravelerFit*0.05
    score = round(sum(components[name] * weight for name, weight in SCORE_WEIGHTS.items()))
    reasons = []
    if interest > 0:
        reasons.append("Matches your interests")
    if place.local_score >= 85:
        reasons.append("Local favorite")
    if place.rating_count > 0 and place.rating_average >= 4.5:
        reasons.append("Highly rated by travelers")
    if rain_probability is not None and rain_probability >= 0.6 and place.indoor:
        reasons.append("Indoor option for rain")
    if place.category == "festival":
        reasons.append("Seasonal event during your trip")
    return ScoredCandidate(
        place, max(0, min(100, score)), tuple(reasons), discovery_score(place)
    )


def apply_discovery_layer(scored: list[ScoredCandidate]) -> list[ScoredCandidate]:
    """Order by FinalScore, letting DiscoveryScore decide among near-equal places.

    Walking down the FinalScore order, each group holds the places within
    DISCOVERY_TIE_THRESHOLD of the group's highest score; inside a group the
    higher DiscoveryScore comes first.
    """
    by_score = sorted(scored, key=lambda item: (-item.score, item.place.slug))
    ordered: list[ScoredCandidate] = []
    start = 0
    while start < len(by_score):
        leader = by_score[start].score
        end = start
        while end < len(by_score) and leader - by_score[end].score <= DISCOVERY_TIE_THRESHOLD:
            end += 1
        ordered.extend(sorted(
            by_score[start:end],
            key=lambda item: (-item.discovery_score, -item.score, item.place.slug),
        ))
        start = end
    return [replace(item, rank=position) for position, item in enumerate(ordered)]


def rank_candidates(
    places: list[PlaceCandidate], constraints: TripConstraints, rain_probability: float | None = None
) -> list[ScoredCandidate]:
    return apply_discovery_layer(
        [score_candidate(place, constraints, rain_probability) for place in places]
    )

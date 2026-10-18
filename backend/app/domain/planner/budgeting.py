from dataclasses import dataclass

from app.domain.planner.types import PlaceCandidate


@dataclass(frozen=True)
class BudgetBreakdown:
    attractions: int = 0
    food: int = 0
    transport: int = 0
    others: int = 0

    @property
    def total(self) -> int:
        return self.attractions + self.food + self.transport + self.others

    def __add__(self, other: "BudgetBreakdown") -> "BudgetBreakdown":
        return BudgetBreakdown(
            self.attractions + other.attractions, self.food + other.food,
            self.transport + other.transport, self.others + other.others,
        )


def place_cost(place: PlaceCandidate, traveler_count: int) -> BudgetBreakdown:
    if place.category in {"food", "coffee"}:
        return BudgetBreakdown(food=(place.average_cost + place.entrance_fee) * traveler_count)
    return BudgetBreakdown(attractions=place.entrance_fee * traveler_count,
                           others=place.average_cost * traveler_count)

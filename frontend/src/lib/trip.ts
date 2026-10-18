import type { TripFormValues } from "@/schemas/trip";
import type { ItineraryDay, ItineraryOption, TripResponse } from "@/types/trip";
import { planDraft, tripSummary } from "@/lib/storage";

export const OPTION_LABELS: Record<ItineraryOption["type"], string> = {
  BEST_MATCH: "Best Match", BUDGET_FRIENDLY: "Budget Friendly", EXPLORE_MORE: "Explore More",
};

/** Day line colour (spec §6.1): blue, moss, turmeric, plum, teal, then repeat. Never red. */
export function dayColor(dayNumber: number): string {
  return `var(--day-${((Math.max(1, dayNumber) - 1) % 5) + 1})`;
}

export function budgetTotal(option: ItineraryOption): number {
  return option.budget.total + option.budget.remaining;
}

/** Share of the budget used, computed in the browser [client]. */
export function budgetShare(option: ItineraryOption): number {
  const total = budgetTotal(option);
  return total > 0 ? option.budget.total / total : 0;
}

export function stopCount(option: ItineraryOption): number {
  return option.days.reduce((sum, day) => sum + day.items.length, 0);
}

export type OptionBadge = "Cheapest" | "Most places" | "Least travel";

/** Comparative badges [client]; a tie earns no badge. */
export function optionBadges(options: ItineraryOption[]): Map<string, OptionBadge[]> {
  const result = new Map<string, OptionBadge[]>(options.map((option) => [option.id, []]));
  const award = (badge: OptionBadge, score: (option: ItineraryOption) => number, pick: "min" | "max") => {
    if (options.length < 2) return;
    const values = options.map(score);
    const best = pick === "min" ? Math.min(...values) : Math.max(...values);
    const winners = options.filter((_, index) => values[index] === best);
    if (winners.length === 1) result.get(winners[0].id)?.push(badge);
  };
  award("Cheapest", (option) => option.estimatedTotalCost, "min");
  award("Most places", stopCount, "max");
  award("Least travel", (option) => option.estimatedTotalTravelMinutes, "min");
  return result;
}

/** True when the scheduled stay is longer than the place's usual visit (real data, no guessing). */
export function stayExtended(item: ItineraryDay["items"][number]): boolean {
  return item.visitMinutes > item.place.averageVisitMinutes;
}

/** Party cost of the stop itself (the ride fare is shown on the leg). */
export function stopCost(item: ItineraryDay["items"][number]): number {
  return item.estimatedCost;
}

/** Values to prefill /plan when editing a trip's request (F35). */
export function editPrefill(trip: TripResponse): Partial<TripFormValues> {
  const draft = planDraft();
  if (draft) return draft;
  const summary = tripSummary(trip.tripId);
  const option = trip.options[0];
  const prefill: Partial<TripFormValues> = {
    language: trip.language,
    days: option?.days.length ?? summary?.days,
    startDate: summary?.startDate ?? option?.days[0]?.date ?? "",
    travelMode: trip.travelMode === "motorbike" || trip.travelMode === "car" ? trip.travelMode : "walking",
  };
  const budget = summary?.budgetTotal ?? (option ? budgetTotal(option) : undefined);
  if (budget) prefill.budgetTotal = budget;
  if (summary?.travelerCount) prefill.travelerCount = summary.travelerCount;
  if (trip.startLatitude !== undefined && trip.startLongitude !== undefined) {
    prefill.startLocationCoordinates = { latitude: trip.startLatitude, longitude: trip.startLongitude };
    prefill.startLocationName = summary?.startName ?? `${trip.startLatitude.toFixed(5)}, ${trip.startLongitude.toFixed(5)}`;
  }
  return prefill;
}

/** URL of an option page, keeping a share token so read-only links stay read-only. */
export function optionHref(tripId: string, optionId: string, share: string | null, extra = ""): string {
  const params = new URLSearchParams(extra);
  if (share) params.set("share", share);
  const query = params.toString();
  return `/trips/${encodeURIComponent(tripId)}/${encodeURIComponent(optionId)}${query ? `?${query}` : ""}`;
}

export function tripHref(tripId: string, share: string | null): string {
  return `/trips/${encodeURIComponent(tripId)}${share ? `?share=${encodeURIComponent(share)}` : ""}`;
}

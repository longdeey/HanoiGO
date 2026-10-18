// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { option, trip } from "@/test/render";
import { budgetShare, dayColor, editPrefill, optionBadges, stopCount } from "./trip";
import { savePlanDraft, saveTripSummary } from "./storage";

afterEach(() => { window.localStorage.clear(); window.sessionStorage.clear(); });

describe("trip helpers", () => {
  it("computes the budget share and stop count in the browser", () => {
    const best = option("BEST_MATCH", "best");
    expect(budgetShare(best)).toBeCloseTo(0.95);
    expect(stopCount(best)).toBe(2);
  });

  it("never colours a day line red and repeats after day 5", () => {
    expect(dayColor(1)).toBe("var(--day-1)");
    expect(dayColor(6)).toBe("var(--day-1)");
    expect(dayColor(5)).toBe("var(--day-5)");
  });

  it("awards a badge only to a clear winner", () => {
    const cheap = option("BUDGET_FRIENDLY", "cheap", { estimatedTotalCost: 1_000_000, estimatedTotalTravelMinutes: 300 });
    const best = option("BEST_MATCH", "best", { estimatedTotalTravelMinutes: 200 });
    const explore = option("EXPLORE_MORE", "explore", { estimatedTotalTravelMinutes: 200 });
    const badges = optionBadges([best, cheap, explore]);
    expect(badges.get("cheap")).toEqual(["Cheapest"]);
    // Equal stop counts and equal travel time: no badge for either.
    expect(badges.get("best")).toEqual([]);
    expect(badges.get("explore")).toEqual([]);
  });

  it("prefills an edit from the saved summary and the trip itself", () => {
    saveTripSummary({ tripId: "trip-1", startDate: "2026-10-18", days: 1, travelerCount: 4, budgetTotal: 3_000_000, startName: "Phố cổ", createdAt: "" });
    expect(editPrefill(trip())).toMatchObject({
      days: 1, travelerCount: 4, budgetTotal: 3_000_000, startDate: "2026-10-18", travelMode: "walking",
      startLocationName: "Phố cổ", startLocationCoordinates: { latitude: 21.034, longitude: 105.85 },
    });
  });

  it("prefers the form draft still open in this tab", () => {
    savePlanDraft({ days: 5, budgetTotal: 9_000_000 });
    expect(editPrefill(trip())).toEqual({ days: 5, budgetTotal: 9_000_000 });
  });
});

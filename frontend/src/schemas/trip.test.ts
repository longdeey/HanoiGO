import { describe, expect, it } from "vitest";

import { MAX_BUDGET, tripSchema } from "./trip";

const base = {
  language: "vi", days: 3, travelerCount: 2, budgetTotal: 3_000_000,
  startLocationName: "Hanoi Old Quarter", interests: ["food"],
  travelMode: "car", travelRadiusMode: "outskirts", pace: "balanced",
  experiencePreferences: ["festival", "hiking"],
  dailyStartTime: "08:00", dailyEndTime: "21:00",
};

describe("dated trip form", () => {
  it("accepts a real date and an outskirts travel radius", () => {
    expect(tripSchema.safeParse({ ...base, startDate: "2026-09-25" }).success).toBe(true);
  });

  it("accepts an empty start date: the date is optional", () => {
    expect(tripSchema.safeParse({ ...base, startDate: "" }).success).toBe(true);
  });

  it("rejects absent or impossible dates", () => {
    expect(tripSchema.safeParse(base).success).toBe(false);
    expect(tripSchema.safeParse({ ...base, startDate: "2026-02-30" }).success).toBe(false);
  });
});

describe("budget cap", () => {
  it("rejects a budget the API cannot store", () => {
    const dated = { ...base, startDate: "" };
    expect(tripSchema.safeParse({ ...dated, budgetTotal: MAX_BUDGET }).success).toBe(true);
    const over = tripSchema.safeParse({ ...dated, budgetTotal: 100_000_003_000 });
    expect(over.success).toBe(false);
    expect(over.error?.issues[0]?.path).toEqual(["budgetTotal"]);
  });
});

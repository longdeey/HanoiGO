import { describe, expect, it, vi } from "vitest";

import { ApiRequestError, generateTrip } from "./api";
import type { TripFormValues } from "@/schemas/trip";

const values: TripFormValues = {
  language: "en", startDate: "2026-09-25", days: 3, travelerCount: 2,
  budgetTotal: 3_000_000,
  startLocationName: "Hanoi Old Quarter", interests: ["food"],
  travelMode: "walking", travelRadiusMode: "balanced", pace: "balanced",
  experiencePreferences: ["local"], dailyStartTime: "08:00", dailyEndTime: "21:00",
};

describe("trip generation requests", () => {
  it("keeps one request while a slow planner response is pending", async () => {
    let finish: ((value: { ok: boolean; json: () => Promise<unknown> }) => void) | undefined;
    const fetchMock = vi.fn().mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    vi.stubGlobal("fetch", fetchMock);
    const clock = vi.spyOn(performance, "now").mockReturnValue(0);
    const slowValues = { ...values, budgetTotal: 3_010_000 };
    const first = generateTrip(slowValues);
    await Promise.resolve();
    clock.mockReturnValue(5_000);
    const second = generateTrip(slowValues);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    finish?.({ ok: true, json: async () => ({ tripId: "slow", language: "en", options: [] }) });
    expect((await first).tripId).toBe("slow");
    expect((await second).tripId).toBe("slow");
    clock.mockRestore();
    vi.unstubAllGlobals();
  });
  it("coalesces rapid identical submissions and preserves the same trip ID", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ tripId: "one", language: "en", options: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const first = generateTrip(values);
    const second = generateTrip({ ...values });
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((await first).tripId).toBe("one");
    expect((await second).tripId).toBe("one");
    vi.unstubAllGlobals();
  });
  it("resolves a freely entered Hanoi address before sending changed constraints", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/locations/resolve")) return Promise.resolve({
        ok: true, json: async () => ({ name: "Nguyễn Trãi, Hà Nội", latitude: 21.001, longitude: 105.817 }),
      });
      const body = JSON.parse(init?.body as string) as {
        startDate: string; budgetTotal: number; interests: string[]; travelMode: string;
        startLocation: { latitude: number; longitude: number };
      };
      expect(body.budgetTotal).toBe(10_000_000);
      expect(body.startDate).toBe("2026-09-25");
      expect(body.interests).toEqual(["history"]);
      expect(body.travelMode).toBe("motorbike");
      expect(body.startLocation).toMatchObject({ latitude: 21.001, longitude: 105.817 });
      return Promise.resolve({ ok: true, json: async () => ({ tripId: "changed", language: "en", options: [] }) });
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await generateTrip({ ...values, startLocationName: "123 Nguyễn Trãi, Hà Nội",
      budgetTotal: 10_000_000, interests: ["history"], travelMode: "motorbike" });
    expect(result.tripId).toBe("changed");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain("query=123");
    vi.unstubAllGlobals();
  });
  it("uses a chosen map pin without calling the unavailable address provider", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      expect(url).toContain("/trips/generate");
      expect(url).not.toContain("/locations/resolve");
      const body = JSON.parse(init?.body as string) as {
        startLocation: { name: string; latitude: number; longitude: number };
      };
      expect(body.startLocation).toEqual({
        name: "Map pin 21.00100, 105.81700", latitude: 21.001, longitude: 105.817,
      });
      return Promise.resolve({
        ok: true, json: async () => ({ tripId: "pin-trip", language: "en", options: [] }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await generateTrip({ ...values, budgetTotal: 3_020_000,
      startLocationName: "Map pin 21.00100, 105.81700",
      startLocationCoordinates: { latitude: 21.001, longitude: 105.817 } });
    expect(result.tripId).toBe("pin-trip");
    expect(fetchMock).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });
  it("preserves structured business suggestions from a failed planner response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false, json: async () => ({ success: false, error: {
        code: "NO_FEASIBLE_ITINERARY", message: "No feasible activities on day 3",
        details: ["Increase travel radius", "Increase budget"],
      } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(generateTrip({ ...values, budgetTotal: 3_030_000 }))
      .rejects.toMatchObject(new ApiRequestError("NO_FEASIBLE_ITINERARY",
        "No feasible activities on day 3", ["Increase travel radius", "Increase budget"]));
    vi.unstubAllGlobals();
  });
});

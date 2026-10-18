import { describe, expect, it } from "vitest";

import { googleMapsDirectionsUrl } from "./maps";
import type { Place } from "@/types/trip";

const place: Place = {
  id: "poi", slug: "poi", name: "Hanoi place", category: "history",
  latitude: 21.0383903, longitude: 105.8406237,
  averageCost: 0, entranceFee: 0, averageVisitMinutes: 60,
  indoor: false, outdoor: true, priceVerified: false, hoursVerified: false,
  priceSource: null, hoursSource: null, highlightLevel: "standard",
  availableFrom: null, availableUntil: null, informationSource: null, annual: false,
};

describe("Google Maps directions link", () => {
  it("targets the selected POI with the requested transport mode", () => {
    for (const [mode, expected] of [
      ["walking", "walking"], ["motorbike", "two-wheeler"], ["car", "driving"],
    ] as const) {
      const url = new URL(googleMapsDirectionsUrl(place, mode));
      expect(url.origin).toBe("https://www.google.com");
      expect(url.pathname).toBe("/maps/dir/");
      expect(url.searchParams.get("api")).toBe("1");
      expect(url.searchParams.get("destination")).toBe("21.0383903,105.8406237");
      expect(url.searchParams.get("travelmode")).toBe(expected);
      expect(url.searchParams.get("dir_action")).toBe("navigate");
    }
  });
});

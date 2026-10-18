import { describe, expect, it } from "vitest";

import { parseManualLocation } from "./locations";

describe("manual Hanoi start location", () => {
  it("accepts coordinate pairs and Google Maps location links", () => {
    expect(parseManualLocation("21.034, 105.850")).toEqual({ latitude: 21.034, longitude: 105.85 });
    expect(parseManualLocation("https://www.google.com/maps/@21.034,105.85,15z")).toEqual({
      latitude: 21.034, longitude: 105.85,
    });
    expect(parseManualLocation("https://maps.google.com/?q=21.034%2C105.85")).toEqual({
      latitude: 21.034, longitude: 105.85,
    });
  });

  it("rejects unusable links and points outside Hanoi", () => {
    expect(parseManualLocation("https://maps.app.goo.gl/short-link")).toBeNull();
    expect(parseManualLocation("10.823, 106.630")).toBeNull();
    expect(parseManualLocation("21.034, nope")).toBeNull();
  });
});

// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import PlannerApp from "./PlannerApp";
import { fetchStories, fetchStory, generateTrip } from "@/services/api";
import type { Place, StoryDetail, StorySummary, TripResponse } from "@/types/trip";

vi.mock("@/services/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/api")>()),
  fetchStories: vi.fn(), fetchStory: vi.fn(), generateTrip: vi.fn(),
}));
beforeEach(() => { vi.mocked(fetchStories).mockResolvedValue([]); });
afterEach(() => { cleanup(); vi.resetAllMocks(); window.history.replaceState(null, "", "/"); window.localStorage?.clear(); });

const temple: Place = {
  id: "place-temple", slug: "temple-of-literature", name: "Temple of Literature", category: "history",
  latitude: 21.0293, longitude: 105.8355, averageCost: 0, entranceFee: 70_000, averageVisitMinutes: 90,
  indoor: false, outdoor: true, priceVerified: true, hoursVerified: true, priceSource: null, hoursSource: null,
  highlightLevel: "must_see", availableFrom: null, availableUntil: null, informationSource: null, annual: false,
  story: { slug: "van-mieu-quoc-tu-giam", title: "Temple of Literature: Vietnam's first university",
    teaser: "Built in 1070 to honour Confucius.", readingMinutes: 3 },
};
const summary: StorySummary = {
  slug: "van-mieu-quoc-tu-giam", title: "Temple of Literature: Vietnam's first university",
  teaser: "Built in 1070 to honour Confucius.", imageKey: "history", readingMinutes: 3,
  themes: ["history", "education"], featured: true,
};
const detail: StoryDetail = {
  ...summary,
  sections: [{ heading: "A temple, then a school", body: "The academy opened in 1076.\n\nScholars studied the classics." }],
  timeline: [{ year: "1070", text: "Temple built" }],
  tips: ["Dress modestly."],
  sources: [{ title: "Official site", url: "https://vanmieu.gov.vn/vi" }],
  place: temple,
  nearby: [{ slug: "one-pillar-pagoda", title: "One Pillar Pagoda", teaser: "A lotus on one pillar.",
    imageKey: "one_pillar_pagoda", readingMinutes: 2, themes: [], featured: true, distanceKm: 0.8 }],
};

describe("stories", () => {
  it("opens a landmark story from the home page, marks it read and keeps a shareable link", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchStories).mockResolvedValue([summary]);
    vi.mocked(fetchStory).mockResolvedValue(detail);
    render(<PlannerApp />);
    await user.click(await screen.findByRole("button", { name: /Temple of Literature: Vietnam's first university\. Read the story/ }));
    const dialog = await screen.findByRole("dialog");
    expect(fetchStory).toHaveBeenCalledWith("van-mieu-quoc-tu-giam", "en");
    expect(within(dialog).getByRole("heading", { name: "Temple of Literature: Vietnam's first university" })).toBeTruthy();
    expect(within(dialog).getByText("Scholars studied the classics.")).toBeTruthy();
    expect(within(dialog).getByText("Temple built")).toBeTruthy();
    expect(within(dialog).getByRole("link", { name: "Official site" }).getAttribute("href")).toBe("https://vanmieu.gov.vn/vi");
    expect(within(dialog).getByRole("button", { name: /One Pillar Pagoda/ })).toBeTruthy();
    expect(window.location.search).toBe("?story=van-mieu-quoc-tu-giam");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(window.location.search).toBe("");
    expect(screen.getByText(/✓ Read/)).toBeTruthy();
  });

  it("opens the story named in the link and can start planning from the landmark", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchStory).mockResolvedValue(detail);
    window.history.replaceState(null, "", "/?story=van-mieu-quoc-tu-giam");
    render(<PlannerApp />);
    const dialog = await screen.findByRole("dialog");
    await user.click(await within(dialog).findByRole("button", { name: "Plan a trip from here" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect((screen.getByLabelText("Starting point") as HTMLInputElement).value).toBe("Temple of Literature");
    expect(screen.getByText(/Starting point set from a story/)).toBeTruthy();
  });

  it("links itinerary stops that have a story to the reader", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchStory).mockResolvedValue(detail);
    const option = (type: "BEST_MATCH" | "BUDGET_FRIENDLY" | "EXPLORE_MORE", id: string) => ({
      id, type, matchScore: 90, estimatedTotalCost: 140_000, estimatedTotalDistanceKm: 1,
      estimatedTotalTravelMinutes: 10, totalPlaces: 1,
      budget: { attractions: 140_000, food: 0, transport: 0, others: 0, total: 140_000, remaining: 2_860_000 },
      days: [{ dayNumber: 1, date: "2026-09-15", theme: "", estimatedCost: 140_000, estimatedDistanceKm: 1,
        estimatedTravelMinutes: 10, items: [{ id: `${id}-item`, sequence: 1, startTime: "09:00", endTime: "10:30",
          visitMinutes: 90, travelMinutes: 10, travelKm: 1, estimatedCost: 140_000, travelCost: 0,
          recommendationScore: 90, reasons: [], locked: false, place: temple }] }],
    });
    const trip: TripResponse = { tripId: "trip-1", language: "en", travelMode: "walking", ownerToken: "owner",
      seasonalHighlights: [], stayOptions: [],
      options: [option("BEST_MATCH", "best"), option("BUDGET_FRIENDLY", "budget"), option("EXPLORE_MORE", "explore")] };
    vi.mocked(generateTrip).mockResolvedValue(trip);
    render(<PlannerApp />);
    for (let step = 0; step < 3; step += 1) await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Build my Hanoi trip" }));
    await user.click((await screen.findAllByRole("button", { name: "View plan" }))[0]);
    expect(screen.getByText(/1 history & culture stories along today's route/)).toBeTruthy();
    expect(screen.getByText("Built in 1070 to honour Confucius.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Read the story" }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(fetchStory).toHaveBeenCalledWith("van-mieu-quoc-tu-giam", "en");
  });
});

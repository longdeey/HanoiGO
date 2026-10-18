// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import PlannerApp from "./PlannerApp";
import { ApiRequestError, createShareToken, fetchStories, fetchTrip, generateTrip, optimizeTrip, replacePlace } from "@/services/api";
import type { ItineraryOption, TripResponse } from "@/types/trip";

vi.mock("@/services/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/api")>()),
  createShareToken: vi.fn(), fetchTrip: vi.fn(), generateTrip: vi.fn(),
  replacePlace: vi.fn(), optimizeTrip: vi.fn(), fetchStories: vi.fn(),
}));
beforeEach(() => { vi.mocked(fetchStories).mockResolvedValue([]); });
afterEach(() => { cleanup(); vi.resetAllMocks(); window.history.replaceState(null, "", "/"); window.localStorage?.clear(); });

const option = (type: ItineraryOption["type"], id: string): ItineraryOption => ({
  id, type, matchScore: 90, estimatedTotalCost: 500_000,
  estimatedTotalDistanceKm: 3.2, estimatedTotalTravelMinutes: 45, totalPlaces: 1,
  budget: { attractions: 100_000, food: 300_000, transport: 100_000, others: 0,
    total: 500_000, remaining: 2_500_000 },
  days: [{ dayNumber: 1, date: "2026-09-15", theme: "Hanoi discovery",
    estimatedCost: 500_000, estimatedDistanceKm: 3.2, estimatedTravelMinutes: 45,
    items: [{ id: `${id}-item`, sequence: 1, startTime: "09:00", endTime: "10:00",
      visitMinutes: 60, travelMinutes: 8, travelKm: 0.5, estimatedCost: 50_000,
      travelCost: 0, recommendationScore: 90, reasons: ["Local favorite"], locked: false,
      place: { id: "place-1", slug: "hoan-kiem-lake", name: "Hoan Kiem Lake",
        category: "park", latitude: 21.0287, longitude: 105.8522,
        averageCost: 0, entranceFee: 0, averageVisitMinutes: 60,
        indoor: false, outdoor: true, priceVerified: false, hoursVerified: false,
        priceSource: null, hoursSource: null, highlightLevel: "standard",
        availableFrom: null, availableUntil: null, informationSource: null, annual: false,
        ratingAverage: 4.7, ratingCount: 12,
        comments: [{ id: "review-1", authorName: "Lan", rating: 5, comment: "Rất đáng ghé", createdAt: "2026-09-15T08:00:00Z" }],
        bookingSource: "https://example.com/tickets" } }],
  }],
});

const result: TripResponse = { tripId: "trip-1", language: "en", travelMode: "walking",
  ownerToken: "owner-secret", seasonalHighlights: [], stayOptions: [], options: [
  option("BEST_MATCH", "best"), option("BUDGET_FRIENDLY", "budget"),
  option("EXPLORE_MORE", "explore"),
] };

async function reachSubmit(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Next" }));
  await user.click(screen.getByRole("button", { name: "Next" }));
  await user.click(screen.getByRole("button", { name: "Next" }));
}

describe("planner UI", () => {
  it("sends the chosen travel date and offers festival and hiking interests", async () => {
    const user = userEvent.setup();
    vi.mocked(generateTrip).mockResolvedValue(result);
    render(<PlannerApp />);
    const dateInput = screen.getByLabelText("Travel start date") as HTMLInputElement;
    await user.clear(dateInput);
    await user.type(dateInput, "2026-09-25");
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("button", { name: "festival" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "hiking" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "nightlife" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "festival" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Build my Hanoi trip" }));
    await waitFor(() => expect(generateTrip).toHaveBeenCalledWith(expect.objectContaining({
      startDate: "2026-09-25", interests: expect.arrayContaining(["festival"]),
    }), expect.anything()));
  });

  it("shows the three travel radius bands and keeps experience choices in interests", async () => {
    const user = userEvent.setup();
    render(<PlannerApp />);
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    const radius = screen.getByRole("combobox", { name: /Travel radius/ }) as HTMLSelectElement;
    expect(Array.from(radius.options).map((option) => option.textContent)).toEqual([
      "Nearby · under 5 km", "Medium · 5–15 km", "Far · over 15 km",
    ]);
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Pace")).toBeTruthy();
    expect(screen.queryByText("Experience")).toBeNull();
  });

  it("shows date-specific events and a red can't-miss timeline badge", async () => {
    const user = userEvent.setup();
    const seasonal: TripResponse = structuredClone(result);
    const featured = seasonal.options[0].days[0].items[0].place;
    featured.highlightLevel = "must_see";
    seasonal.seasonalHighlights = [{ date: "2026-09-25", place: {
      ...featured, id: "festival-1", slug: "hang-ma-mid-autumn",
      name: "Hang Ma Mid-Autumn Lantern Walk", category: "festival",
      availableFrom: "2026-09-11", availableUntil: "2026-09-25",
      informationSource: "https://vietnam.travel/node/495", annual: false,
    } }];
    vi.mocked(generateTrip).mockResolvedValue(seasonal);
    render(<PlannerApp />);
    await reachSubmit(user);
    await user.click(screen.getByRole("button", { name: "Build my Hanoi trip" }));
    await waitFor(() => expect(screen.getByText("Hang Ma Mid-Autumn Lantern Walk")).toBeTruthy());
    expect(screen.getByText("2026-09-25")).toBeTruthy();
    await user.click(screen.getAllByRole("button", { name: "View plan" })[0]);
    await waitFor(() => expect(screen.getByText(/Can.t miss/)).toBeTruthy());
  });
  it("lists holidays on the trip dates even without an event place", async () => {
    const user = userEvent.setup();
    const holidayTrip: TripResponse = structuredClone(result);
    holidayTrip.holidays = [{
      key: "labour_day", name: "International Labour Day", kind: "public_holiday", isPublicHoliday: true,
      startDate: "2027-05-01", endDate: "2027-05-01", tripDates: ["2027-05-01"],
      description: "Official public holiday.", suggestion: "The centre is calmer than usual.", relatedPlaces: [],
    }];
    vi.mocked(generateTrip).mockResolvedValue(holidayTrip);
    render(<PlannerApp />);
    await reachSubmit(user);
    await user.click(screen.getByRole("button", { name: "Build my Hanoi trip" }));
    const panel = await screen.findByRole("region", { name: "Holidays during your trip" });
    expect(within(panel).getByText("International Labour Day")).toBeTruthy();
    expect(within(panel).getByText("2027-05-01")).toBeTruthy();
    expect(within(panel).getByText("Public holiday")).toBeTruthy();
    expect(within(panel).getByText("The centre is calmer than usual.")).toBeTruthy();
  });
  it("shows ratings, comments, and booking information without estimate badges", async () => {
    const user = userEvent.setup();
    vi.mocked(generateTrip).mockResolvedValue(result);
    render(<PlannerApp />);
    await reachSubmit(user);
    await user.click(screen.getByRole("button", { name: "Build my Hanoi trip" }));
    await user.click((await screen.findAllByRole("button", { name: "View plan" }))[0]);
    expect(screen.getByText("★ 4.7")).toBeTruthy();
    expect(screen.getByText(/Rất đáng ghé/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Booking\/ticket information" })).toBeTruthy();
    expect(screen.queryByText("Hours estimate")).toBeNull();
    expect(screen.queryByText("Cost estimate")).toBeNull();
  });
  it("switches core planner and itinerary labels to Vietnamese", async () => {
    const user = userEvent.setup();
    vi.mocked(generateTrip).mockResolvedValue({ ...result, language: "vi" });
    render(<PlannerApp />);
    await user.selectOptions(screen.getByRole("combobox", { name: "Language" }), "vi");
    expect(screen.getByRole("spinbutton", { name: "Số ngày" })).toBeTruthy();
    await user.clear(screen.getByRole("spinbutton", { name: "Số ngày" }));
    await user.type(screen.getByRole("spinbutton", { name: "Số ngày" }), "0");
    await user.click(screen.getByRole("button", { name: "Tiếp" }));
    expect(screen.getByRole("alert").textContent).toContain("Số ngày phải từ 1 trở lên");
    await user.clear(screen.getByRole("spinbutton", { name: "Số ngày" }));
    await user.type(screen.getByRole("spinbutton", { name: "Số ngày" }), "3");
    await user.click(screen.getByRole("button", { name: "Tiếp" }));
    expect(screen.getByText("Bạn muốn trải nghiệm gì?")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Tiếp" }));
    await user.click(screen.getByRole("button", { name: "Tiếp" }));
    await user.click(screen.getByRole("button", { name: "Tạo lịch trình Hà Nội" }));
    await user.click((await screen.findAllByRole("button", { name: "Xem lịch trình" }))[0]);
    expect(screen.getByText("Lịch trình mỗi ngày")).toBeTruthy();
    expect(screen.getByText("Tổng quan ngân sách")).toBeTruthy();
  });
  it("does not show place locking controls", async () => {
    const user = userEvent.setup();
    vi.mocked(generateTrip).mockResolvedValue(result);
    render(<PlannerApp />);
    await reachSubmit(user);
    await user.click(screen.getByRole("button", { name: "Build my Hanoi trip" }));
    await user.click((await screen.findAllByRole("button", { name: "View plan" }))[0]);
    expect(screen.queryByRole("button", { name: "Lock place" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Unlock place" })).toBeNull();
    expect(screen.getByRole("button", { name: "Replace place" })).toBeTruthy();
  });
  it("opens an itinerary from a share link without generating a new trip", async () => {
    window.history.replaceState(null, "", "/?trip=trip-1&option=budget&share=read-secret");
    vi.mocked(fetchTrip).mockResolvedValue(result);
    render(<PlannerApp />);
    await waitFor(() => expect(screen.getByText("Your daily itinerary")).toBeTruthy());
    expect(fetchTrip).toHaveBeenCalledWith("trip-1", "read-secret");
    expect(generateTrip).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Copy share link" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reduce cost" })).toBeNull();
  });

  it("creates a read-only token when sharing a selected plan", async () => {
    const user = userEvent.setup();
    vi.mocked(generateTrip).mockResolvedValue(result);
    vi.mocked(createShareToken).mockResolvedValue("read-secret");
    render(<PlannerApp />);
    await reachSubmit(user);
    await user.click(screen.getByRole("button", { name: "Build my Hanoi trip" }));
    await user.click((await screen.findAllByRole("button", { name: "View plan" }))[0]);
    await user.click(screen.getByRole("button", { name: "Copy share link" }));
    expect(createShareToken).toHaveBeenCalledWith("trip-1", "owner-secret");
    await waitFor(() => expect(
      screen.queryByRole("button", { name: "Link copied" }) ??
      screen.queryByRole("textbox", { name: "Share link" }),
    ).toBeTruthy());
  });
  it("validates the trip form inline", async () => {
    const user = userEvent.setup();
    render(<PlannerApp />);
    await user.clear(screen.getByRole("spinbutton", { name: "Days" }));
    await user.type(screen.getByRole("spinbutton", { name: "Days" }), "0");
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("Step 1 of 4")).toBeTruthy();
  });

  it("accepts a free Hanoi address and offers walking, motorbike, and car", async () => {
    const user = userEvent.setup();
    vi.mocked(generateTrip).mockResolvedValue({ ...result, travelMode: "car" });
    render(<PlannerApp />);
    const start = screen.getByRole("textbox", { name: "Starting point" });
    await user.clear(start);
    await user.type(start, "123 Nguyễn Trãi, Hà Nội");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    const modes = screen.getByRole("combobox", { name: "Travel mode" });
    expect(Array.from((modes as HTMLSelectElement).options).map((option) => option.value)).toEqual([
      "walking", "motorbike", "car",
    ]);
    await user.selectOptions(modes, "car");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Build my Hanoi trip" }));
    await waitFor(() => expect(vi.mocked(generateTrip).mock.calls[0][0]).toEqual(expect.objectContaining({
      startLocationName: "123 Nguyễn Trãi, Hà Nội", travelMode: "car",
    })));
    await user.click((await screen.findAllByRole("button", { name: "View plan" }))[0]);
    const navigate = screen.getByRole("link", { name: "Navigate with Google Maps" });
    expect((navigate as HTMLAnchorElement).href).toContain("destination=21.0287%2C105.8522");
    expect((navigate as HTMLAnchorElement).href).toContain("travelmode=driving");
  });

  it("uses manually pasted coordinates without relying on address lookup", async () => {
    const user = userEvent.setup();
    render(<PlannerApp />);
    await user.click(screen.getByRole("button", { name: "Enter coordinates or Google Maps link" }));
    await user.type(screen.getByRole("textbox", { name: "Coordinates or map link" }),
      "https://www.google.com/maps/@21.034,105.85,15z");
    await user.click(screen.getByRole("button", { name: "Use this starting point" }));
    expect((screen.getByRole("textbox", { name: "Starting point" }) as HTMLInputElement).value)
      .toBe("Manual point 21.03400, 105.85000");
    expect(screen.getByRole("status").textContent).toContain("Manual starting point selected");
  });

  it("shows loading, three recommendations, timeline and budget after submit", async () => {
    const user = userEvent.setup();
    let finish: ((value: TripResponse) => void) | undefined;
    vi.mocked(generateTrip).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    render(<PlannerApp />);
    await reachSubmit(user);
    await user.click(screen.getByRole("button", { name: "Build my Hanoi trip" }));
    expect(screen.getByRole("status")).toBeTruthy();
    expect(generateTrip).toHaveBeenCalledOnce();
    finish?.(result);
    await waitFor(() => expect(screen.getAllByRole("button", { name: "View plan" })).toHaveLength(3));
    expect(screen.getByText("Best Match")).toBeTruthy();
    expect(screen.getByText("Budget Friendly")).toBeTruthy();
    expect(screen.getByText("Explore More")).toBeTruthy();
    await user.click(screen.getAllByRole("button", { name: "View plan" })[0]);
    expect(screen.getByText("Hoan Kiem Lake")).toBeTruthy();
    expect(screen.getByText("Budget summary")).toBeTruthy();
    // Each stop shows its own estimated price and the day shows its total.
    expect(screen.getByText(/Estimated cost: 50\.000 ₫/)).toBeTruthy();
    expect(screen.getByText(/Day cost: 500\.000 ₫/)).toBeTruthy();
    expect(screen.queryByText(/Ride fare/)).toBeNull();
  });

  it("labels free stops, entrance fees and ride fares on the timeline", async () => {
    const user = userEvent.setup();
    const priced = { ...result, travelMode: "car" as const, options: [option("BEST_MATCH", "best"), option("BUDGET_FRIENDLY", "budget"), option("EXPLORE_MORE", "explore")] };
    const stop = priced.options[0].days[0].items[0];
    priced.options[0].days[0].items = [
      { ...stop, estimatedCost: 0, travelCost: 0 },
      { ...stop, id: "best-item-2", sequence: 2, startTime: "10:30", endTime: "11:30", estimatedCost: 140_000, travelCost: 34_000,
        place: { ...stop.place, id: "place-2", slug: "temple", name: "Temple of Literature", category: "history", entranceFee: 70_000 } },
    ];
    vi.mocked(generateTrip).mockResolvedValue(priced);
    render(<PlannerApp />);
    await reachSubmit(user);
    await user.click(screen.getByRole("button", { name: "Build my Hanoi trip" }));
    await user.click((await screen.findAllByRole("button", { name: "View plan" }))[0]);
    expect(screen.getByText(/Estimated cost: Free/)).toBeTruthy();
    expect(screen.getByText(/Estimated cost: 140\.000 ₫/)).toBeTruthy();
    expect(screen.getByText(/Entrance: 70\.000 ₫ \/ per person/)).toBeTruthy();
    expect(screen.getByText(/Ride fare: 34\.000 ₫/)).toBeTruthy();
    expect(screen.queryByText(/Photo credits/)).toBeNull();
    expect(screen.getByRole("img", { name: /Temple of Literature/ })).toBeTruthy();
  });

  it("shows API errors", async () => {
    const user = userEvent.setup();
    vi.mocked(generateTrip).mockRejectedValue(new Error("No feasible itinerary"));
    render(<PlannerApp />);
    await reachSubmit(user);
    await user.click(screen.getByRole("button", { name: "Build my Hanoi trip" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("No feasible itinerary"));
  });

  it("shows practical suggestions when no feasible trip exists", async () => {
    const user = userEvent.setup();
    vi.mocked(generateTrip).mockRejectedValue(new ApiRequestError(
      "NO_FEASIBLE_ITINERARY", "No feasible activities on day 3",
      ["Increase travel radius", "Increase budget"],
    ));
    render(<PlannerApp />);
    await reachSubmit(user);
    await user.click(screen.getByRole("button", { name: "Build my Hanoi trip" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent)
      .toContain("No itinerary fits these constraints."));
    expect(screen.getByRole("alert").textContent).toContain("Increase travel radius");
    expect(screen.getByRole("alert").textContent).toContain("Increase budget");
  });

  it("offers the map picker when free-text lookup is unavailable", async () => {
    const user = userEvent.setup();
    vi.mocked(generateTrip).mockRejectedValue(new ApiRequestError(
      "LOCATION_SERVICE_UNAVAILABLE", "Location lookup is unavailable",
    ));
    render(<PlannerApp />);
    await reachSubmit(user);
    await user.click(screen.getByRole("button", { name: "Build my Hanoi trip" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent)
      .toContain("Address lookup is unavailable. Enter coordinates, paste a map link, or pick on the map."));
    expect(screen.getByRole("alert").querySelector("button")?.textContent)
      .toBe("Enter coordinates or Google Maps link");
  });

  it("replaces a place and reduces cost with refreshed details", async () => {
    const user = userEvent.setup();
    vi.mocked(generateTrip).mockResolvedValue(result);
    const replacementOption = option("BEST_MATCH", "best");
    replacementOption.days[0].items[0].place.name = "New Local Cafe";
    replacementOption.estimatedTotalDistanceKm = 2.8;
    replacementOption.budget.total = 450_000;
    replacementOption.budget.remaining = 2_550_000;
    replacementOption.estimatedTotalCost = 450_000;
    vi.mocked(replacePlace).mockResolvedValue({
      tripId: "trip-1", language: "en", travelMode: "walking",
      seasonalHighlights: [], stayOptions: [],
      options: [replacementOption, result.options[1], result.options[2]],
    });
    const cheaperOption = option("BEST_MATCH", "best");
    cheaperOption.estimatedTotalCost = 400_000;
    cheaperOption.budget.total = 400_000;
    cheaperOption.budget.remaining = 2_600_000;
    vi.mocked(optimizeTrip).mockResolvedValue({
      tripId: "trip-1", language: "en", travelMode: "walking",
      seasonalHighlights: [], stayOptions: [],
      options: [cheaperOption, result.options[1], result.options[2]],
    });
    render(<PlannerApp />);
    await reachSubmit(user);
    await user.click(screen.getByRole("button", { name: "Build my Hanoi trip" }));
    await user.click((await screen.findAllByRole("button", { name: "View plan" }))[0]);
    await user.click(screen.getByRole("button", { name: "Replace place" }));
    await user.click(screen.getByRole("button", { name: "Find replacement" }));
    await waitFor(() => expect(screen.getByText("New Local Cafe")).toBeTruthy());
    expect(replacePlace).toHaveBeenCalledWith("trip-1", "best", "best-item", "TOO_FAR", "owner-secret");
    await waitFor(() => expect((screen.getByRole("button", { name: "Reduce cost" }) as HTMLButtonElement).disabled).toBe(false));
    await user.click(screen.getByRole("button", { name: "Reduce cost" }));
    await waitFor(() => expect(optimizeTrip).toHaveBeenCalledWith("trip-1", "best", "REDUCE_COST", "owner-secret", 1));
    await waitFor(() => expect(screen.getAllByText("400.000 ₫").length).toBeGreaterThan(0));
  });
});

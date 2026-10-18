// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ApiRequestError, fetchTrip } from "@/services/api";
import { addDays, todayInHanoi } from "@/lib/format";
import { renderApp, trip } from "@/test/render";
import { TripsPage } from "./TripsPage";

vi.mock("next/navigation", () => ({
  usePathname: () => "/trips",
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/services/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/api")>()),
  fetchTrip: vi.fn(),
}));

const today = todayInHanoi();

function save(id: string, summary: Record<string, unknown> | null) {
  window.localStorage.setItem(`hanoigo-owner-${id}`, `token-${id}`);
  if (summary) window.localStorage.setItem(`hanoigo-trip-summary-${id}`, JSON.stringify({
    tripId: id, days: 2, travelerCount: 2, budgetTotal: 3_000_000, startName: "Phố cổ", createdAt: "2026-10-18T01:30:00Z", ...summary,
  }));
}

beforeEach(() => {
  save("today", { startDate: today });
  save("soon", { startDate: addDays(today, 10), days: 3 });
  save("old", { startDate: addDays(today, -20) });
  save("undated", { startDate: null });
  save("gone", null); // made before summaries existed: loaded once to build one
  vi.mocked(fetchTrip).mockImplementation(async (id: string) => {
    if (id === "gone") throw new ApiRequestError("TRIP_ACCESS_DENIED", "denied");
    const current = trip({ tripId: id });
    current.options[0].days[0].date = today;
    return current;
  });
});
afterEach(() => { cleanup(); vi.resetAllMocks(); window.localStorage.clear(); });

describe("trips on this device (F22)", () => {
  it("groups trips by date, opens today's itinerary and explains a trip that can no longer be opened", async () => {
    renderApp(<TripsPage />);
    expect(await screen.findByRole("heading", { name: "Hôm nay" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Sắp tới" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Đã qua" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Chưa chọn ngày" })).toBeTruthy();
    expect(screen.getByText("Lập lúc 08:30, 18/10/2026")).toBeTruthy();
    expect(await screen.findByRole("link", { name: "Mở lịch trình hôm nay" })).toBeTruthy();
    expect(await screen.findByText("Không mở được chuyến này nữa.")).toBeTruthy();
    expect(screen.getByText("Chuyến chỉ lưu trên trình duyệt này. Đăng nhập không làm chuyến hiện trên máy khác.")).toBeTruthy();
  });

  it("removes a trip from this device after a confirmation behind the row menu", async () => {
    const user = userEvent.setup();
    renderApp(<TripsPage />);
    const past = (await screen.findByRole("heading", { name: "Đã qua" })).closest("section") as HTMLElement;
    await user.click(within(past).getByRole("button", { name: "Thao tác với chuyến" }));
    await user.click(screen.getByRole("menuitem", { name: "Xoá khỏi máy này" }));
    await user.click(within(past).getByRole("button", { name: "Xoá" }));
    expect(await screen.findByText("Đã xoá chuyến khỏi máy này.")).toBeTruthy();
    await waitFor(() => expect(window.localStorage.getItem("hanoigo-owner-old")).toBeNull());
    expect(screen.queryByRole("heading", { name: "Đã qua" })).toBeNull();
  });

  it("invites planning when there is no trip on this device", async () => {
    window.localStorage.clear();
    renderApp(<TripsPage />);
    expect(await screen.findByText("Chưa có chuyến nào trên máy này.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Lập lịch trình" }).getAttribute("href")).toBe("/plan");
  });
});

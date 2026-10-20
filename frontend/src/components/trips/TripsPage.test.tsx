// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ApiRequestError, deleteMyTrip, fetchMyTrips, fetchTrip } from "@/services/api";
import { addDays, todayInHanoi } from "@/lib/format";
import { renderApp, signInForTest, trip } from "@/test/render";
import { TripsPage } from "./TripsPage";

const router = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/trips",
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/services/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/api")>()),
  fetchTrip: vi.fn(), fetchMyTrips: vi.fn(), deleteMyTrip: vi.fn(),
}));

const today = todayInHanoi();

function summary(id: string, extra: Record<string, unknown>) {
  return { tripId: id, days: 2, travelerCount: 2, budgetTotal: 3_000_000, startName: "Phố cổ", createdAt: "2026-10-18T01:30:00Z", ...extra };
}

beforeEach(() => {
  signInForTest();
  vi.mocked(fetchMyTrips).mockResolvedValue([
    summary("today", { startDate: today }),
    summary("soon", { startDate: addDays(today, 10), days: 3 }),
    summary("old", { startDate: addDays(today, -20) }),
    summary("undated", { startDate: null }),
    summary("gone", { startDate: today }),
  ] as Awaited<ReturnType<typeof fetchMyTrips>>);
  vi.mocked(deleteMyTrip).mockResolvedValue();
  vi.mocked(fetchTrip).mockImplementation(async (id: string) => {
    if (id === "gone") throw new ApiRequestError("NOT_FOUND", "gone");
    const current = trip({ tripId: id });
    current.options[0].days[0].date = today;
    return current;
  });
});
afterEach(() => { cleanup(); vi.resetAllMocks(); window.localStorage.clear(); });

describe("trips in the account (F22)", () => {
  it("sends a signed-out visitor to the Account page", async () => {
    window.localStorage.clear();
    window.history.replaceState(null, "", "/trips");
    renderApp(<TripsPage />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/account?next=%2Ftrips"));
    expect(fetchMyTrips).not.toHaveBeenCalled();
  });

  it("groups trips by date, opens today's itinerary and explains a trip that can no longer be opened", async () => {
    renderApp(<TripsPage />);
    expect(await screen.findByRole("heading", { name: "Hôm nay" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Sắp tới" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Đã qua" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Chưa chọn ngày" })).toBeTruthy();
    expect(screen.getByText("Lập lúc 08:30, 18/10/2026")).toBeTruthy();
    expect(await screen.findByRole("link", { name: "Mở lịch trình hôm nay" })).toBeTruthy();
    expect(await screen.findByText("Không mở được chuyến này nữa.")).toBeTruthy();
    expect(screen.getByText("Chuyến đi được lưu theo tài khoản; đăng nhập trên bất kỳ thiết bị nào để xem.")).toBeTruthy();
    expect(fetchMyTrips).toHaveBeenCalledWith("account-token");
  });

  it("removes a trip from the account after a confirmation behind the row menu", async () => {
    const user = userEvent.setup();
    renderApp(<TripsPage />);
    const past = (await screen.findByRole("heading", { name: "Đã qua" })).closest("section") as HTMLElement;
    await user.click(within(past).getByRole("button", { name: "Thao tác với chuyến" }));
    await user.click(screen.getByRole("menuitem", { name: "Xoá khỏi tài khoản" }));
    // The account's list after the removal.
    vi.mocked(fetchMyTrips).mockResolvedValue([]);
    await user.click(within(past).getByRole("button", { name: "Xoá" }));
    expect(await screen.findByText("Đã xoá chuyến khỏi tài khoản.")).toBeTruthy();
    expect(deleteMyTrip).toHaveBeenCalledWith("account-token", "old");
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Đã qua" })).toBeNull());
  });

  it("invites planning when the account has no trip", async () => {
    vi.mocked(fetchMyTrips).mockResolvedValue([]);
    renderApp(<TripsPage />);
    expect(await screen.findByText("Tài khoản của bạn chưa có chuyến đi nào.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Lập lịch trình" }).getAttribute("href")).toBe("/plan");
  });
});

// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ApiRequestError, generateTrip } from "@/services/api";
import { renderApp, signInForTest, trip } from "@/test/render";
import { PlanFlow } from "./PlanFlow";

const navigation = vi.hoisted(() => ({
  params: new URLSearchParams("step=1"),
  push: vi.fn(), replace: vi.fn(), back: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigation.push, replace: navigation.replace, back: navigation.back }),
  useSearchParams: () => navigation.params,
  usePathname: () => "/plan",
}));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("@/services/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/api")>()),
  generateTrip: vi.fn(),
}));

/** Step changes go through the URL (History API); mirror them into the mocked params. */
function followSteps(rerender: () => void) {
  return vi.spyOn(window.history, "pushState").mockImplementation((_state, _title, url) => {
    navigation.params = new URLSearchParams(String(url).split("?")[1]);
    rerender();
  });
}

beforeEach(() => { navigation.params = new URLSearchParams("step=1"); signInForTest(); });
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.restoreAllMocks(); window.sessionStorage.clear(); window.localStorage.clear(); });

async function renderFlow() {
  const view = renderApp(<PlanFlow />);
  const steps = followSteps(() => view.rerender(<PlanFlow />));
  return { ...view, steps };
}

describe("plan flow", () => {
  it("sends a signed-out visitor to the Account page and back afterwards", async () => {
    window.localStorage.clear();
    window.history.replaceState(null, "", "/plan?step=1&days=4");
    renderApp(<PlanFlow />);
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith(`/account?next=${encodeURIComponent("/plan?step=1&days=4")}`));
    expect(screen.queryByLabelText("Số ngày")).toBeNull();
  });

  it("saves the new trip to the signed-in account", async () => {
    const user = userEvent.setup();
    navigation.params = new URLSearchParams("step=4&startName=Ph%E1%BB%91%20c%E1%BB%95&startLat=21.034&startLng=105.85");
    vi.mocked(generateTrip).mockResolvedValue(trip({ ownerToken: "owner" }));
    await renderFlow();
    await user.click(screen.getByRole("button", { name: "Lập lịch trình" }));
    await waitFor(() => expect(generateTrip).toHaveBeenCalled());
    expect(vi.mocked(generateTrip).mock.calls[0][2]).toBe("account-token");
  });

  it("starts with the spec defaults and the per-person estimate", async () => {
    await renderFlow();
    expect(screen.getByRole("heading", { name: "Chuyến đi" })).toBeTruthy();
    expect((screen.getByLabelText("Số ngày") as HTMLInputElement).value).toBe("3");
    expect((screen.getByLabelText("Số người") as HTMLInputElement).value).toBe("2");
    expect((screen.getByLabelText("Ngân sách cả chuyến") as HTMLInputElement).value).toBe("3.000.000");
    expect(screen.getByText(/mỗi người mỗi ngày/)).toBeTruthy();
    expect(screen.getByText("Bước 1/4")).toBeTruthy();
  });

  it("checks only the current step and keeps the step in the URL", async () => {
    const user = userEvent.setup();
    navigation.params = new URLSearchParams("step=2");
    const { steps } = await renderFlow();
    await user.click(screen.getByRole("button", { name: "Tiếp tục" }));
    expect(await screen.findByText("Nhập địa chỉ hoặc tên địa điểm ở Hà Nội")).toBeTruthy();
    expect(steps).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Hồ Hoàn Kiếm" }));
    await user.click(screen.getByRole("button", { name: "Tiếp tục" }));
    await waitFor(() => expect(steps).toHaveBeenCalledWith({ hanoigoPlanDepth: 1 }, "", "/plan?step=3"));
    expect(screen.getByText("Bước 3/4")).toBeTruthy();
  });

  it("Continue on step 3 opens step 4 without sending the request", async () => {
    const user = userEvent.setup();
    navigation.params = new URLSearchParams("step=3&startName=X%20Y%20Z&startLat=21.03&startLng=105.85");
    await renderFlow();
    await user.click(screen.getByRole("button", { name: "Tiếp tục" }));
    expect(await screen.findByText("Bước 4/4")).toBeTruthy();
    expect(generateTrip).not.toHaveBeenCalled();
  });

  it("prefills from the URL and sends the trip request", async () => {
    const user = userEvent.setup();
    navigation.params = new URLSearchParams("step=4&days=2&people=4&budget=5000000&startName=V%C4%83n%20Mi%E1%BA%BFu&startLat=21.0293&startLng=105.8355");
    vi.mocked(generateTrip).mockResolvedValue(trip({ ownerToken: "owner" }));
    await renderFlow();
    expect(screen.getByText("2 ngày, 4 người")).toBeTruthy();
    expect(screen.getByText("5.000.000 đ")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Lập lịch trình" }));
    await waitFor(() => expect(generateTrip).toHaveBeenCalled());
    expect(vi.mocked(generateTrip).mock.calls[0][0]).toMatchObject({
      days: 2, travelerCount: 4, budgetTotal: 5_000_000, language: "vi",
      startLocationName: "Văn Miếu", startLocationCoordinates: { latitude: 21.0293, longitude: 105.8355 },
    });
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/trips/trip-1"));
    expect(window.localStorage.getItem("hanoigo-owner-trip-1")).toBe("owner");
    expect(JSON.parse(window.localStorage.getItem("hanoigo-trip-summary-trip-1") ?? "{}")).toMatchObject({ days: 2, travelerCount: 4 });
  });

  it("sends address errors back to step 2 with a way forward", async () => {
    const user = userEvent.setup();
    navigation.params = new URLSearchParams("step=4&startName=123%20Ph%E1%BB%91%20Hu%E1%BA%BF&startLat=21&startLng=105.85");
    vi.mocked(generateTrip).mockRejectedValue(new ApiRequestError("LOCATION_NOT_FOUND", "not found"));
    const { steps } = await renderFlow();
    await user.click(screen.getByRole("button", { name: "Lập lịch trình" }));
    await waitFor(() => expect(steps).toHaveBeenCalledWith({ hanoigoPlanDepth: 1 }, "", "/plan?step=2"));
    expect(await screen.findByText(/Không tìm thấy địa chỉ này ở Hà Nội/)).toBeTruthy();
  });

  it("locks the submit button after RATE_LIMITED", async () => {
    const user = userEvent.setup();
    navigation.params = new URLSearchParams("step=4&startName=X%20Y%20Z&startLat=21.03&startLng=105.85");
    vi.mocked(generateTrip).mockRejectedValue(new ApiRequestError("RATE_LIMITED", "slow down"));
    await renderFlow();
    await user.click(screen.getByRole("button", { name: "Lập lịch trình" }));
    expect(await screen.findByText(/Bạn vừa lập nhiều lịch trình/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Lập lịch trình" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("explains an infeasible request with the API's suggestions", async () => {
    const user = userEvent.setup();
    navigation.params = new URLSearchParams("step=4&startName=X%20Y%20Z&startLat=21.03&startLng=105.85");
    vi.mocked(generateTrip).mockRejectedValue(new ApiRequestError("NO_FEASIBLE_ITINERARY", "none", ["Increase budget"]));
    await renderFlow();
    await user.click(screen.getByRole("button", { name: "Lập lịch trình" }));
    expect(await screen.findByRole("heading", { name: "Chưa xếp được lịch trình nào khớp mọi điều kiện." })).toBeTruthy();
    expect(screen.getByText("Tăng ngân sách")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sửa yêu cầu" })).toBeTruthy();
  });
});

// These type whole links key by key; on a busy machine that outlasts the 5 s default.
const TYPING_TIMEOUT = 15_000;

describe("starting point (F03, F04)", () => {
  it("reads typed coordinates and Google Maps links, so no address lookup is needed", async () => {
    const user = userEvent.setup();
    navigation.params = new URLSearchParams("step=2");
    vi.mocked(generateTrip).mockResolvedValue(trip({ ownerToken: "owner" }));
    await renderFlow();
    const input = screen.getByRole("textbox", { name: "Điểm xuất phát" }) as HTMLInputElement;
    await user.type(input, "21.03, 105.85");
    await user.tab();
    expect(await screen.findByText(/Đã đặt điểm/)).toBeTruthy();
    await user.clear(input);
    await user.type(input, "https://www.google.com/maps/@21.0285,105.8542,15z");
    await user.tab();
    expect(input.value).toBe("Điểm nhập tay 21.02850, 105.85420");
    await user.click(screen.getByRole("button", { name: "Tiếp tục" }));
    await user.click(await screen.findByRole("button", { name: "Tiếp tục" }));
    await user.click(await screen.findByRole("button", { name: "Lập lịch trình" }));
    await waitFor(() => expect(generateTrip).toHaveBeenCalled());
    expect(vi.mocked(generateTrip).mock.calls[0][0].startLocationCoordinates).toEqual({ latitude: 21.0285, longitude: 105.8542 });
  }, TYPING_TIMEOUT);

  it("says when a pasted link has no Hanoi coordinates", async () => {
    const user = userEvent.setup();
    navigation.params = new URLSearchParams("step=2");
    await renderFlow();
    await user.type(screen.getByRole("textbox", { name: "Điểm xuất phát" }), "https://maps.app.goo.gl/abc");
    await user.tab();
    expect(await screen.findByText("Nhập tọa độ Hà Nội như 21.034, 105.850 hoặc liên kết Google Maps có chứa tọa độ.")).toBeTruthy();
  }, TYPING_TIMEOUT);

  it("uses the device location only when asked", async () => {
    const user = userEvent.setup();
    navigation.params = new URLSearchParams("step=2");
    const getCurrentPosition = vi.fn((success: PositionCallback) => success({ coords: { latitude: 21.03, longitude: 105.85 } } as GeolocationPosition));
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition } });
    await renderFlow();
    expect(getCurrentPosition).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Dùng vị trí hiện tại" }));
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/Đã đặt điểm/)).toBeTruthy();
  });

  it("sends a lookup outage back to step 2 with the recovery copy", async () => {
    const user = userEvent.setup();
    navigation.params = new URLSearchParams("step=4&startName=123%20Ph%E1%BB%91%20Hu%E1%BA%BF&startLat=21&startLng=105.85");
    vi.mocked(generateTrip).mockRejectedValue(new ApiRequestError("LOCATION_SERVICE_UNAVAILABLE", "down"));
    const { steps } = await renderFlow();
    await user.click(screen.getByRole("button", { name: "Lập lịch trình" }));
    await waitFor(() => expect(steps).toHaveBeenCalledWith({ hanoigoPlanDepth: 1 }, "", "/plan?step=2"));
    expect(await screen.findByText("Dịch vụ tra địa chỉ đang không phản hồi. Bạn vẫn có thể chọn trên bản đồ hoặc dùng vị trí hiện tại.")).toBeTruthy();
  });
});

describe("getting around (F05, F06, F07, F08)", () => {
  it("offers 5, 15 and 30 km, and warns about the walking limit only beyond 10 km", async () => {
    const user = userEvent.setup();
    navigation.params = new URLSearchParams("step=3");
    await renderFlow();
    expect(screen.getByRole("radio", { name: /^5 km/ })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /^15 km/ })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /^30 km/ })).toBeTruthy();
    expect(screen.queryByRole("radio", { name: /80 km/ })).toBeNull();
    const warning = "Đi bộ chỉ tìm trong 10 km và tối đa 10 km mỗi ngày. Chọn xe máy hoặc ô tô để đi xa hơn.";
    expect(screen.getByText(warning)).toBeTruthy();
    await user.click(screen.getByRole("radio", { name: /^5 km/ }));
    expect(screen.queryByText(warning)).toBeNull();
    await user.click(screen.getByRole("radio", { name: /^30 km/ }));
    await user.click(screen.getByRole("radio", { name: /Xe máy/ }));
    expect(screen.queryByText(warning)).toBeNull();
  });

  it("always shows the daily hours and sends the ones chosen", async () => {
    const user = userEvent.setup();
    navigation.params = new URLSearchParams("step=3&startName=X%20Y%20Z&startLat=21.03&startLng=105.85");
    vi.mocked(generateTrip).mockResolvedValue(trip({ ownerToken: "owner" }));
    await renderFlow();
    await user.selectOptions(screen.getByLabelText("Bắt đầu mỗi ngày"), "09:00");
    await user.selectOptions(screen.getByLabelText("Kết thúc mỗi ngày"), "18:30");
    await user.click(screen.getByRole("radio", { name: "năng động" }));
    await user.click(screen.getByRole("button", { name: "Tiếp tục" }));
    expect(await screen.findByText(/Mỗi ngày 09:00–18:30/)).toBeTruthy();
    await user.click(await screen.findByRole("button", { name: "Lập lịch trình" }));
    await waitFor(() => expect(generateTrip).toHaveBeenCalled());
    expect(vi.mocked(generateTrip).mock.calls[0][0]).toMatchObject({
      dailyStartTime: "09:00", dailyEndTime: "18:30", pace: "active",
    });
  });

  it("refuses a day that ends before it starts", async () => {
    const user = userEvent.setup();
    navigation.params = new URLSearchParams("step=3&startName=X%20Y%20Z&startLat=21.03&startLng=105.85");
    await renderFlow();
    await user.selectOptions(screen.getByLabelText("Bắt đầu mỗi ngày"), "19:00");
    await user.selectOptions(screen.getByLabelText("Kết thúc mỗi ngày"), "10:00");
    await user.click(screen.getByRole("button", { name: "Tiếp tục" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(generateTrip).not.toHaveBeenCalled();
  });
});


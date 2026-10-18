// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createShareToken, fetchTrip, fetchWeather, optimizeTrip, replacePlace } from "@/services/api";
import { option, place, renderApp, trip } from "@/test/render";
import { TripCompare } from "./TripCompare";
import { TripItinerary } from "./TripItinerary";
import { HolidayBand } from "./Timeline";

const navigation = vi.hoisted(() => ({ params: new URLSearchParams(), push: vi.fn(), replace: vi.fn(), back: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigation.push, replace: navigation.replace, back: navigation.back }),
  useSearchParams: () => navigation.params,
  usePathname: () => "/trips/trip-1",
}));
vi.mock("@/components/map/RouteMap", () => ({ default: () => <div data-testid="route-map" /> }));
vi.mock("@/services/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/api")>()),
  fetchTrip: vi.fn(), replacePlace: vi.fn(), optimizeTrip: vi.fn(), createShareToken: vi.fn(), fetchWeather: vi.fn(),
}));

beforeEach(() => {
  navigation.params = new URLSearchParams();
  window.localStorage.setItem("hanoigo-owner-trip-1", "owner-token");
  vi.mocked(fetchWeather).mockResolvedValue({ date: "2026-10-18", available: false, afternoonRainProbability: null, warning: null });
});
afterEach(() => { cleanup(); vi.resetAllMocks(); window.localStorage.clear(); window.sessionStorage.clear(); });

describe("compare options", () => {
  it("shows three options with client-side badges and the budget share", async () => {
    vi.mocked(fetchTrip).mockResolvedValue(trip());
    renderApp(<TripCompare tripId="trip-1" />);
    expect(await screen.findByRole("heading", { name: "Phù hợp nhất" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Tiết kiệm" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Khám phá nhiều hơn" })).toBeTruthy();
    expect(screen.getByText("Rẻ nhất")).toBeTruthy();
    expect(screen.getAllByText("95% ngân sách").length).toBeGreaterThan(0);
    expect(fetchTrip).toHaveBeenCalledWith("trip-1", "owner-token");
    const links = screen.getAllByRole("link", { name: "Xem lịch trình" });
    expect(links[0].getAttribute("href")).toBe("/trips/trip-1/best");
    expect(links[0].className).toContain("bg-sign-red");
    expect(links[1].className).not.toContain("bg-sign-red");
  });

  it("warns next to the meter when the budget target is not met", async () => {
    vi.mocked(fetchTrip).mockResolvedValue(trip({ options: [
      option("BEST_MATCH", "best", { budgetTargetMet: false }), option("BUDGET_FRIENDLY", "b"), option("EXPLORE_MORE", "e"),
    ] }));
    renderApp(<TripCompare tripId="trip-1" />);
    expect(await screen.findByText(/chưa dùng tới mức/)).toBeTruthy();
    expect(screen.getByText(/Đổi sang xe máy hoặc ô tô/)).toBeTruthy();
  });

  it("opens a shared trip read-only with the share token", async () => {
    navigation.params = new URLSearchParams("share=share-token");
    vi.mocked(fetchTrip).mockResolvedValue(trip());
    renderApp(<TripCompare tripId="trip-1" />);
    expect(await screen.findByText("Bạn đang xem lịch trình được chia sẻ.")).toBeTruthy();
    expect(fetchTrip).toHaveBeenCalledWith("trip-1", "share-token");
    expect(screen.queryByRole("button", { name: "Sửa yêu cầu" })).toBeNull();
    expect(screen.getAllByRole("link", { name: "Xem lịch trình" })[0].getAttribute("href")).toBe("/trips/trip-1/best?share=share-token");
  });

  it("explains an expired share link", async () => {
    const { ApiRequestError } = await import("@/services/api");
    navigation.params = new URLSearchParams("share=old");
    vi.mocked(fetchTrip).mockRejectedValue(new ApiRequestError("TRIP_ACCESS_DENIED", "denied"));
    renderApp(<TripCompare tripId="trip-1" />);
    expect(await screen.findByText("Liên kết này không còn mở được.")).toBeTruthy();
  });
});

describe("itinerary", () => {
  it("lists each stop with time, must-see, costs, ticket and story link", async () => {
    vi.mocked(fetchTrip).mockResolvedValue(trip());
    renderApp(<TripItinerary tripId="trip-1" optionId="best" />);
    const stop = (await screen.findByText("Văn Miếu")).closest("[id^='stop-']") as HTMLElement;
    expect(within(stop).getByText("08:12")).toBeTruthy();
    expect(within(stop).getByText("Phải ghé")).toBeTruthy();
    expect(within(stop).getByText(/60\.000 đ cả nhóm/)).toBeTruthy();
    expect(within(stop).getByText(/30\.000 đ mỗi người/)).toBeTruthy();
    expect(within(stop).getByRole("link", { name: /Câu chuyện/ }).getAttribute("href")).toBe("/stories/van-mieu-quoc-tu-giam");
    // The second stop stays longer than usual: say so, from data only.
    expect(screen.getByText("Ở lâu hơn để kịp giờ mở cửa của điểm sau")).toBeTruthy();
    expect(screen.getByText("Quãng đường, thời gian và cước là ước tính theo đường thẳng.")).toBeTruthy();
    // On a phone the map is its own tab.
    expect(screen.queryByTestId("route-map")).toBeNull();
  });

  it("shows the map on the map tab, with the day and view kept in the URL", async () => {
    const user = userEvent.setup();
    navigation.params = new URLSearchParams("day=1&view=map");
    vi.mocked(fetchTrip).mockResolvedValue(trip());
    renderApp(<TripItinerary tripId="trip-1" optionId="best" />);
    expect(await screen.findByTestId("route-map")).toBeTruthy();
    expect(screen.getByRole("list", { name: "Điểm dừng" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Chi phí" }));
    expect(navigation.push).toHaveBeenCalledWith("/trips/trip-1/best?day=1&view=budget", { scroll: false });
  });

  it("replaces a place and reports the day's cost change", async () => {
    const user = userEvent.setup();
    const before = trip();
    const replaced = trip();
    replaced.options[0] = option("BEST_MATCH", "best");
    replaced.options[0].days[0].estimatedCost = 2_800_000;
    replaced.options[0].days[0].items[1] = { ...replaced.options[0].days[0].items[1], id: "best-c", place: place({ id: "place-3", name: "Hồ Tây" }) };
    vi.mocked(fetchTrip).mockResolvedValue(before);
    vi.mocked(replacePlace).mockResolvedValue(replaced);
    renderApp(<TripItinerary tripId="trip-1" optionId="best" />);
    await user.click(await screen.findByRole("button", { name: /2\. Chùa Một Cột/ }));
    await user.click(await screen.findByRole("button", { name: "Thay địa điểm" }));
    const sheet = await screen.findByRole("dialog");
    await user.click(within(sheet).getByRole("radio", { name: "Quá đắt" }));
    await user.click(within(sheet).getByRole("button", { name: "Thay địa điểm" }));
    await waitFor(() => expect(replacePlace).toHaveBeenCalledWith("trip-1", "best", "best-b", "TOO_EXPENSIVE", "owner-token"));
    expect(await screen.findByText(/Đã thay Chùa Một Cột bằng Hồ Tây\. Chi phí ngày giảm 50\.000 đ\./)).toBeTruthy();
    expect(screen.getByText("Hồ Tây")).toBeTruthy();
  });

  it("re-optimizes with an existing strategy and says when nothing changed", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchTrip).mockResolvedValue(trip());
    vi.mocked(optimizeTrip).mockResolvedValue(trip());
    renderApp(<TripItinerary tripId="trip-1" optionId="best" />);
    await screen.findByText("Văn Miếu");
    await user.click(screen.getAllByRole("button", { name: "Tối ưu lại" }).at(-1)!);
    const sheet = await screen.findByRole("dialog");
    await user.click(within(sheet).getByRole("radio", { name: /Giảm chi phí/ }));
    await user.click(within(sheet).getByRole("button", { name: "Tối ưu lại" }));
    await waitFor(() => expect(optimizeTrip).toHaveBeenCalledWith("trip-1", "best", "REDUCE_COST", "owner-token", 1));
    expect(await screen.findByText("Lịch trình đã tối ưu theo cách này, không đổi gì thêm.")).toBeTruthy();
  });

  it("creates a share link once and keeps it on this device", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchTrip).mockResolvedValue(trip());
    vi.mocked(createShareToken).mockResolvedValue("new-share");
    renderApp(<TripItinerary tripId="trip-1" optionId="best" />);
    await screen.findByText("Văn Miếu");
    await user.click(screen.getAllByRole("button", { name: "Chia sẻ" })[0]);
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByText(/liên kết cũ sẽ không mở được nữa/)).toBeTruthy();
    await user.click(within(sheet).getByRole("button", { name: "Tạo liên kết chia sẻ" }));
    const field = await within(sheet).findByRole("textbox", { name: "Liên kết chia sẻ" }) as HTMLInputElement;
    expect(field.value).toContain("/trips/trip-1/best?share=new-share");
    expect(window.localStorage.getItem("hanoigo-share-trip-1")).toContain("share=new-share");
  });

  it("hides editing in read-only mode", async () => {
    navigation.params = new URLSearchParams("share=share-token");
    vi.mocked(fetchTrip).mockResolvedValue(trip());
    renderApp(<TripItinerary tripId="trip-1" optionId="best" />);
    await screen.findByText("Văn Miếu");
    expect(screen.queryByRole("button", { name: "Tối ưu lại" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Chia sẻ" })).toBeNull();
    expect(screen.queryByRole("button", { name: /khoá|Lock/i })).toBeNull();
  });
});

describe("holiday band", () => {
  const holiday = (relatedPlaces: ReturnType<typeof place>[]) => ({
    key: "teachers-day", name: "Ngày Nhà giáo Việt Nam", kind: "observance" as const, isPublicHoliday: false,
    startDate: "2026-11-20", endDate: "2026-11-20", tripDates: ["2026-11-20"],
    description: "", suggestion: "Tham quan Văn Miếu buổi sáng sớm.", relatedPlaces,
  });

  it("offers the places that host the holiday, with directions and stories, only when the API names them (F13, F25)", async () => {
    const user = userEvent.setup();
    const story = { slug: "van-mieu-quoc-tu-giam", title: "Văn Miếu – Quốc Tử Giám", teaser: "Dựng năm 1070.", readingMinutes: 3 };
    renderApp(<HolidayBand mode="motorbike" holiday={holiday([place({ id: "van-mieu", name: "Văn Miếu", story })])} />);
    const toggle = screen.getByRole("button", { name: "Xem nơi tổ chức" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    await user.click(toggle);
    expect(screen.getByRole("link", { name: "Văn Miếu" }).getAttribute("href")).toBe("/places/van-mieu?from=trips&mode=motorbike");
    expect(screen.getByRole("link", { name: "Chỉ đường" }).getAttribute("href")).toContain("travelmode=two-wheeler");
    expect(screen.getByRole("link", { name: "Văn Miếu – Quốc Tử Giám" }).getAttribute("href")).toBe("/stories/van-mieu-quoc-tu-giam");
    expect(screen.getByText("Dựng năm 1070.")).toBeTruthy();
    expect(screen.getByText("3 phút đọc")).toBeTruthy();
    cleanup();
    renderApp(<HolidayBand mode="walking" holiday={holiday([])} />);
    expect(screen.queryByRole("button", { name: "Xem nơi tổ chức" })).toBeNull();
  });
});

describe("itinerary details", () => {
  it("shows the ride fare on legs for motorbike trips, not for walking (F05)", async () => {
    const riding = trip({ travelMode: "motorbike" });
    riding.options[0].days[0].items[1] = { ...riding.options[0].days[0].items[1], travelCost: 25_000 };
    vi.mocked(fetchTrip).mockResolvedValue(riding);
    renderApp(<TripItinerary tripId="trip-1" optionId="best" />);
    expect(await screen.findByText("25.000 đ")).toBeTruthy();
    cleanup();
    vi.mocked(fetchTrip).mockResolvedValue(trip());
    renderApp(<TripItinerary tripId="trip-1" optionId="best" />);
    await screen.findByText("Chùa Một Cột");
    expect(screen.queryByText("25.000 đ")).toBeNull();
  });

  it("marks the budget target in the header and explains it on the cost tab (F10)", async () => {
    const missed = trip();
    missed.options[0] = option("BEST_MATCH", "best", { budgetTargetMet: false });
    vi.mocked(fetchTrip).mockResolvedValue(missed);
    navigation.params = new URLSearchParams("view=budget");
    renderApp(<TripItinerary tripId="trip-1" optionId="best" />);
    expect(await screen.findByText("Mục tiêu: 95% ngân sách, chưa đạt")).toBeTruthy();
    expect(screen.getByText("Phương án này nhắm dùng ít nhất 95% ngân sách.")).toBeTruthy();
    expect(screen.getByText(/chưa dùng tới mức/)).toBeTruthy();
  });

  it("lists stays with their kind, nightly price, directions and story (F14, F25, F34)", async () => {
    const story = { slug: "nha-hat-lon-ha-noi", title: "Nhà hát Lớn Hà Nội", teaser: "Khánh thành năm 1911.", readingMinutes: 4 };
    vi.mocked(fetchTrip).mockResolvedValue(trip({ stayOptions: [place({ id: "stay-1", name: "Khách sạn Phố Cổ", category: "accommodation", averageCost: 800_000, story })] }));
    navigation.params = new URLSearchParams("view=stays");
    renderApp(<TripItinerary tripId="trip-1" optionId="best" />);
    const stay = (await screen.findByText("Khách sạn Phố Cổ")).closest("li") as HTMLElement;
    expect(within(stay).getByText("Lưu trú")).toBeTruthy();
    expect(screen.getByText(/800\.000 đ mỗi đêm/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Chỉ đường" }).getAttribute("href")).toContain("travelmode=walking");
    expect(screen.getByRole("link", { name: "Nhà hát Lớn Hà Nội" }).getAttribute("href")).toBe("/stories/nha-hat-lon-ha-noi");
  });

  it("shows the weather only on the day the API has a forecast for (F30)", async () => {
    vi.mocked(fetchWeather).mockResolvedValue({ date: "2026-10-18", available: true, afternoonRainProbability: 0.7, warning: null });
    vi.mocked(fetchTrip).mockResolvedValue(trip());
    renderApp(<TripItinerary tripId="trip-1" optionId="best" />);
    const day = await screen.findByRole("button", { name: /^Ngày 1/ });
    await waitFor(() => expect(within(day).getByText("Chiều nhiều khả năng mưa (70%)")).toBeTruthy());
  });
});

describe("compare page extras", () => {
  it("lists holidays and seasonal events for the trip dates with stories, yearly note, event link and directions (F36, F34)", async () => {
    const story = { slug: "van-mieu-quoc-tu-giam", title: "Văn Miếu – Quốc Tử Giám", teaser: "", readingMinutes: 3 };
    vi.mocked(fetchTrip).mockResolvedValue(trip({
      holidays: [{ key: "vu-lan", name: "Lễ Vu Lan", kind: "traditional", isPublicHoliday: false, startDate: "2026-10-18", endDate: "2026-10-18",
        tripDates: ["2026-10-18"], description: "", suggestion: "", relatedPlaces: [place({ story })] }],
      seasonalHighlights: [{ date: "2026-10-18", place: place({ id: "fest", name: "Lễ hội hoa cúc", annual: true, informationSource: "https://example.com/hoa-cuc" }) }],
    }));
    renderApp(<TripCompare tripId="trip-1" />);
    expect(await screen.findByRole("heading", { name: "Trong những ngày bạn đi" })).toBeTruthy();
    expect(screen.getByText("Lễ Vu Lan")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Đọc chuyện" }).getAttribute("href")).toBe("/stories/van-mieu-quoc-tu-giam");
    expect(screen.getByText("Lễ hội hoa cúc")).toBeTruthy();
    expect(screen.getByText("Lặp lại quanh ngày này hằng năm")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Thông tin hoạt động" }).getAttribute("href")).toBe("https://example.com/hoa-cuc");
    expect(screen.getByRole("link", { name: "Chỉ đường" })).toBeTruthy();
  });

  it("shows how well each option matches and the money left (F34)", async () => {
    vi.mocked(fetchTrip).mockResolvedValue(trip());
    renderApp(<TripCompare tripId="trip-1" />);
    expect((await screen.findAllByText("90% phù hợp")).length).toBe(3);
    expect(screen.getAllByText("Còn lại 150.000 đ").length).toBe(3);
  });

  it("says so when a trip has no options (F33)", async () => {
    vi.mocked(fetchTrip).mockResolvedValue(trip({ options: [] }));
    renderApp(<TripCompare tripId="trip-1" />);
    expect(await screen.findByText("Chuyến này chưa có phương án lịch trình nào.")).toBeTruthy();
  });
});

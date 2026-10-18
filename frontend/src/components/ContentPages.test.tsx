// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { fetchHolidays, fetchPlace, fetchStories, fetchStory, loginAccount, submitPlaceReview } from "@/services/api";
import type { Holiday, StoryDetail } from "@/types/trip";
import { place, renderApp } from "@/test/render";
import { todayInHanoi } from "@/lib/format";
import { StoriesPage } from "./stories/StoriesPage";
import { StoryReaderPage } from "./stories/StoryReaderPage";
import { FestivalsPage } from "./festivals/FestivalsPage";
import { PlacePage } from "./places/PlacePage";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/services/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/api")>()),
  fetchStories: vi.fn(), fetchStory: vi.fn(), fetchHolidays: vi.fn(), fetchPlace: vi.fn(),
  submitPlaceReview: vi.fn(), loginAccount: vi.fn(),
}));
afterEach(() => { cleanup(); vi.resetAllMocks(); window.localStorage.clear(); });

const story: StoryDetail = {
  slug: "van-mieu-quoc-tu-giam", title: "Văn Miếu – Quốc Tử Giám: nơi khởi đầu nền giáo dục", teaser: "Dựng năm 1070.",
  imageKey: "history", readingMinutes: 3, themes: ["history"], featured: true,
  sections: [{ heading: "Từ ngôi miếu đến trường học", body: "Năm 1070.\n\nNăm 1076." }, { heading: "82 tấm bia", body: "Bia tiến sĩ." }],
  timeline: [{ year: "1070", text: "Dựng Văn Miếu." }], tips: ["Ăn mặc lịch sự."],
  sources: [{ title: "Wikipedia", url: "https://vi.wikipedia.org/wiki/V%C4%83n_Mi%E1%BA%BFu" }],
  place: place(), nearby: [{ slug: "chua-mot-cot", title: "Chùa Một Cột", teaser: "", imageKey: null, readingMinutes: 2, themes: [], featured: false, distanceKm: 0.9 }],
};

describe("stories", () => {
  it("lists featured stories with photo credits and text-only stories", async () => {
    vi.mocked(fetchStories).mockResolvedValue([
      { ...story, featured: true },
      { slug: "den-quan-thanh", title: "Đền Quán Thánh", teaser: "", imageKey: null, readingMinutes: 2, themes: [], featured: false },
    ]);
    renderApp(<StoriesPage />);
    expect(await screen.findByRole("heading", { name: story.title })).toBeTruthy();
    expect(screen.getByText(/Daderot/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Đền Quán Thánh/ }).getAttribute("href")).toBe("/stories/den-quan-thanh");
    expect(screen.getByRole("link", { name: "Ghi công ảnh" }).getAttribute("href")).toBe("/credits");
  });

  it("reads a story with the landmark as a sign, sources and plan-from-here", async () => {
    vi.mocked(fetchStory).mockResolvedValue(story);
    renderApp(<StoryReaderPage slug="van-mieu-quoc-tu-giam" />);
    expect(await screen.findByRole("heading", { level: 1, name: "Văn Miếu – Quốc Tử Giám" })).toBeTruthy();
    expect(screen.getByText("Nơi khởi đầu nền giáo dục")).toBeTruthy();
    expect(screen.getByText("Năm 1076.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Wikipedia" }).getAttribute("target")).toBe("_blank");
    const plan = screen.getAllByRole("link", { name: "Lập lịch từ đây" })[0].getAttribute("href") ?? "";
    expect(plan).toContain("/plan?step=2");
    expect(plan).toContain("startLat=21.0293");
    expect(screen.getByRole("link", { name: /Chùa Một Cột/ }).getAttribute("href")).toBe("/stories/chua-mot-cot");
    await waitFor(() => expect(window.localStorage.getItem("hanoigo-read-stories")).toContain("van-mieu-quoc-tu-giam"));
  });
});

describe("festivals", () => {
  it("groups festivals by month, marks the one happening now and plans for its dates", async () => {
    const today = todayInHanoi();
    const holiday: Holiday = { key: "now", name: "Lễ đang diễn ra", kind: "festival", isPublicHoliday: false,
      startDate: today, endDate: today, tripDates: [], description: "Mô tả.", suggestion: "Gợi ý.", relatedPlaces: [place()] };
    vi.mocked(fetchHolidays).mockResolvedValue([holiday]);
    renderApp(<FestivalsPage />);
    const item = (await screen.findByRole("heading", { name: "Lễ đang diễn ra" })).closest("li") as HTMLElement;
    expect(within(item).getByText("Đang diễn ra")).toBeTruthy();
    expect(within(item).getByRole("link", { name: "Lập lịch vào dịp này" }).getAttribute("href")).toBe(`/plan?step=1&startDate=${today}`);
    // Venues and the description are one tap away (spec §5).
    expect(within(item).queryByText("Mô tả.")).toBeNull();
    await userEvent.setup().click(within(item).getByRole("button", { name: "Xem chi tiết và nơi tổ chức" }));
    expect(within(item).getByText("Mô tả.")).toBeTruthy();
    expect(within(item).getByRole("link", { name: "Văn Miếu" }).getAttribute("href")).toBe("/places/place-1?from=festivals");
    expect(fetchHolidays).toHaveBeenCalledWith(today, 365, "vi");
  });
});

describe("place and reviews", () => {
  it("asks to sign in before writing a review, then returns to the form", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchPlace).mockResolvedValue(place({ ratingAverage: 4.5, ratingCount: 2, comments: [{ id: "c1", authorName: "Lan", rating: 5, comment: "Đẹp", createdAt: "" }] }));
    vi.mocked(loginAccount).mockResolvedValue({ token: "t", user: { id: "u", displayName: "Minh", email: "m@example.com", phone: null } });
    vi.mocked(submitPlaceReview).mockResolvedValue(place({ ratingAverage: 4.7, ratingCount: 3 }));
    renderApp(<PlacePage placeId="place-1" />);
    expect(await screen.findByText("Đẹp")).toBeTruthy();
    expect(screen.getByText("Giá và giờ có thể là ước tính; kiểm tra lại trước khi đi.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Viết đánh giá" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Email hoặc số điện thoại"), "m@example.com");
    await user.type(within(dialog).getByLabelText("Mật khẩu"), "password123");
    await user.click(within(dialog).getByRole("button", { name: "Đăng nhập" }));
    await user.type(await screen.findByLabelText("Nhận xét"), "Rất đáng ghé");
    await user.click(screen.getByRole("radio", { name: "4 sao" }));
    await user.click(screen.getByRole("button", { name: "Gửi đánh giá" }));
    await waitFor(() => expect(submitPlaceReview).toHaveBeenCalledWith("place-1", "t", 4, "Rất đáng ghé"));
    expect(await screen.findByText("Đã gửi đánh giá")).toBeTruthy();
  });
});

describe("place page extras", () => {
  it("shows three reviews and the rest behind a tap, and the place's story (F23, F25, spec §5)", async () => {
    const user = userEvent.setup();
    const comments = [1, 2, 3, 4].map((n) => ({ id: `c${n}`, authorName: `Khách ${n}`, rating: 5, comment: `Nhận xét ${n}`, createdAt: "" }));
    const story = { slug: "van-mieu-quoc-tu-giam", title: "Văn Miếu – Quốc Tử Giám", teaser: "Dựng năm 1070.", readingMinutes: 3 };
    vi.mocked(fetchPlace).mockResolvedValue(place({ ratingAverage: 5, ratingCount: 4, comments, story }));
    renderApp(<PlacePage placeId="place-1" />);
    expect(await screen.findByText("Nhận xét 3")).toBeTruthy();
    expect(screen.queryByText("Nhận xét 4")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Xem tất cả 4 đánh giá" }));
    expect(screen.getByText("Nhận xét 4")).toBeTruthy();
    expect(screen.getByText("Văn Miếu – Quốc Tử Giám")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Đọc chuyện" }).getAttribute("href")).toBe("/stories/van-mieu-quoc-tu-giam");
  });
});


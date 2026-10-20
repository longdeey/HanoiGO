import { expect, test } from "@playwright/test";

import { signIn } from "./auth";

test.describe("phone navigation", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("moves through the five destinations from the bottom bar", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    const nav = page.getByRole("navigation", { name: "Điều hướng chính" });
    for (const [label, path] of [["Chuyện Hà Nội", "/stories"], ["Lễ hội", "/festivals"], ["Trang chủ", "/"]] as const) {
      await nav.getByRole("link", { name: label }).click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(nav.getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");
    }
    await nav.getByRole("link", { name: "Chuyến đi" }).click();
    // Signed out, Trips and Plan send you to the Account page to sign in or register.
    await expect(page).toHaveURL(/\/account\?next=%2Ftrips/);
    await nav.getByRole("link", { name: "Lập lịch" }).click();
    await expect(page).toHaveURL(/\/account\?next=%2Fplan/);
    await expect(page.getByRole("tab", { name: "Đăng ký" })).toBeVisible();
  });
});

test("Back and Forward restore the day and the view", async ({ page, request }) => {
  const trip = await (await request.post("http://localhost:8000/api/v1/trips/generate", { data: {
    language: "vi", startDate: "2026-11-20", days: 2, travelerCount: 2, budgetTotal: 2_000_000,
    startLocation: { name: "Phố cổ", latitude: 21.034, longitude: 105.85 }, interests: ["history", "food"],
    travelMode: "walking", travelRadiusMode: "balanced", pace: "balanced", experiencePreferences: ["local"],
    dailyStartTime: "08:00", dailyEndTime: "21:00",
  } })).json() as { tripId: string; ownerToken: string; options: { id: string }[] };
  await page.goto("/");
  await page.evaluate(([id, token]) => localStorage.setItem(`hanoigo-owner-${id}`, token), [trip.tripId, trip.ownerToken]);
  await page.goto(`/trips/${trip.tripId}/${trip.options[0].id}`);
  await page.getByRole("button", { name: /^Ngày 2/ }).click();
  await expect(page).toHaveURL(/day=2/);
  await page.getByRole("button", { name: "Chi phí", exact: true }).click();
  await expect(page).toHaveURL(/day=2.*view=budget/);
  await page.goBack();
  await expect(page).toHaveURL(/\?day=2$/);
  await expect(page.getByRole("button", { name: /^Ngày 2/ })).toHaveAttribute("aria-pressed", "true");
  await page.goForward();
  await expect(page.getByRole("button", { name: "Chi phí", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("reading a story leads to planning from that landmark", async ({ page, request }) => {
  await signIn(page, request);
  await page.goto("/?story=van-mieu-quoc-tu-giam");
  await expect(page).toHaveURL(/\/stories\/van-mieu-quoc-tu-giam/);
  await expect(page.getByRole("heading", { level: 1, name: /Văn Miếu/ })).toBeVisible();
  await page.getByRole("link", { name: "Lập lịch từ đây" }).first().click();
  await expect(page).toHaveURL(/\/plan\?step=2/);
  await expect(page.getByRole("textbox", { name: "Điểm xuất phát" })).toHaveValue(/Văn Miếu/);
  await expect(page.getByText(/Đã đặt điểm/)).toBeVisible();
});

test("a festival leads to planning for its dates", async ({ page, request }) => {
  await signIn(page, request);
  await page.goto("/festivals");
  await page.getByRole("button", { name: "Cả năm" }).click();
  const first = page.getByRole("link", { name: "Lập lịch vào dịp này" }).first();
  const href = await first.getAttribute("href");
  const date = new URL(href ?? "", "http://localhost").searchParams.get("startDate");
  await first.click();
  await expect(page).toHaveURL(/\/plan\?step=1/);
  await expect(page.getByLabel("Ngày bắt đầu (không bắt buộc)")).toHaveValue(date ?? "");
});

test("language and appearance survive a reload", async ({ page }) => {
  await page.goto("/account", { waitUntil: "networkidle" });
  // Appearance is one tap away (spec §5).
  await page.getByRole("button", { name: /^Giao diện/ }).click();
  await page.getByRole("group", { name: "Giao diện" }).getByRole("radio", { name: "Tối" }).check({ force: true });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Đổi ngôn ngữ sang English" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  // The server renders the saved choice, so nothing flips back after a reload.
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: /^Appearance/ }).click();
  await expect(page.getByRole("group", { name: "Appearance" }).getByRole("radio", { name: "Dark" })).toBeChecked();
});

test("without road geometry the day is drawn with straight dashed lines and a warning (F17)", async ({ page, request }) => {
  const trip = await (await request.post("http://localhost:8000/api/v1/trips/generate", { data: {
    language: "vi", startDate: "2026-11-20", days: 1, travelerCount: 2, budgetTotal: 1_500_000,
    startLocation: { name: "Phố cổ", latitude: 21.034, longitude: 105.85 }, interests: ["history", "food"],
    travelMode: "walking", travelRadiusMode: "balanced", pace: "balanced", experiencePreferences: ["local"],
    dailyStartTime: "08:00", dailyEndTime: "21:00",
  } })).json() as { tripId: string; ownerToken: string; options: { id: string }[] };
  await page.route("**/api/v1/routes/geometry", async (route) => {
    const body = route.request().postDataJSON() as { points: { latitude: number; longitude: number }[] };
    await route.fulfill({ json: { coordinates: body.points, roadDistanceKm: null, roadDurationMinutes: null, source: "direct", warning: "OSRM unavailable" } });
  });
  await page.goto("/");
  await page.evaluate(([id, token]) => localStorage.setItem(`hanoigo-owner-${id}`, token), [trip.tripId, trip.ownerToken]);
  await page.goto(`/trips/${trip.tripId}/${trip.options[0].id}`, { waitUntil: "networkidle" });
  await expect(page.getByText("Đang nối các điểm bằng đường thẳng")).toBeVisible();
  await expect(page.locator(".leaflet-overlay-pane path:not(.route-casing)").first()).toHaveAttribute("stroke-dasharray", "6 6");
});


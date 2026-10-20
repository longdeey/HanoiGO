import { expect, test, type Page } from "@playwright/test";

import { signIn } from "./auth";

/** Go to the next form step and wait until it is shown. */
async function nextStep(page: Page, to: number) {
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await expect(page.getByText(`Bước ${to}/4`)).toBeVisible();
}

type ApiItem = { id: string; place: { id: string }; startTime: string; endTime: string };
type ApiDay = { items: ApiItem[]; estimatedCost: number; estimatedDistanceKm: number };
type ApiOption = {
  id: string; type: string; estimatedTotalCost: number; estimatedTotalDistanceKm: number;
  budget: { total: number; remaining: number }; days: ApiDay[];
};
type ApiTrip = { tripId: string; ownerToken?: string; options: ApiOption[] };

async function fakeRoadGeometry(page: Page) {
  await page.route("**/api/v1/routes/geometry", async (route) => {
    const body = route.request().postDataJSON() as { points: { latitude: number; longitude: number }[] };
    await route.fulfill({ json: { coordinates: body.points, roadDistanceKm: 1.2, roadDurationMinutes: 7, source: "osrm", warning: null } });
  });
}

test("create, compare, replace, reduce cost, and share", async ({ page, request }) => {
  await signIn(page, request);
  await fakeRoadGeometry(page);
  const generationStatuses: number[] = [];
  page.on("response", (response) => {
    if (response.url().endsWith("/api/v1/trips/generate")) generationStatuses.push(response.status());
  });

  // Home: the defaults are 3 days, 2 people, 3,000,000 đ.
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Bạn có mấy ngày ở Hà Nội?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "3", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Lập lịch trình" }).click();

  await expect(page).toHaveURL(/\/plan\?step=1/);
  await expect(page.getByLabel("Ngân sách cả chuyến")).toHaveValue("3.000.000");
  await nextStep(page, 2);
  await page.getByRole("button", { name: "Hồ Hoàn Kiếm" }).click();
  await nextStep(page, 3);
  await nextStep(page, 4);
  const generatedResponse = page.waitForResponse((response) =>
    response.url().endsWith("/api/v1/trips/generate") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Lập lịch trình" }).click();
  const generated = await (await generatedResponse).json() as ApiTrip;
  expect(generated.ownerToken).toBeTruthy();
  expect(generated.options.map((option) => option.type)).toEqual(["BEST_MATCH", "BUDGET_FRIENDLY", "EXPLORE_MORE"]);

  // Compare: three options, one request.
  await expect(page).toHaveURL(new RegExp(`/trips/${generated.tripId}$`));
  await expect(page.getByRole("link", { name: "Xem lịch trình" })).toHaveCount(3);
  expect(generationStatuses).toEqual([200]);
  await page.getByRole("link", { name: "Xem lịch trình" }).first().click();

  // Itinerary: start (0) plus one station per stop on the day's map.
  await expect(page).toHaveURL(new RegExp(`/trips/${generated.tripId}/${generated.options[0].id}`));
  await expect(page.locator(".leaflet-container .station-icon")).toHaveCount(generated.options[0].days[0].items.length + 1);

  const before = generated.options[0];
  const target = before.days[0].items[1];
  await page.getByRole("button", { name: /^2\. .*Mở chi tiết$/ }).click();
  // Desktop: the stop card expands in place (M16); the replacement opens a sheet.
  await page.locator("[id^='stop-details-']").getByRole("button", { name: "Thay địa điểm" }).click();
  const replaceSheet = page.getByRole("dialog");
  await replaceSheet.getByRole("radio", { name: "Quá đắt" }).check();
  const replacementResponse = page.waitForResponse((response) => response.url().endsWith("/replace") && response.request().method() === "POST");
  await replaceSheet.getByRole("button", { name: "Thay địa điểm" }).click();
  const replaced = await (await replacementResponse).json() as ApiTrip;
  expect(replaced.tripId).toBe(generated.tripId);
  const after = replaced.options[0];
  expect(after.days[0].items.some((item) => item.place.id === target.place.id)).toBe(false);
  expect(after.budget.total).toBe(after.days.reduce((sum, day) => sum + day.estimatedCost, 0));
  await expect(page.getByText(/^Đã thay /)).toBeVisible();
  await expect(page.locator(".leaflet-container .station-icon")).toHaveCount(after.days[0].items.length + 1);

  await page.getByRole("button", { name: "Tối ưu lại" }).first().click();
  const optimizeSheet = page.getByRole("dialog");
  await optimizeSheet.getByRole("radio", { name: /Giảm chi phí/ }).check();
  const optimizedResponse = page.waitForResponse((response) => response.url().endsWith("/optimize") && response.request().method() === "POST");
  await optimizeSheet.getByRole("button", { name: "Tối ưu lại" }).click();
  const optimized = await (await optimizedResponse).json() as ApiTrip;
  const cheaper = optimized.options[0];
  expect(cheaper.estimatedTotalCost).toBeLessThanOrEqual(after.estimatedTotalCost);
  expect(cheaper.budget.remaining).toBeGreaterThanOrEqual(0);
  for (const day of cheaper.days) {
    for (let index = 1; index < day.items.length; index += 1) {
      expect(day.items[index].startTime >= day.items[index - 1].endTime).toBe(true);
    }
  }
  await expect(page.getByRole("button", { name: /khoá|Lock/i })).toHaveCount(0);

  // Share: a read-only link, kept on this device.
  await page.getByRole("button", { name: "Chia sẻ" }).first().click();
  const shareResponse = page.waitForResponse((response) => response.url().endsWith("/share") && response.request().method() === "POST");
  await page.getByRole("dialog").getByRole("button", { name: "Tạo liên kết chia sẻ" }).click();
  await shareResponse;
  const shareUrl = await page.getByRole("textbox", { name: "Liên kết chia sẻ" }).inputValue();
  expect(shareUrl).toContain(`/trips/${generated.tripId}/${before.id}?share=`);
  const shareToken = new URL(shareUrl).searchParams.get("share");

  await page.goto(shareUrl);
  await expect(page.getByText("Bạn đang xem lịch trình được chia sẻ.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Tối ưu lại" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Chia sẻ" })).toHaveCount(0);

  // Links shared before the redesign still open (308 to the new URL, token kept).
  await page.goto(`/?trip=${generated.tripId}&option=${before.id}&share=${shareToken}`);
  await expect(page).toHaveURL(new RegExp(`/trips/${generated.tripId}/${before.id}\\?.*share=${shareToken}`));
  await expect(page.getByText("Bạn đang xem lịch trình được chia sẻ.")).toBeVisible();
});

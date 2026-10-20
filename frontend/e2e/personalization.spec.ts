import { expect, test, type Page } from "@playwright/test";

import { signIn } from "./auth";

/** Go to the next form step and wait until it is shown. */
async function nextStep(page: Page, to: number) {
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await expect(page.getByText(`Bước ${to}/4`)).toBeVisible();
}

type ApiTrip = {
  tripId: string;
  travelMode: string;
  options: {
    id: string; type: string; estimatedTotalCost: number;
    budget: { remaining: number };
    days: { items: { place: { slug: string } }[] }[];
  }[];
};

const signature = (trip: ApiTrip) => trip.options[0].days.flatMap((day) => day.items.map((item) => item.place.slug)).join(";");

test("free Hanoi address, higher budget, motorbike, and rebuilding after editing the request", async ({ page, request }) => {
  await signIn(page, request);
  await page.route("**/api/v1/locations/resolve?**", async (route) => {
    expect(new URL(route.request().url()).searchParams.get("query")).toBe("123 Nguyễn Trãi, Hà Nội");
    await route.fulfill({ json: { name: "Nguyễn Trãi, Thanh Xuân, Hà Nội", latitude: 21.001, longitude: 105.817 } });
  });
  await page.goto("/plan?step=1", { waitUntil: "networkidle" });
  await page.getByLabel("Ngân sách cả chuyến").fill("10000000");
  await nextStep(page, 2);
  await page.getByRole("textbox", { name: "Điểm xuất phát" }).fill("123 Nguyễn Trãi, Hà Nội");
  await nextStep(page, 3);
  await page.getByRole("radio", { name: /Xe máy/ }).check({ force: true });
  await nextStep(page, 4);
  const highResponse = page.waitForResponse((response) => response.url().endsWith("/api/v1/trips/generate") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Lập lịch trình" }).click();
  const highRaw = await highResponse;
  const high = await highRaw.json() as ApiTrip;
  expect(highRaw.status(), JSON.stringify(high).slice(0, 300)).toBe(200);
  expect(high.travelMode).toBe("motorbike");
  expect(high.options).toHaveLength(3);
  expect(high.options[0].estimatedTotalCost).toBeGreaterThanOrEqual(4_000_000);
  expect(high.options[0].estimatedTotalCost).toBeLessThanOrEqual(10_000_000);
  expect(high.options[0].budget.remaining).toBeGreaterThanOrEqual(0);

  // Directions use the trip's travel mode (two-wheeler for motorbike).
  await page.getByRole("link", { name: "Xem lịch trình" }).first().click();
  await page.getByRole("button", { name: /^1\. .*Mở chi tiết$/ }).click();
  await expect(page.locator("[id^='stop-details-']").getByRole("link", { name: "Chỉ đường" })).toHaveAttribute("href", /travelmode=two-wheeler/);

  // Edit the request from the itinerary: lower the budget and plan again (F35).
  await page.getByRole("button", { name: "Thêm thao tác" }).click();
  await page.getByRole("menuitem", { name: "Sửa yêu cầu" }).click();
  await expect(page).toHaveURL(/\/plan\?step=1/);
  await expect(page.getByLabel("Ngân sách cả chuyến")).toHaveValue("10.000.000");
  await page.getByLabel("Ngân sách cả chuyến").fill("3000000");
  for (let step = 2; step <= 4; step += 1) await nextStep(page, step);
  const lowResponse = page.waitForResponse((response) => response.url().endsWith("/api/v1/trips/generate") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Lập lịch trình" }).click();
  const lowRaw = await lowResponse;
  const low = await lowRaw.json() as ApiTrip;
  expect(lowRaw.status(), `${lowRaw.request().postData()} -> ${JSON.stringify(low).slice(0, 300)}`).toBe(200);
  expect(low.tripId).not.toBe(high.tripId);
  expect(low.options[0].estimatedTotalCost).toBeLessThan(high.options[0].estimatedTotalCost);
  expect(low.options[0].estimatedTotalCost).toBeLessThanOrEqual(3_000_000);
  expect(signature(low)).not.toBe(signature(high));

  // Edit again from the comparison page: change interests.
  await page.getByRole("button", { name: "Sửa yêu cầu" }).click();
  await expect(page.getByText("Bước 1/4")).toBeVisible();
  for (let step = 2; step <= 4; step += 1) await nextStep(page, step);
  for (const interest of ["Ẩm thực", "Cà phê", "Văn hóa địa phương"]) {
    await page.getByRole("button", { name: interest, exact: true }).click();
  }
  const historyResponse = page.waitForResponse((response) => response.url().endsWith("/api/v1/trips/generate") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Lập lịch trình" }).click();
  const history = await (await historyResponse).json() as ApiTrip;
  expect(history.tripId).not.toBe(low.tripId);
  expect(signature(history)).not.toBe(signature(low));
  expect(history.options[0].estimatedTotalCost).toBeLessThanOrEqual(3_000_000);
});

import { expect, test, type Page } from "@playwright/test";

/** Go to the next form step and wait until it is shown. */
async function nextStep(page: Page, to: number) {
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await expect(page.getByText(`Bước ${to}/4`)).toBeVisible();
}

test("pick any Hanoi starting point when address lookup is unavailable", async ({ page }) => {
  let addressLookups = 0;
  await page.route("**/api/v1/locations/resolve?**", async (route) => {
    addressLookups += 1;
    await route.abort();
  });
  await page.goto("/plan?step=2", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Chọn trên bản đồ" }).click();
  const picker = page.getByRole("dialog", { name: "Chọn điểm xuất phát" });
  await expect(picker.locator(".leaflet-container")).toBeVisible();
  // The pin stays in the middle; dragging the map moves the point underneath.
  const map = picker.locator(".leaflet-container");
  const box = await map.boundingBox();
  if (!box) throw new Error("Map is not visible");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 80, box.y + box.height / 2 - 40, { steps: 8 });
  await page.mouse.up();
  await picker.getByRole("button", { name: "Dùng điểm này" }).click();
  await expect(page.getByRole("textbox", { name: "Điểm xuất phát" })).toHaveValue(/^Ghim bản đồ /);

  for (let step = 3; step <= 4; step += 1) await nextStep(page, step);
  const generation = page.waitForResponse((response) => response.url().endsWith("/api/v1/trips/generate") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Lập lịch trình" }).click();
  const response = await generation;
  const request = response.request().postDataJSON() as { startLocation: { name: string; latitude: number; longitude: number } };
  expect(request.startLocation.name).toMatch(/^Ghim bản đồ /);
  expect(request.startLocation.latitude).toBeGreaterThan(20.45);
  expect(request.startLocation.latitude).toBeLessThan(21.55);
  expect(request.startLocation.longitude).toBeGreaterThan(105.18);
  expect(request.startLocation.longitude).toBeLessThan(106.25);
  const trip = await response.json() as { options?: unknown[] };
  expect(response.status(), JSON.stringify(trip)).toBe(200);
  expect(trip.options).toHaveLength(3);
  expect(addressLookups).toBe(0);
});

test("an unknown address sends you back to the starting point with a way forward", async ({ page }) => {
  await page.route("**/api/v1/locations/resolve?**", (route) => route.fulfill({
    status: 404, json: { success: false, error: { code: "LOCATION_NOT_FOUND", message: "not found", details: null } },
  }));
  await page.goto("/plan?step=2", { waitUntil: "networkidle" });
  await page.getByRole("textbox", { name: "Điểm xuất phát" }).fill("Không có phố này");
  for (let step = 3; step <= 4; step += 1) await nextStep(page, step);
  await page.getByRole("button", { name: "Lập lịch trình" }).click();
  await expect(page).toHaveURL(/step=2/);
  await expect(page.getByText(/Không tìm thấy địa chỉ này ở Hà Nội/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Chọn trên bản đồ" })).toBeVisible();
});

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { createAccount, signInPage } from "./auth";

// Spec §11/§14: axe on every main route, light and dark, no serious or
// critical violations. Reduced motion keeps colours out of mid-animation states.
test.use({ contextOptions: { reducedMotion: "reduce" } });

type ApiTrip = { tripId: string; ownerToken: string; options: { id: string; days: { items: { place: { id: string } }[] }[] }[] };

let trip: ApiTrip;
let account: { token: string; user: unknown };

test.beforeAll(async ({ request }) => {
  account = await createAccount(request);
  const response = await request.post("http://localhost:8000/api/v1/trips/generate", { headers: { Authorization: `Bearer ${account.token}` }, data: {
    language: "vi", startDate: "2026-11-20", days: 2, travelerCount: 2, budgetTotal: 2_000_000,
    startLocation: { name: "Phố cổ", latitude: 21.034, longitude: 105.85 }, interests: ["history", "food"],
    travelMode: "walking", travelRadiusMode: "balanced", pace: "balanced", experiencePreferences: ["local"],
    dailyStartTime: "08:00", dailyEndTime: "21:00",
  } });
  expect(response.status()).toBe(200);
  trip = await response.json() as ApiTrip;
});

function routes() {
  const option = trip.options[0];
  return [
    "/", "/plan?step=1", "/plan?step=2", "/plan?step=3", "/plan?step=4",
    "/stories", "/stories/van-mieu-quoc-tu-giam", "/festivals", "/trips",
    `/trips/${trip.tripId}`,
    `/trips/${trip.tripId}/${option.id}`,
    `/trips/${trip.tripId}/${option.id}?view=map`,
    `/trips/${trip.tripId}/${option.id}?view=budget`,
    `/trips/${trip.tripId}/${option.id}?view=stays`,
    `/places/${option.days[0].items[0].place.id}`,
    "/account", "/credits", "/privacy",
  ];
}

async function audit(page: Page, path: string) {
  await page.goto(path, { waitUntil: "networkidle" });
  await expect(page.locator("main")).toBeVisible();
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  return result.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    // Close stops can overlap their 44 px hit areas on the map. WCAG 2.5.8's
    // "equivalent" exception applies: each marker's action is also a stop in
    // the list beside the map. Every other rule still runs on the markers.
    .map((violation) => violation.id !== "target-size" ? violation : {
      ...violation, nodes: violation.nodes.filter((node) => !node.html.includes("leaflet-marker-icon")),
    })
    .filter((violation) => violation.nodes.length > 0)
    .map((violation) => `${path}: ${violation.id} (${violation.impact}) ${violation.nodes.slice(0, 3).map((node) => node.target.join(" ")).join(" | ")}`);
}

for (const theme of ["light", "dark"] as const) {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    test(`no serious axe violations, ${theme}, ${viewport.width}px`, async ({ page, context }) => {
      test.setTimeout(180_000);
      await context.addCookies([{ name: "hanoigo-theme", value: theme, url: "http://localhost:3000" }]);
      await page.setViewportSize(viewport);
      await signInPage(page, account);
      await page.goto("/");
      await page.evaluate(([id, token]) => localStorage.setItem(`hanoigo-owner-${id}`, token), [trip.tripId, trip.ownerToken]);
      const problems: string[] = [];
      for (const path of routes()) problems.push(...await audit(page, path));
      expect(problems, problems.join("\n")).toEqual([]);
    });
  }
}

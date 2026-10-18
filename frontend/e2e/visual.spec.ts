import { expect, test, type Page } from "@playwright/test";

// Spec §14: screenshot comparison of the 8 main screens at 390 px and 1280 px,
// light and dark. Baselines depend on the OS, browser and fonts, so this suite
// is opt-in: HANOIGO_VISUAL=1 npx playwright test visual.spec.ts
// (add --update-snapshots after an intended visual change).
test.skip(!process.env.HANOIGO_VISUAL, "Set HANOIGO_VISUAL=1 to compare screenshots");
test.use({ contextOptions: { reducedMotion: "reduce" } });

// A fixed "today" keeps festivals, trip groups and dates stable.
const NOW = new Date("2026-10-18T09:00:00+07:00");
const START_DATE = "2026-11-20";

type ApiTrip = { tripId: string; ownerToken: string; options: { id: string }[] };
let trip: ApiTrip;

test.beforeAll(async ({ request }) => {
  const response = await request.post("http://localhost:8000/api/v1/trips/generate", { data: {
    language: "vi", startDate: START_DATE, days: 2, travelerCount: 2, budgetTotal: 2_000_000,
    startLocation: { name: "Phố cổ", latitude: 21.034, longitude: 105.85 }, interests: ["history", "food"],
    travelMode: "walking", travelRadiusMode: "balanced", pace: "balanced", experiencePreferences: ["local"],
    dailyStartTime: "08:00", dailyEndTime: "21:00",
  } });
  expect(response.status()).toBe(200);
  trip = await response.json() as ApiTrip;
});

const SCREENS: { name: string; path: () => string; ready: (page: Page) => Promise<void> }[] = [
  { name: "home", path: () => "/", ready: (page) => expect(page.getByRole("heading", { level: 1 })).toBeVisible() },
  { name: "plan", path: () => "/plan?step=1", ready: (page) => expect(page.getByText("Bước 1/4")).toBeVisible() },
  { name: "compare", path: () => `/trips/${trip.tripId}`, ready: (page) => expect(page.getByRole("link", { name: "Xem lịch trình" })).toHaveCount(3) },
  { name: "itinerary", path: () => `/trips/${trip.tripId}/${trip.options[0].id}`, ready: (page) => expect(page.getByRole("button", { name: /^1\. .*Mở chi tiết$/ })).toBeVisible() },
  { name: "stories", path: () => "/stories", ready: (page) => expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible() },
  { name: "story", path: () => "/stories/van-mieu-quoc-tu-giam", ready: (page) => expect(page.getByRole("heading", { level: 1 })).toBeVisible() },
  { name: "festivals", path: () => "/festivals", ready: (page) => expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible() },
  { name: "trips", path: () => "/trips", ready: (page) => expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible() },
];

for (const theme of ["light", "dark"] as const) {
  for (const width of [390, 1280]) {
    test.describe(`${theme}, ${width}px`, () => {
      test.use({ viewport: { width, height: width === 390 ? 844 : 900 } });
      for (const screen of SCREENS) {
        test(screen.name, async ({ page, context }) => {
          await page.clock.setFixedTime(NOW);
          await context.addCookies([{ name: "hanoigo-theme", value: theme, url: "http://localhost:3000" }]);
          // Weather is live data: show the "no forecast" state, which hides it.
          await page.route("**/api/v1/weather?**", (route) => route.fulfill({ json: { date: "2026-10-18", available: false, afternoonRainProbability: null, warning: null } }));
          await page.route("**/api/v1/routes/geometry", async (route) => {
            const body = route.request().postDataJSON() as { points: { latitude: number; longitude: number }[] };
            await route.fulfill({ json: { coordinates: body.points, roadDistanceKm: 1.2, roadDurationMinutes: 7, source: "osrm", warning: null } });
          });
          await page.goto("/");
          await page.evaluate(([id, token, startDate]) => {
            localStorage.setItem(`hanoigo-owner-${id}`, token);
            localStorage.setItem(`hanoigo-trip-summary-${id}`, JSON.stringify({
              tripId: id, startDate, days: 2, travelerCount: 2, budgetTotal: 2_000_000,
              startName: "Phố cổ", createdAt: "2026-10-18T08:00:00+07:00",
            }));
          }, [trip.tripId, trip.ownerToken, START_DATE]);
          await page.goto(screen.path(), { waitUntil: "networkidle" });
          await screen.ready(page);
          await expect(page).toHaveScreenshot(`${screen.name}-${theme}-${width}.png`, {
            animations: "disabled", caret: "hide", maxDiffPixelRatio: 0.01,
            // Map tiles come from a public tile server and change over time.
            mask: [page.locator(".leaflet-tile-pane")],
          });
        });
      }
    });
  }
}

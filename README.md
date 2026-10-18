# HanoiGO

HanoiGO is a Hanoi itinerary planner built around time, budget, interests, geography, and opening hours. A traveler enters constraints, compares three valid itineraries, explores a daily timeline and map, replaces places, re-optimizes, opens stop-by-stop Google Maps directions, and shares a saved plan. The map labels the chosen starting point as `0`. Each place shows a rating summary and traveler comments; signed-in users can submit reviews under their account name. The interface supports English and Vietnamese. The [implementation specification](HanoiGO_IMPLEMENTATION_SPEC.md) defines the MVP requirements.

## Architecture and stack

The repository is a modular monolith. `frontend` uses Next.js 15 (App Router), React 19, TypeScript (strict), Tailwind CSS, React Hook Form, Zod, TanStack Query, Leaflet, Motion (`motion` 13.5.1, pinned) and Phosphor icons. `backend` uses Python 3.12+, FastAPI, Pydantic v2, SQLAlchemy 2, GeoAlchemy2, Alembic, Pytest, Ruff, and HTTPX. PostgreSQL 16 with PostGIS 3.4 stores POIs and generated trips. REST routes call application services; deterministic planner modules handle filtering, scoring, geographic grouping, schedules, travel estimates, budgets, and validation. OpenStreetMap supplies map tiles and user-submitted address lookup, Open-Meteo supplies weather, and OSRM supplies optional road geometry through bounded provider adapters. Google Maps links open directions in a new tab without a server-side Google API. No LLM is required for itinerary generation.

## Prerequisites

- Python 3.12+
- Node.js 20+ and npm
- PostgreSQL 16 with PostGIS 3.4, either through Docker Compose or an equivalent local installation

On macOS without Docker, [Postgres.app](https://postgresapp.com/downloads.html) can provide a compatible PostgreSQL 16/PostGIS 3.4 bundle.

## Environment variables

Copy root `.env.example` to `.env`. `DATABASE_URL` points to PostgreSQL; change credentials if needed. `CORS_ORIGINS` defaults to `http://localhost:3000`. `APP_ENV=production` activates the process-local trip generation limit; `GENERATE_RATE_LIMIT_PER_MINUTE` defaults to 10 per client host. `ROUTE_API_URL` selects an OSRM-compatible route endpoint. `GEOCODING_API_URL` and `GEOCODING_USER_AGENT` select and identify the user-submitted address lookup provider; set an application-specific User-Agent for public use. The map and weather services used in this MVP do not require API keys; `MAP_API_KEY`, `WEATHER_API_KEY`, `LLM_API_KEY`, and `LLM_MODEL` are reserved optional placeholders. Copy `frontend/.env.example` to `frontend/.env.local` if the API is not at `http://localhost:8000`; set `NEXT_PUBLIC_API_URL` there. Never commit real secrets.

## Install and start

From the repository root:

```bash
cp .env.example .env
docker compose up -d postgres
python3 -m venv .venv
.venv/bin/pip install -e './backend[dev]'
cd backend
../.venv/bin/alembic upgrade head
../.venv/bin/python -m app.infrastructure.db.seed
../.venv/bin/uvicorn app.main:app --reload
```

The seed is idempotent and loads the 150 curated Hanoi POIs from `backend/data/curated_places.json`, one record per place with its prices, hours, highlight level, seasonal window, sources and demo reviews; edit that file and re-run the seed to update them. The catalog covers central, western, northern, southern, Long Bien, Hòa Lạc, Ba Vì and Sóc Sơn areas. The catalog includes food, coffee, museums, heritage, craft villages, parks, festivals, hiking/nature stops and accommodation suggestions. It includes verified 2026 seasonal windows plus recurring annual festivals on the solar or lunar calendar (Tết, Perfume Pagoda, Giong, Mid-Autumn, Vesak…); see the [POI data audit](POI_DATA_AUDIT.md). `backend/data/vietnam_holidays.json` holds the year-round holiday calendar (33 occasions); lunar dates are converted with Hồ Ngọc Đức's algorithm in `app/domain/lunar.py`. The OpenStreetMap import drops snapshot rows that duplicate a curated place (same OSM element, same name, or same category within 30 m), so adding a famous place to the curated file and re-running the import retires its OSM copy.

To enrich the catalog with many more places across all of Hanoi, including the outskirts, run the OpenStreetMap importer:

```bash
../.venv/bin/python -m app.infrastructure.db.osm_import fetch --import   # Overpass -> raw cache + snapshot -> database
../.venv/bin/python -m app.infrastructure.db.osm_import remap --import   # rebuild the snapshot offline from the raw cache
../.venv/bin/python -m app.infrastructure.db.osm_import                  # import the committed snapshot only
```

`fetch` queries the public Overpass API for named museums, attractions, theme and water parks, eco-resorts, historic sites, temples and pagodas, parks, peaks, caves, waterfalls, lakes, markets, malls, restaurants, street-food stalls, cafés and lodging inside the Hanoi administrative boundary, maps them to HanoiGO categories, deduplicates them against the curated seed, caches the raw Overpass elements in `backend/data/osm_hanoi_raw.json` (a local, git-ignored file) and writes the snapshot `backend/data/osm_hanoi_places.json`. `remap` rebuilds the snapshot from that cache without network access, which is how mapping rules are tuned; run `fetch` once first if the cache is missing. Running the module without a command imports the snapshot and is idempotent (rows are keyed by slug, curated rows are never overwritten, and OpenStreetMap rows that dropped out of the snapshot are deactivated rather than deleted so saved trips keep their references). Quality rules: names that only describe a kind of place ("Bánh cuốn nóng gia truyền", "Chợ đêm", "Đình làng") are skipped, as are places OpenStreetMap marks as closed (`disused:*`, `was:*`, `opening_hours=closed`), offices, schools, war memorials and family shrines, linear infrastructure and franchise outlets; restaurants and cafés need a detail tag or a Vietnamese dish in their name; independent foreign kitchens stay but lose the `local_culture` tag and rank below local ones; rural markets count as local food stops. Every place is assigned to one of Hanoi's 126 communes and wards (`backend/data/hanoi_communes.json`, OSM admin_level 6 after the July 2025 reorganisation); each commune keeps its best 4 attractions and 4 food stops before the city-wide caps (1,500 food, 600 coffee, 900 history, 300 parks, 300 nature, 300 lodging, 250 shopping) are filled. The committed snapshot holds 3,415 places (about 810 local eateries, 527 in the outskirts, 495 with opening hours from OpenStreetMap). Six rural communes (Dương Hòa, Hòa Xá, Phúc Lộc, Quảng Bị, Thạch Thất, Tiến Thắng) have no named places in OpenStreetMap yet; trips starting there use places in neighbouring communes within the chosen radius. Imported prices, visit durations and, where OpenStreetMap has no `opening_hours` tag, opening hours are category estimates; every row keeps its OpenStreetMap element URL as `source`. Data © OpenStreetMap contributors, ODbL. The public Overpass API is rate limited, so a full fetch can take several minutes; the snapshot makes repeat imports instant. If using Postgres.app, create a database named `hanoigo` and enable `CREATE EXTENSION postgis;` before the migration. The default development URL expects user/password `hanoigo`/`hanoigo`; adjust `DATABASE_URL` for your local instance. Check `/api/v1/health` for the API and `/api/v1/ready` for database connectivity.

In another terminal:

```bash
cd frontend
npm ci
npm run dev
```

Open `http://localhost:3000`. The interface follows the [UI redesign specification](HanoiGO_UI_REDESIGN_SPEC.md) ("Biển hiệu phố": Hanoi street-sign red, blue and wall yellow; Phudu for the few signboards, Archivo for everything else) and has five destinations: Home (`/`), Stories (`/stories`, `/stories/[slug]`), Plan (`/plan?step=1..4`), Festivals (`/festivals`) and Trips (`/trips`). A generated trip opens on its comparison page (`/trips/[tripId]`); each option has its own page (`/trips/[tripId]/[option]?day=2&view=map|budget|stays`), so Back, Forward and shared links restore the day and tab. Places have `/places/[placeId]`; language, appearance and sign-in live under `/account`; photo credits under `/credits`; `/privacy` describes what is stored in the browser and sent to the API. Links from the single-page UI (`/?trip=…&option=…&share=…`, `/?story=…`) redirect with 308 to the new URLs, keeping the share token. Language (`hanoigo-language`, Vietnamese by default) and appearance (`hanoigo-theme`: device, light or dark) are cookies read by the server, so a reload never flips them. Motion respects `prefers-reduced-motion`. `/dev/ui` shows every base component in both themes during development and returns 404 in production. Every timeline stop shows its estimated cost for the whole party, the entrance fee per person when there is one, and the ride fare of the leg before it; each day shows its total. The default form values reproduce the primary 3-day, 2-person, 3,000,000 VND demo flow. Choose a travel start date to surface date-specific experiences and recurring Vietnamese holiday windows. Enter a named place or street address anywhere in Hanoi, paste coordinates or a Google Maps link, use the browser's current position, or tap **Pick on map** to place a starting pin directly. The result also includes accommodation suggestions within 5 km of the start or planned route. Walking, motorbike and car are offered, with deterministic ride fare estimates for the latter two. The form offers 5 km (nearby), 15 km (medium) and 30 km (far); the API still accepts the legacy 80 km value, but the form never sends it; the selected radius is applied from any starting point. Walking is capped at a 10 km search and daily route distance, so wider presets should use a motorbike or car. Each stop has a Google Maps directions link, a rating/comment panel, and must-see stops use a red badge and map marker.

## API

- `POST /api/v1/trips/generate` creates three structured options. Best Match spends 95–100% of the budget and Explore More 90–100% (adding stops or upgrading to costlier ones of the same kind until the floor is reached); Budget Friendly keeps a 5% buffer. Each option reports `budgetTargetShare` and `budgetTargetMet`, so the interface can warn when the places along a route cannot absorb the budget (for example a very large walking budget). With a `startDate`, the response's `holidays` list names every Vietnamese holiday or Hanoi festival on the trip dates (with a suggestion and the catalog places that host it), even when no event place exists for that day.
- `GET /api/v1/holidays?start=YYYY-MM-DD&days=365&language=vi` returns the year-round holiday calendar.
- `GET /api/v1/trips/{tripId}` retrieves a saved trip with an owner or share bearer token.
- `POST /api/v1/trips/{tripId}/share` rotates a read-only share token (owner bearer token required).
- `GET /api/v1/places/{placeId}?language=vi` retrieves a POI. A place that has a history/culture story carries a short `story` link (slug, title, teaser, reading time); itinerary items, holiday places and stays include it too.
- `GET /api/v1/stories?language=vi` lists the landmark stories, featured ones (shown with a photo on the home page) first. `GET /api/v1/stories/{slug}?language=vi` returns the full story: sections, a timeline, visiting tips, sources, the landmark itself (for directions and "plan a trip from here") and other stories within 2 km.
- `POST /api/v1/auth/register` and `POST /api/v1/auth/login` create or authenticate an account using an email address or phone number.
- `POST /api/v1/places/{placeId}/reviews` adds a validated 1–5 rating and comment, then returns the refreshed POI summary.
- `POST /api/v1/trips/{tripId}/itineraries/{itineraryId}/items/{itemId}/replace` replaces one stop.
- `POST /api/v1/trips/{tripId}/itineraries/{itineraryId}/optimize` re-optimizes a plan.
- `GET /api/v1/weather` returns structured forecast availability.
- `POST /api/v1/routes/geometry` returns optional road geometry, metrics, and a direct-line fallback warning.
- `GET /api/v1/locations/resolve?query=...` resolves a user-submitted Hanoi address to structured coordinates.

Business/API errors share `{ "success": false, "error": { "code", "message", "details" } }`. If no plan satisfies hard constraints, the API returns `NO_FEASIBLE_ITINERARY` with practical suggestions in `details`. An unresolvable entered address returns `LOCATION_NOT_FOUND`; lookup outages return `LOCATION_SERVICE_UNAVAILABLE`. Trip creation returns an `ownerToken` once; the browser stores it locally for later edits. Share links carry a separate read-only token; rotating the token invalidates earlier links. Lost owner tokens cannot be recovered without an account system. Production generation requests can return `RATE_LIMITED` (429) with `Retry-After`.

## Tests and production build

With the migrated, seeded database running:

```bash
cd backend
../.venv/bin/ruff check .
../.venv/bin/pytest
```

From `frontend`:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm --prefix e2e ci
npm --prefix e2e exec -- playwright install chromium
npm run test:e2e
```

The Playwright tests start the backend and the built frontend automatically. They exercise the full replace/reduce-cost/share flow (including a pre-redesign share link), a second flow with a freely entered address, motorbike, a 10-million-VND budget and rebuilding after budget and interest changes, a map-pin flow when address lookup is unavailable, the five-destination phone navigation, Back/Forward on an itinerary, story and festival entry points, and language and appearance surviving a reload. `a11y.spec.ts` runs axe (`@axe-core/playwright`, WCAG 2.2 AA tags) on 18 routes in light and dark at 390 px and 1280 px and fails on any serious or critical violation; overlapping map markers are exempt from `target-size` only, because each marker's action is also in the stop list. Run the flows again with `HANOIGO_REDUCED_MOTION=1 npm run test:e2e` to check them under `prefers-reduced-motion`. `src/app/contrast.test.ts` checks the colour tokens' contrast in both themes. `visual.spec.ts` compares screenshots of the eight main screens (home, plan, comparison, itinerary, stories, story reader, festivals, trips) at 390 px and 1280 px in light and dark, with the clock fixed, weather hidden and map tiles masked. Baselines depend on the operating system, browser and fonts, so it runs only with `HANOIGO_VISUAL=1`; after an intended visual change, refresh them from `frontend/e2e` with `HANOIGO_VISUAL=1 npx playwright test visual.spec.ts --update-snapshots` and review the new images. Run `npm run build` before E2E. The isolated E2E package pins Playwright 1.45.3 without changing the main Next.js dependency graph. CI runs WebKit on Linux; local runs use installed Chromium by default. On recent macOS versions where the pinned browser binary is incompatible, install Microsoft Edge and run `HANOIGO_BROWSER_CHANNEL=msedge npm run test:e2e`. On Windows, recent Edge builds can exit at once when launched by Playwright 1.45 while another Edge window is open; use the installed Chromium there. CI starts PostGIS services, migrates and seeds them, then runs backend, frontend, and E2E checks. `alembic downgrade base` is tested only on a disposable database because it removes HanoiGO tables and trip data.

## Known limitations

- The catalog combines 150 curated places with 3,415 OpenStreetMap places; it is suitable for the MVP demo, but many prices and hours remain estimates. Fixed event windows are tied to their verified announcement, while recurring holiday windows are planning suggestions that should be refreshed against the official lunar/annual calendar before public travel advice. See the [audit](POI_DATA_AUDIT.md). Places added by the OpenStreetMap importer are crowd-sourced: names and coordinates come from OpenStreetMap, while prices, durations and default hours are category estimates that should be checked before public travel advice.
- OSRM road geometry is best effort; if unavailable, the map shows direct lines and a warning. Timeline travel time, distance, and fare use deterministic estimates, not live traffic or road-route metrics, so a displayed road distance may differ from the budget/timeline estimate. Each day's visiting order is first shaped by meal slots and opening hours, then shortened by a local search (reversing a segment, swapping two stops, moving a run of one to three stops) that runs until no move helps. A move must keep every stop inside its opening hours and meal slot and add no waiting, so a route never goes A → B → back to C when C is next to A and could be visited before B; a slightly later start of the day is accepted for a shorter route. When the order cannot avoid a detour because a meal slot fixes when a restaurant is visited, a meal may be swapped for an unused one of the same kind, scoring at most 5 points lower, that makes the day at least 0.5 km shorter. It is a practical heuristic, not a proven optimal tour, and distances are straight-line estimates rather than road routes. With the larger catalog the candidate pool keeps the 60 best-ranked attractions plus every feasible meal, so hundreds of nearby restaurants cannot crowd museums and temples out of a plan.
- Each stop starts as soon as the traveler arrives from the previous one. Waiting for an opening time or a meal slot (lunch 11:00–14:00, dinner from 17:00) is absorbed by staying longer at the earlier stop (up to +50%, or up to 3× the usual visit for sights and 2× for meals where a slot is fixed on both sides) or by starting it later, so leftover time ends up before the first stop rather than in the middle of the day. Gaps too long for that, and days that would end before dinner, get extra stops from the unused candidates; when nothing matching the interests fits, a nearby free park or lake is added. The scheduled visit length shown in the timeline can therefore exceed a place's usual duration. When the budget is nearly spent and every extra stop costs a ride the traveler cannot afford (for example a food-only motorbike trip on a tight budget in an outer district), a short wait or an early finish can remain.
- Photos (the Hoan Kiem Lake hero and the landmark story photos) are openly licensed Wikimedia Commons images (CC0, CC BY, CC BY-SA) stored in `frontend/public/images/hanoi`; their author and licence are kept in `frontend/src/data/hanoi-images.ts`. Every photo carries a credit line, and `/credits` lists them all. Option cards, seasonal cards, stays and timeline stops are text-only.
- Landmark stories live in `backend/data/place_stories.json`, written in Vietnamese and English from the public sources listed in each story (official heritage sites, UNESCO, Wikipedia and Vietnamese government pages). Legends are presented as legends. A story can link several catalog slugs for the same site (for example the curated lake and the OpenStreetMap Turtle Tower); tests check that every linked slug exists, that no place has two stories, and that both languages share the same structure and years. Visiting rules and opening hours in the tips can change and should be re-checked against the official source before publication.
- The weather signal uses the first trip day's afternoon forecast for ranking and scheduling; later-day hour-by-hour forecasts are not yet modeled. If weather is unavailable, planning continues with neutral weather scoring.
- Free-text lookup uses the public Nominatim endpoint only on explicit trip submission, with cache, an application User-Agent and a process-local 1.1-second interval. [OSM's policy](https://operations.osmfoundation.org/policies/nominatim/) prohibits autocomplete and heavy use. A production launch with many users needs a dedicated geocoding provider or self-hosted service; if lookup fails, the user can pick a map point, select device location, or use a built-in named start. Manually chosen coordinates use the MVP's broad Hanoi service rectangle rather than an exact administrative boundary.
- A budget remains a hard maximum. Best Match favors relevant experiences that make reasonable use of it, limits any one stop to roughly 45% of a multi-day budget when the catalog allows, and schedules at most one seated lunch and one seated dinner per day. Budget Friendly deliberately costs less. Because most catalog prices are estimates, planning keeps roughly 5% of the budget as headroom. The catalog cannot guarantee a spend close to every high budget for every interest or neighborhood, and the UI shows each option's budget usage.
- Car and motorbike fares are deterministic ride estimates rather than live provider prices. Google Maps links use walking, two-wheeler or driving directions; the availability of two-wheeler directions depends on Google Maps coverage in the traveler’s area.
- Walking distance is intentionally capped at 10 km per search and per planned day. This keeps walking routes practical; the planner may return fewer stops when the selected places cannot fit within that limit.
- Owner/share capability tokens limit saved-trip access; they are bearer secrets, so anyone with a share URL can view that trip. The browser stores the owner token in local storage. Accounts exist only for writing reviews; trips are not linked to them, so signing in does not show trips on another device, and a lost owner token cannot be recovered.
- The production generation limit is process-local and keyed to the direct client host. Multiple backend workers need a shared limiter and carefully configured proxy IP handling before an internet-scale deployment. Booking, payment, and chatbot remain out of scope.
- The API does not expose `Retry-After` to browsers (CORS `Access-Control-Expose-Headers`), so after `RATE_LIMITED` the plan form waits a fixed 60 seconds. The form caps the budget at 1,000,000,000 VND because the trip table stores it as a 32-bit integer; larger values used to fail as `DATABASE_UNAVAILABLE`.
- On the itinerary's Map tab the largest paint is a map tile, so its loading time depends on the tile server (OSM France by default, set with `NEXT_PUBLIC_MAP_TILE_URL`). Measured locally with 4× CPU throttling, other pages reach LCP in 0.2–1.4 s and the Map tab in 2.3–4 s; a production deployment should use a tile CDN or licensed provider.
- The single-page UI that the redesign replaced is kept in `legacy-ui-backup/` for reference; it is not built or tested and can be deleted.

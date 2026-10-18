import type { TripResponse, ApiError, RoadRouteResponse, AuthResponse, StoryDetail, StorySummary, Holiday, Place, Weather } from "@/types/trip";
import type { TripFormValues } from "@/schemas/trip";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const DUPLICATE_SUBMISSION_WINDOW_MS = 2_000;
let recentGeneration: {
  key: string; expiresAt: number; settled: boolean; promise: Promise<TripResponse>;
} | null = null;
export const START_COORDINATES = {
  "Hanoi Old Quarter": { latitude: 21.034, longitude: 105.85 },
  "Hoan Kiem Lake": { latitude: 21.0287, longitude: 105.8522 },
  "West Lake": { latitude: 21.052, longitude: 105.828 },
  "Temple of Literature": { latitude: 21.0284, longitude: 105.8356 },
} as const;

type Coordinate = { latitude: number; longitude: number };

export class ApiRequestError extends Error {
  constructor(
    readonly code: string, message: string, readonly details: string[] = [],
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export async function registerAccount(displayName: string, identifier: string, password: string): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE}/api/v1/auth/register`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName, identifier, password }),
  });
  return parseResponse<AuthResponse>(response);
}

export async function loginAccount(identifier: string, password: string): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  });
  return parseResponse<AuthResponse>(response);
}

async function resolveStartLocation(values: TripFormValues): Promise<Coordinate> {
  if (values.startLocationCoordinates) return values.startLocationCoordinates;
  const known = START_COORDINATES[values.startLocationName as keyof typeof START_COORDINATES];
  if (known) return known;
  const params = new URLSearchParams({ query: values.startLocationName.trim() });
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/v1/locations/resolve?${params}`);
  } catch {
    throw new ApiRequestError("LOCATION_SERVICE_UNAVAILABLE", "The address lookup service did not respond.");
  }
  const result = await parseResponse<{ latitude: number; longitude: number }>(response);
  return { latitude: result.latitude, longitude: result.longitude };
}

async function parseResponse<T>(response: Response): Promise<T> {
  // A proxy or an outage can answer with HTML or nothing at all.
  let data: unknown = null;
  try { data = await response.json(); } catch { data = null; }
  if (!response.ok) {
    const error = (data ?? {}) as ApiError;
    const suggestions = Array.isArray(error.error?.details) ?
      error.error.details.filter((item): item is string => typeof item === "string") : [];
    throw new ApiRequestError(
      error.error?.code ?? (response.status >= 500 ? "SERVICE_UNAVAILABLE" : "REQUEST_FAILED"),
      error.error?.message ?? "The request could not be completed.", suggestions,
    );
  }
  if (data === null) throw new ApiRequestError("REQUEST_FAILED", "The request could not be completed.");
  return data as T;
}

export function generateTrip(values: TripFormValues, signal?: AbortSignal): Promise<TripResponse> {
  const key = JSON.stringify(values);
  if (recentGeneration?.key === key && (
    !recentGeneration.settled || performance.now() < recentGeneration.expiresAt
  )) {
    return recentGeneration.promise;
  }
  const promise = resolveStartLocation(values).then((coordinates) => fetch(`${API_BASE}/api/v1/trips/generate`, {
    method: "POST", headers: { "Content-Type": "application/json" }, signal,
    body: JSON.stringify({
    language: values.language,
    startDate: values.startDate || null,
    days: values.days,
    travelerCount: values.travelerCount,
    budgetTotal: values.budgetTotal,
    startLocation: {
      name: values.startLocationName.trim(), ...coordinates,
    },
    interests: values.interests,
    travelMode: values.travelMode,
    travelRadiusMode: values.travelRadiusMode,
    pace: values.pace,
    experiencePreferences: values.experiencePreferences,
    dailyStartTime: values.dailyStartTime,
    dailyEndTime: values.dailyEndTime,
    }),
  })).then(parseResponse<TripResponse>);
  recentGeneration = { key, expiresAt: 0, settled: false, promise };
  void promise.then(() => {
    if (recentGeneration?.promise === promise) {
      recentGeneration.settled = true;
      recentGeneration.expiresAt = performance.now() + DUPLICATE_SUBMISSION_WINDOW_MS;
    }
  }, () => {
    if (recentGeneration?.promise === promise) recentGeneration = null;
  });
  return promise;
}

export async function fetchTrip(tripId: string, token: string): Promise<TripResponse> {
  const response = await fetch(`${API_BASE}/api/v1/trips/${encodeURIComponent(tripId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse<TripResponse>(response);
}

export async function createShareToken(tripId: string, ownerToken: string): Promise<string> {
  const response = await fetch(`${API_BASE}/api/v1/trips/${encodeURIComponent(tripId)}/share`, {
    method: "POST", headers: { Authorization: `Bearer ${ownerToken}` },
  });
  const data = await parseResponse<{ shareToken: string }>(response);
  return data.shareToken;
}

export async function fetchRoadRoute(
  points: { latitude: number; longitude: number }[],
): Promise<RoadRouteResponse> {
  const response = await fetch(`${API_BASE}/api/v1/routes/geometry`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ points }),
  });
  return parseResponse<RoadRouteResponse>(response);
}

export type ReplaceReason = "TOO_FAR" | "TOO_EXPENSIVE" | "NOT_INTERESTED" |
  "ALREADY_VISITED" | "PREFER_INDOOR" | "PREFER_LOCAL";
export type OptimizeStrategy = "REDUCE_COST" | "REDUCE_DISTANCE" | "PREFER_INDOOR" |
  "MORE_LOCAL" | "MORE_FOOD" | "MORE_CHECKIN" | "REGENERATE_DAY";

export async function replacePlace(
  tripId: string, itineraryId: string, itemId: string, reason: ReplaceReason, ownerToken: string,
): Promise<TripResponse> {
  const response = await fetch(`${API_BASE}/api/v1/trips/${tripId}/itineraries/${itineraryId}/items/${itemId}/replace`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({ reason }),
  });
  return parseResponse<TripResponse>(response);
}

export async function setPlaceLock(
  tripId: string, itineraryId: string, itemId: string, locked: boolean, ownerToken: string,
): Promise<TripResponse> {
  const response = await fetch(`${API_BASE}/api/v1/trips/${tripId}/itineraries/${itineraryId}/items/${itemId}/lock`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({ locked }),
  });
  return parseResponse<TripResponse>(response);
}

export async function submitPlaceReview(
  placeId: string, token: string, rating: number, comment: string,
): Promise<TripResponse["stayOptions"][number]> {
  const response = await fetch(`${API_BASE}/api/v1/places/${encodeURIComponent(placeId)}/reviews`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ rating, comment }),
  });
  return parseResponse<TripResponse["stayOptions"][number]>(response);
}

export async function optimizeTrip(
  tripId: string, itineraryId: string, strategy: OptimizeStrategy, ownerToken: string, dayNumber?: number,
): Promise<TripResponse> {
  const response = await fetch(`${API_BASE}/api/v1/trips/${tripId}/itineraries/${itineraryId}/optimize`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({ strategy, dayNumber }),
  });
  return parseResponse<TripResponse>(response);
}

export async function fetchStories(language: "en" | "vi"): Promise<StorySummary[]> {
  const response = await fetch(`${API_BASE}/api/v1/stories?language=${language}`);
  return parseResponse<StorySummary[]>(response);
}

export async function fetchStory(slug: string, language: "en" | "vi"): Promise<StoryDetail> {
  const response = await fetch(`${API_BASE}/api/v1/stories/${encodeURIComponent(slug)}?language=${language}`);
  return parseResponse<StoryDetail>(response);
}

export async function fetchWeather(latitude: number, longitude: number, day?: string): Promise<Weather> {
  const params = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude) });
  if (day) params.set("day", day);
  const response = await fetch(`${API_BASE}/api/v1/weather?${params}`);
  return parseResponse<Weather>(response);
}

export async function fetchHolidays(start: string, days: number, language: "en" | "vi"): Promise<Holiday[]> {
  const params = new URLSearchParams({ start, days: String(days), language });
  const response = await fetch(`${API_BASE}/api/v1/holidays?${params}`);
  return parseResponse<Holiday[]>(response);
}

export async function fetchPlace(placeId: string, language: "en" | "vi"): Promise<Place> {
  const response = await fetch(`${API_BASE}/api/v1/places/${encodeURIComponent(placeId)}?language=${language}`);
  return parseResponse<Place>(response);
}

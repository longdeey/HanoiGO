// Browser-only persistence. Every access is wrapped: private windows, blocked
// site data or quota errors only lose the convenience, never break a page.
import type { AuthUser, TripResponse } from "@/types/trip";
import type { TripFormValues } from "@/schemas/trip";

const OWNER_PREFIX = "hanoigo-owner-";
const SUMMARY_PREFIX = "hanoigo-trip-summary-";
const SHARE_PREFIX = "hanoigo-share-";
const READ_STORIES_KEY = "hanoigo-read-stories";
const AUTH_TOKEN_KEY = "hanoigo-auth-token";
const AUTH_USER_KEY = "hanoigo-auth-user";
const DRAFT_KEY = "hanoigo-plan-draft";

function local(): Storage | null {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
}
function session(): Storage | null {
  try { return typeof window === "undefined" ? null : window.sessionStorage; } catch { return null; }
}
function read(storage: Storage | null, key: string): string | null {
  try { return storage?.getItem(key) ?? null; } catch { return null; }
}
function write(storage: Storage | null, key: string, value: string | null): void {
  try {
    if (value === null) storage?.removeItem(key); else storage?.setItem(key, value);
  } catch { /* convenience only */ }
}
function readJson<T>(storage: Storage | null, key: string): T | null {
  const raw = read(storage, key);
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

// ── Trips on this device ────────────────────────────────────────────────
/** A small summary saved next to the owner token when a trip is created. */
export type TripSummary = {
  tripId: string;
  startDate: string | null;
  days: number;
  travelerCount: number | null;
  budgetTotal: number | null;
  startName: string | null;
  createdAt: string;
};

export function ownerToken(tripId: string): string | null {
  return read(local(), OWNER_PREFIX + tripId);
}

export function saveTrip(trip: TripResponse, summary: Omit<TripSummary, "tripId" | "createdAt"> & { createdAt?: string }): void {
  if (trip.ownerToken) write(local(), OWNER_PREFIX + trip.tripId, trip.ownerToken);
  saveTripSummary({ ...summary, tripId: trip.tripId, createdAt: summary.createdAt ?? new Date().toISOString() });
}

export function saveTripSummary(summary: TripSummary): void {
  write(local(), SUMMARY_PREFIX + summary.tripId, JSON.stringify(summary));
}

export function tripSummary(tripId: string): TripSummary | null {
  return readJson<TripSummary>(local(), SUMMARY_PREFIX + tripId);
}

/** Trip ids that have an owner token on this device. */
export function savedTripIds(): string[] {
  const storage = local();
  if (!storage) return [];
  const ids: string[] = [];
  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(OWNER_PREFIX)) ids.push(key.slice(OWNER_PREFIX.length));
    }
  } catch { return ids; }
  return ids;
}

/** The owner tokens of trips made on this device (to save them to an account). */
export function deviceTrips(): { tripId: string; ownerToken: string }[] {
  return savedTripIds().flatMap((tripId) => {
    const token = ownerToken(tripId);
    return token ? [{ tripId, ownerToken: token }] : [];
  });
}

/** Signing out leaves no trip of the account on this device. */
export function forgetAllTrips(): void {
  for (const tripId of savedTripIds()) forgetTrip(tripId);
}

export function forgetTrip(tripId: string): void {
  const storage = local();
  write(storage, OWNER_PREFIX + tripId, null);
  write(storage, SUMMARY_PREFIX + tripId, null);
  write(storage, SHARE_PREFIX + tripId, null);
}

export function savedShareUrl(tripId: string): string | null {
  return read(local(), SHARE_PREFIX + tripId);
}

export function saveShareUrl(tripId: string, url: string): void {
  write(local(), SHARE_PREFIX + tripId, url);
}

/** True when a saved trip covers today (drives the Trips badge). */
export function tripIsToday(summary: TripSummary, today: string): boolean {
  if (!summary.startDate) return false;
  const start = summary.startDate;
  const end = new Date(`${start}T00:00:00`);
  end.setDate(end.getDate() + Math.max(1, summary.days) - 1);
  const endIso = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
  return start <= today && today <= endIso;
}

// ── Stories ─────────────────────────────────────────────────────────────
export function readStories(): Set<string> {
  const stored = readJson<unknown>(local(), READ_STORIES_KEY);
  return new Set(Array.isArray(stored) ? stored.filter((item): item is string => typeof item === "string") : []);
}

export function markStoryRead(slug: string): Set<string> {
  const next = readStories().add(slug);
  write(local(), READ_STORIES_KEY, JSON.stringify([...next]));
  return next;
}

// ── Sign-in ─────────────────────────────────────────────────────────────
export function storedAuth(): { token: string; user: AuthUser } | null {
  const token = read(local(), AUTH_TOKEN_KEY);
  const user = readJson<AuthUser>(local(), AUTH_USER_KEY);
  if (!token || !user) return null;
  return { token, user };
}

export function saveAuth(token: string | null, user: AuthUser | null): void {
  write(local(), AUTH_TOKEN_KEY, token);
  write(local(), AUTH_USER_KEY, user ? JSON.stringify(user) : null);
}

// ── Plan form draft (this tab only, cleared after a trip is created) ────
export function planDraft(): Partial<TripFormValues> | null {
  return readJson<Partial<TripFormValues>>(session(), DRAFT_KEY);
}

export function savePlanDraft(values: Partial<TripFormValues> | null): void {
  write(session(), DRAFT_KEY, values ? JSON.stringify(values) : null);
}

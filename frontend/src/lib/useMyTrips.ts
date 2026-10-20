"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchMyTrips } from "@/services/api";
import { usePrefs } from "@/lib/prefs";
import type { TripSummary } from "@/lib/storage";

/** The trips saved to the signed-in account, newest first (empty when signed out). */
export function useMyTrips() {
  const { auth } = usePrefs();
  const query = useQuery({
    queryKey: ["my-trips", auth?.user.id],
    queryFn: () => fetchMyTrips(auth!.token),
    enabled: Boolean(auth),
    staleTime: 60 * 1000,
  });
  const trips: TripSummary[] = (query.data ?? []).map((trip) => ({
    tripId: trip.tripId, startDate: trip.startDate, days: trip.days, travelerCount: trip.travelerCount,
    budgetTotal: trip.budgetTotal, startName: trip.startName, createdAt: trip.createdAt,
  }));
  return { ...query, trips };
}

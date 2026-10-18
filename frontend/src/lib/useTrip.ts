"use client";

import { useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchTrip } from "@/services/api";
import { ownerToken } from "@/lib/storage";
import type { TripResponse } from "@/types/trip";

export const tripQueryKey = (tripId: string) => ["trip", tripId] as const;

function subscribeStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

/**
 * Loads a trip with the share token from the URL (read-only) or the owner
 * token saved on this device. A trip just created is already in the cache.
 */
export function useTrip(tripId: string) {
  const params = useSearchParams();
  const share = params.get("share");
  // undefined while hydrating (the server cannot see this device's token),
  // then the token itself; in-app navigation reads it on the first render.
  const owner = useSyncExternalStore<string | null | undefined>(subscribeStorage, () => ownerToken(tripId), () => undefined);
  const token = share ?? owner ?? null;
  const query = useQuery({
    queryKey: tripQueryKey(tripId),
    queryFn: () => fetchTrip(tripId, token as string),
    enabled: owner !== undefined && Boolean(token),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  return {
    trip: query.data,
    share,
    readOnly: Boolean(share) || !owner,
    ownerToken: share ? null : owner ?? null,
    /** No token at all on this device and none in the link. */
    missingToken: owner !== undefined && !token,
    isPending: owner === undefined || (Boolean(token) && query.isPending),
    error: query.error,
    refetch: query.refetch,
  };
}

/** Replace the cached trip after a modification (replace, optimize). */
export function useSetTrip(tripId: string) {
  const client = useQueryClient();
  return (trip: TripResponse) => client.setQueryData(tripQueryKey(tripId), trip);
}

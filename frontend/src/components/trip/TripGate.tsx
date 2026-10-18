"use client";

import { useRouter } from "next/navigation";
import { Eye } from "@phosphor-icons/react";

import type { TripResponse } from "@/types/trip";
import { ApiRequestError } from "@/services/api";
import { usePrefs } from "@/lib/prefs";
import { savePlanDraft } from "@/lib/storage";
import { budgetTotal } from "@/lib/trip";
import type { useTrip } from "@/lib/useTrip";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EmptyState, ErrorState, Skeleton, apiErrorMessage } from "@/components/ui/States";

/** Loading, missing-token and error states shared by the trip pages (spec §8.13). */
export function TripGate({ state, children }: {
  state: ReturnType<typeof useTrip>; children: (trip: TripResponse) => React.ReactNode;
}) {
  const { tr } = usePrefs();
  if (state.isPending) return <div role="status" className="mx-auto max-w-page space-y-4 px-4 pt-6 sm:px-6 lg:px-10">
    <span className="sr-only">{tr("Loading...")}</span>
    <Skeleton className="h-10 w-2/3" /><Skeleton className="h-6 w-1/2" />
    <div className="grid gap-4 lg:grid-cols-3">{[0, 1, 2].map((key) => <Skeleton key={key} className="h-72" />)}</div>
  </div>;
  if (state.missingToken) return <EmptyState title={tr("This trip cannot be opened on this device.")}
    body={tr("Trips are saved only in the browser that created them.")}
    action={<ButtonLink href="/plan" variant="primary">{tr("Plan my trip")}</ButtonLink>} />;
  if (state.error) {
    const denied = state.error instanceof ApiRequestError && (state.error.code === "TRIP_ACCESS_DENIED" || state.error.code === "NOT_FOUND");
    return denied ? <EmptyState title={tr("This link no longer opens.")}
      body={tr("The person who shared it may have created a new one.")}
      action={<ButtonLink href="/plan" variant="primary">{tr("Plan my trip")}</ButtonLink>} />
      : <div className="mx-auto max-w-xl px-4 pt-12"><ErrorState message={apiErrorMessage(state.error, tr)} onRetry={() => void state.refetch()} /></div>;
  }
  return state.trip ? <>{children(state.trip)}</> : null;
}

/** Shown on read-only (shared) trips. Prefills only what the API returns. */
export function ReadOnlyBanner({ trip }: { trip?: TripResponse }) {
  const { tr } = usePrefs();
  const router = useRouter();
  function planOwn() {
    const option = trip?.options[0];
    if (option && trip) {
      savePlanDraft({
        days: option.days.length, budgetTotal: budgetTotal(option),
        ...(trip.startLatitude !== undefined && trip.startLongitude !== undefined ? {
          startLocationName: `${trip.startLatitude.toFixed(5)}, ${trip.startLongitude.toFixed(5)}`,
          startLocationCoordinates: { latitude: trip.startLatitude, longitude: trip.startLongitude },
        } : {}),
      });
    }
    router.push("/plan?step=1");
  }
  return <div className="mt-4 flex flex-wrap items-center gap-3 rounded-card bg-sign-blue-soft p-4 text-sign-blue">
    <Eye size={20} aria-hidden />
    <p className="flex-1 font-medium">{tr("You are viewing a shared itinerary.")}</p>
    <Button variant="secondary" onClick={planOwn}>{tr("Plan your own trip")}</Button>
  </div>;
}

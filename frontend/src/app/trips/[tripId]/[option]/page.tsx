import { Suspense } from "react";
import type { Metadata } from "next";

import { TripItinerary } from "@/components/trip/TripItinerary";

export const metadata: Metadata = { title: "Itinerary" };

export default async function ItineraryPage({ params }: { params: Promise<{ tripId: string; option: string }> }) {
  const { tripId, option } = await params;
  return <Suspense><TripItinerary tripId={decodeURIComponent(tripId)} optionId={decodeURIComponent(option)} /></Suspense>;
}

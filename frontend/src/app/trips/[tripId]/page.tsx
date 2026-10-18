import { Suspense } from "react";
import type { Metadata } from "next";

import { TripCompare } from "@/components/trip/TripCompare";

export const metadata: Metadata = { title: "Trip" };

export default async function TripPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  return <Suspense><TripCompare tripId={decodeURIComponent(tripId)} /></Suspense>;
}

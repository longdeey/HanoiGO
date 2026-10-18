import type { Metadata } from "next";

import { PlacePage } from "@/components/places/PlacePage";

export const metadata: Metadata = { title: "Place" };

export default async function Place({ params }: { params: Promise<{ placeId: string }> }) {
  const { placeId } = await params;
  return <PlacePage placeId={decodeURIComponent(placeId)} />;
}

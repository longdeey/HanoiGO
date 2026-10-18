import type { Place, TripResponse } from "@/types/trip";

export function googleMapsDirectionsUrl(place: Place, travelMode: TripResponse["travelMode"]): string {
  const mode = travelMode === "walking" ? "walking" :
    travelMode === "motorbike" ? "two-wheeler" : "driving";
  const params = new URLSearchParams({
    api: "1", destination: `${place.latitude},${place.longitude}`,
    travelmode: mode, dir_action: "navigate",
  });
  return `https://www.google.com/maps/dir/?${params}`;
}

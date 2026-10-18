"use client";

import { useEffect, useState } from "react";
import { divIcon } from "leaflet";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";

import { translate, type Language } from "@/i18n";
import type { Coordinates } from "@/services/locations";
import { mapAttribution, mapTileUrl } from "@/services/map-provider";

type Props = {
  selected: Coordinates | null;
  onPick: (coordinates: Coordinates) => void;
  language: Language;
};

const pinIcon = divIcon({
  className: "", html: '<span class="map-marker">●</span>',
  iconSize: [34, 34], iconAnchor: [17, 17],
});

function ClickToPick({ onPick }: { onPick: Props["onPick"] }) {
  useMapEvents({ click: (event) => onPick({
    latitude: event.latlng.lat, longitude: event.latlng.lng,
  }) });
  return null;
}

function CenterOnSelection({ selected }: { selected: Coordinates | null }) {
  const map = useMap();
  useEffect(() => {
    if (selected) map.setView([selected.latitude, selected.longitude], Math.max(map.getZoom(), 12));
  }, [map, selected]);
  return null;
}

export default function StartLocationPicker({ selected, onPick, language }: Props) {
  const [tileFailed, setTileFailed] = useState(false);
  return <div className="relative mt-3 overflow-hidden rounded-2xl border border-brand-line">
    <p className="bg-white px-3 py-2 text-sm text-brand-maroon">{translate(language, "Tap the map to set your Hanoi starting point.")}</p>
    {tileFailed && <p role="status" className="absolute left-3 right-3 top-14 z-[1000] rounded-lg bg-amber-50 p-2 text-xs text-amber-900">{translate(language, "Map tiles are unavailable; you can still pick a point.")}</p>}
    <MapContainer center={[21.034, 105.85]} zoom={10} scrollWheelZoom={false}
      className="h-64 w-full" aria-label={translate(language, "Hanoi starting point map")}>
      <TileLayer attribution={mapAttribution}
        url={mapTileUrl}
        eventHandlers={{ tileerror: () => setTileFailed(true) }} />
      <ClickToPick onPick={onPick} />
      <CenterOnSelection selected={selected} />
      {selected && <Marker position={[selected.latitude, selected.longitude]} icon={pinIcon} />}
    </MapContainer>
  </div>;
}

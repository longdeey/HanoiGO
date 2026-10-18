"use client";

import { useEffect, useState } from "react";
import { divIcon, latLngBounds } from "leaflet";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import { useQuery } from "@tanstack/react-query";

import type { ItineraryItem } from "@/types/trip";
import { translate, type Language } from "@/i18n";
import { fetchRoadRoute } from "@/services/api";
import { mapAttribution, mapTileUrl } from "@/services/map-provider";

type Props = {
  items: ItineraryItem[];
  startLocation?: { latitude: number; longitude: number };
  selectedId: string | null;
  onSelect: (id: string) => void;
  language: Language;
};

function FitRoute({ items, startLocation }: { items: ItineraryItem[]; startLocation?: { latitude: number; longitude: number } }) {
  const map = useMap();
  useEffect(() => {
    if (items.length === 0) return;
    if (items.length === 1) {
      map.setView([items[0].place.latitude, items[0].place.longitude], 14);
      return;
    }
    const points: [number, number][] = items.map((item) => [
      item.place.latitude, item.place.longitude,
    ]);
    if (startLocation) points.push([startLocation.latitude, startLocation.longitude]);
    const bounds = latLngBounds(points);
    map.fitBounds(bounds.pad(0.25), { maxZoom: 14 });
  }, [items, map, startLocation]);
  return null;
}

function markerIcon(sequence: number, active: boolean, mustSee: boolean) {
  return divIcon({
    className: "",
    html: `<span class="map-marker${mustSee ? " map-marker-must-see" : ""}${active ? " map-marker-active" : ""}">${sequence}</span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

function startMarkerIcon() {
  return divIcon({
    className: "",
    html: '<span class="map-marker map-marker-start">0</span>',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

export default function ItineraryMap({ items, startLocation, selectedId, onSelect, language }: Props) {
  const [tileFailed, setTileFailed] = useState(false);
  const routeKey = items.map((item) => `${item.place.latitude},${item.place.longitude}`).join(";");
  const routeQuery = useQuery({
    queryKey: ["road-route", routeKey],
    queryFn: () => fetchRoadRoute(items.map((item) => ({
      latitude: item.place.latitude, longitude: item.place.longitude,
    }))),
    enabled: items.length >= 2,
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
  if (items.length === 0) {
    return <div className="grid h-80 place-items-center rounded-2xl bg-brand-sand text-brand-muted">{translate(language, "No route for this day.")}</div>;
  }
  const positions: [number, number][] = items.map((item) => [
    item.place.latitude, item.place.longitude,
  ]);
  const roadPositions: [number, number][] | null = routeQuery.data?.source === "osrm" ?
    routeQuery.data.coordinates.map((point) => [point.latitude, point.longitude]) : null;
  return <div className="relative overflow-hidden rounded-2xl border border-brand-line">
    {tileFailed && <p role="status" className="absolute left-3 right-3 top-3 z-[1000] rounded-lg bg-amber-50 p-2 text-sm text-amber-900">{translate(language, "Map tiles are unavailable. Route and numbered places remain visible.")}</p>}
    {(routeQuery.isError || routeQuery.data?.warning) && <p role="status" className="absolute bottom-3 left-3 right-3 z-[1000] rounded-lg bg-amber-50 p-2 text-sm text-amber-900">{translate(language, "Road routing unavailable; showing direct line")}</p>}
    {routeQuery.data?.source === "osrm" && <p className="absolute bottom-3 left-3 z-[1000] rounded-lg bg-white/90 p-2 text-xs font-semibold text-brand-maroon">{translate(language, "Road route")}: {routeQuery.data.roadDistanceKm?.toFixed(1)} km</p>}
    <MapContainer center={positions[0]} zoom={13} scrollWheelZoom={false} className="h-80 w-full md:h-[440px]">
      <TileLayer
        attribution={mapAttribution}
        url={mapTileUrl}
        eventHandlers={{ tileerror: () => setTileFailed(true) }}
      />
      <Polyline positions={roadPositions ?? positions} pathOptions={{ color: "#c8102e", weight: 4, opacity: 0.85 }} />
      {startLocation && <Marker position={[startLocation.latitude, startLocation.longitude]} icon={startMarkerIcon()}><Popup><strong>0. {translate(language, "Starting point")}</strong></Popup></Marker>}
      {items.map((item) => <Marker
        key={item.id}
        position={[item.place.latitude, item.place.longitude]}
        icon={markerIcon(item.sequence, selectedId === item.id,
          item.place.highlightLevel === "must_see")}
        eventHandlers={{ click: () => onSelect(item.id) }}
      ><Popup><strong>{item.sequence}. {item.place.name}</strong><br />{item.startTime} – {item.endTime}</Popup></Marker>)}
      <FitRoute items={items} startLocation={startLocation} />
    </MapContainer>
  </div>;
}

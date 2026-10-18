"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { divIcon, latLngBounds, type DivIcon, type Marker as LeafletMarker, type Polyline as LeafletPolyline } from "leaflet";
import { MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import { useQuery } from "@tanstack/react-query";
import { useReducedMotion } from "motion/react";
import { Warning } from "@phosphor-icons/react";

import type { ItineraryItem } from "@/types/trip";
import { usePrefs } from "@/lib/prefs";
import { fetchRoadRoute } from "@/services/api";
import { mapAttribution, mapTileUrl } from "@/services/map-provider";

type Point = { latitude: number; longitude: number };
type Props = {
  items: ItineraryItem[];
  dayNumber: number;
  startLocation?: Point;
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string;
  follow?: "center" | "inside";
};

/** Resolve a day colour token to a concrete colour (SVG attributes cannot use var()). */
function useDayColor(dayNumber: number): string {
  const [color, setColor] = useState("#1F4FA3");
  useEffect(() => {
    const read = () => setColor(getComputedStyle(document.documentElement)
      .getPropertyValue(`--day-${((dayNumber - 1) % 5) + 1}`).trim() || "#1F4FA3");
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", read);
    return () => { observer.disconnect(); media.removeEventListener("change", read); };
  }, [dayNumber]);
  return color;
}

/** Draw a polyline with stroke-dashoffset (M13). Fallback lines stay dashed. */
export function drawRoute(line: LeafletPolyline, reduce: boolean, dashed: boolean) {
  const path = line.getElement() as SVGPathElement | undefined;
  if (!path || reduce || typeof path.getTotalLength !== "function") return;
  const length = path.getTotalLength();
  path.style.strokeDasharray = `${length}`;
  path.style.strokeDashoffset = `${length}`;
  path.getBoundingClientRect(); // force a style recalculation before animating
  path.style.transition = "stroke-dashoffset 800ms cubic-bezier(0.05, 0.7, 0.1, 1)";
  path.style.strokeDashoffset = "0";
  path.addEventListener("transitionend", () => {
    path.style.transition = "";
    path.style.strokeDashoffset = "";
    path.style.strokeDasharray = dashed ? "6 6" : "";
  }, { once: true });
}

function stationIcon(label: string, classes: string, color: string, appearIndex?: number) {
  // 28 px station inside a 44 px transparent hit area (spec §6.7). On the
  // day's first draw the stations appear one after another (M13).
  const appear = appearIndex === undefined ? "" : ` station-appear" style="--station-color:${color};animation-delay:${300 + appearIndex * 80}ms`;
  return divIcon({
    className: "",
    html: appear
      ? `<span class="station-icon"><span class="station ${classes}${appear}">${label}</span></span>`
      : `<span class="station-icon"><span class="station ${classes}" style="--station-color:${color}">${label}</span></span>`,
    iconSize: [44, 44], iconAnchor: [22, 22],
  });
}

// Shared by FlyToDay and RouteLine: when the current flight ends.
const flight = { until: 0 };

function FlyToDay({ points, dayNumber }: { points: [number, number][]; dayNumber: number }) {
  const map = useMap();
  const reduce = useReducedMotion();
  const key = `${dayNumber}:${points.map((point) => point.join(",")).join(";")}`;
  // A layout effect runs before the line's own effect adds it to the map, so
  // the line knows a flight has started and waits for it (M14).
  useLayoutEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) { map.setView(points[0], 15, { animate: false }); return; }
    const bounds = latLngBounds(points);
    if (reduce) { map.fitBounds(bounds, { animate: false, padding: [32, 32], maxZoom: 16 }); return; }
    // M14: the map flies to the day; the line is drawn once the flight ends.
    flight.until = Date.now() + 850;
    map.flyToBounds(bounds, { duration: 0.8, padding: [32, 32], maxZoom: 16 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map, reduce]);
  return null;
}

/** The day's line. It draws itself when added, after any flight in progress (M13). */
function RouteLine({ positions, color, dashed }: { positions: [number, number][]; color: string; dashed: boolean }) {
  const map = useMap();
  const reduce = useReducedMotion();
  return <Polyline positions={positions}
    pathOptions={{ color, weight: 5, opacity: 1, lineCap: "round", lineJoin: "round", dashArray: dashed ? "6 6" : undefined }}
    eventHandlers={{ add: (event) => {
      const line = event.target as LeafletPolyline;
      const draw = () => drawRoute(line, Boolean(reduce), dashed);
      if (Date.now() < flight.until) map.once("moveend", draw); else draw();
    } }} />;
}

/**
 * "center" pans to the chosen stop (M20, the phone card rail); "inside" only
 * nudges the map when the stop is off screen (desktop hover and focus).
 */
function PanToSelected({ point, follow }: { point: [number, number] | null; follow: "center" | "inside" }) {
  const map = useMap();
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!point) return;
    if (follow === "center") map.panTo(point, { animate: !reduce, duration: 0.5 });
    else map.panInside(point, { padding: [48, 48], animate: !reduce });
  }, [map, point, reduce, follow]);
  return null;
}

export default function RouteMap({ items, dayNumber, startLocation, selectedId, onSelect, className = "", follow = "inside" }: Props) {
  const { tr } = usePrefs();
  const color = useDayColor(dayNumber);
  const [tileFailed, setTileFailed] = useState(false);
  const stops = useMemo(() => items.map((item) => [item.place.latitude, item.place.longitude] as [number, number]), [items]);
  const routePoints = useMemo(() => [
    ...(startLocation ? [startLocation] : []),
    ...items.map((item) => ({ latitude: item.place.latitude, longitude: item.place.longitude })),
  ], [items, startLocation]);
  const routeKey = routePoints.map((point) => `${point.latitude},${point.longitude}`).join(";");
  const road = useQuery({
    queryKey: ["road-route", routeKey],
    queryFn: () => fetchRoadRoute(routePoints),
    enabled: routePoints.length >= 2,
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
  const fallback = road.isError || (road.data !== undefined && road.data.source !== "osrm");
  const positions: [number, number][] = road.data?.source === "osrm"
    ? road.data.coordinates.map((point) => [point.latitude, point.longitude])
    : routePoints.map((point) => [point.latitude, point.longitude]);
  const allPoints: [number, number][] = [...(startLocation ? [[startLocation.latitude, startLocation.longitude] as [number, number]] : []), ...stops];
  const selected = items.find((item) => item.id === selectedId);

  // Icons are kept per stop (not rebuilt on every selection), so the station
  // element stays and its scale and halo transition smoothly (M15).
  const icons = useRef(new Map<string, DivIcon>());
  const markers = useRef(new Map<string, LeafletMarker>());
  const iconFor = (item: ItineraryItem, index: number) => {
    const mustSee = item.place.highlightLevel === "must_see";
    const classes = [mustSee ? "station-must" : "", item.place.story ? "station-story" : ""].join(" ").trim();
    const key = `${item.id}|${item.sequence}|${classes}|${color}`;
    let icon = icons.current.get(key);
    if (!icon) { icon = stationIcon(String(item.sequence), classes, color, index); icons.current.set(key, icon); }
    return icon;
  };
  const startIcon = useMemo(() => stationIcon("0", "station-start", color), [color]);
  useEffect(() => {
    markers.current.forEach((marker, id) => marker.getElement()?.querySelector(".station")?.classList.toggle("station-active", id === selectedId));
  }, [selectedId, items]);

  if (items.length === 0) {
    return <div className={`grid place-items-center rounded-card bg-paper-sunken text-ink-muted ${className}`}>{tr("No route for this day.")}</div>;
  }
  return <div className={`relative overflow-hidden rounded-card border border-line shadow-float ${className}`}>
    <MapContainer center={stops[0]} zoom={14} scrollWheelZoom={false} className="map-neutral h-full w-full"
      aria-label={`${tr("Map of day")} ${dayNumber}`}>
      <TileLayer attribution={mapAttribution} url={mapTileUrl} eventHandlers={{ tileerror: () => setTileFailed(true) }} />
      {/* A white casing under the day's line keeps it readable over the coloured map. */}
      {road.isFetched || road.isError ? <>
        <Polyline positions={positions} interactive={false} className="route-casing" pathOptions={{ color: "#FFFFFF", weight: 9, opacity: 0.85, lineCap: "round", lineJoin: "round" }} />
        <RouteLine key={`${routeKey}:${fallback}:${color}`} positions={positions} color={color} dashed={fallback} />
      </> : null}
      {/* The start does nothing on tap, so it is a labelled picture, not a button. */}
      {startLocation && <Marker position={[startLocation.latitude, startLocation.longitude]} icon={startIcon}
        interactive={false} keyboard={false}
        eventHandlers={{ add: (event) => {
          const element = event.target.getElement();
          element?.setAttribute("role", "img");
          element?.setAttribute("aria-label", `0. ${tr("Starting point")}`);
        } }} />}
      {items.map((item, index) => {
        const mustSee = item.place.highlightLevel === "must_see";
        const label = [`${item.sequence}. ${item.place.name}`, mustSee ? tr("must see") : null, item.place.story ? tr("has a story") : null]
          .filter(Boolean).join(", ");
        return <Marker key={item.id} position={[item.place.latitude, item.place.longitude]} keyboard
          icon={iconFor(item, index)}
          eventHandlers={{
            click: () => onSelect(item.id),
            keypress: (event) => { if ((event.originalEvent as KeyboardEvent).key === "Enter") onSelect(item.id); },
            add: (event) => {
              const marker = event.target as LeafletMarker;
              markers.current.set(item.id, marker);
              const element = marker.getElement();
              element?.setAttribute("aria-label", label);
              element?.querySelector(".station")?.classList.toggle("station-active", item.id === selectedId);
            },
            remove: () => { markers.current.delete(item.id); },
          }} />;
      })}
      <FlyToDay points={allPoints} dayNumber={dayNumber} />
      <PanToSelected point={selected ? [selected.place.latitude, selected.place.longitude] : null} follow={follow} />
    </MapContainer>
    {fallback && <p role="status" className="type-small absolute left-3 top-3 z-[500] flex items-center gap-2 rounded-control bg-wall-yellow-soft px-3 py-2 font-medium text-warn-ink shadow-float">
      <Warning size={20} aria-hidden />{tr("Connecting the places with straight lines")}</p>}
    {tileFailed && <p role="status" className="type-small absolute inset-x-3 bottom-8 z-[500] rounded-control bg-paper p-2 text-ink-muted shadow-float">
      {tr("Map tiles are unavailable. Route and numbered places remain visible.")}</p>}
    {road.data?.source === "osrm" && road.data.roadDistanceKm !== null && <p className="type-caption sr-only">{tr("Road route")}: {road.data.roadDistanceKm.toFixed(1)} km</p>}
  </div>;
}

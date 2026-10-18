"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { MapPin, X } from "@phosphor-icons/react";

import { usePrefs } from "@/lib/prefs";
import { isWithinHanoiServiceArea, type Coordinates } from "@/services/locations";
import { mapAttribution, mapTileUrl } from "@/services/map-provider";
import { Button } from "@/components/ui/Button";

const HANOI_CENTER: Coordinates = { latitude: 21.034, longitude: 105.85 };

function TrackCenter({ onMove, onLift }: { onMove: (center: Coordinates) => void; onLift: (lifted: boolean) => void }) {
  const map = useMapEvents({
    movestart: () => onLift(true),
    move: () => { const center = map.getCenter(); onMove({ latitude: center.lat, longitude: center.lng }); },
    moveend: () => { onLift(false); const center = map.getCenter(); onMove({ latitude: center.lat, longitude: center.lng }); },
    // A tap also moves the pin there, for people who prefer tapping to dragging.
    click: (event) => map.panTo(event.latlng),
  });
  return null;
}

function FixSize() {
  const map = useMap();
  useEffect(() => { const timer = window.setTimeout(() => map.invalidateSize(), 50); return () => window.clearTimeout(timer); }, [map]);
  return null;
}

/**
 * Full-screen "choose on map" (spec §8.3): the pin stays in the middle and the
 * map moves underneath. There is no reverse geocoding API, so only the
 * coordinates are shown, never a guessed street name.
 */
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function PinPicker({ initial, onPick, onClose }: {
  initial: Coordinates | null; onPick: (coordinates: Coordinates) => void; onClose: () => void;
}) {
  const { tr, language } = usePrefs();
  const [center, setCenter] = useState<Coordinates>(initial ?? HANOI_CENTER);
  const [lifted, setLifted] = useState(false);
  const [tileFailed, setTileFailed] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const opener = document.activeElement;
    close.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { onClose(); return; }
      if (event.key !== "Tab" || !dialog.current) return;
      const items = [...dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((item) => item.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [onClose]);
  const inside = isWithinHanoiServiceArea(center);
  const format = (value: number) => value.toLocaleString(language === "vi" ? "vi-VN" : "en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  return createPortal(<div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="pin-title" className="fixed inset-0 z-50 flex flex-col bg-paper">
    <div className="flex h-14 items-center gap-2 border-b border-line px-2">
      <button ref={close} type="button" onClick={onClose} aria-label={tr("Close")} className="press grid h-11 w-11 place-items-center rounded-control">
        <X size={24} aria-hidden />
      </button>
      <h2 id="pin-title" className="type-h3">{tr("Choose a starting point")}</h2>
    </div>
    <div className="relative flex-1">
      <MapContainer center={[center.latitude, center.longitude]} zoom={initial ? 15 : 12} className="map-neutral h-full w-full"
        aria-label={tr("Hanoi starting point map")}>
        <TileLayer attribution={mapAttribution} url={mapTileUrl} eventHandlers={{ tileerror: () => setTileFailed(true) }} />
        <TrackCenter onMove={setCenter} onLift={setLifted} />
        <FixSize />
      </MapContainer>
      {/* The fixed pin (M08): lifts 8 px while the map moves, drops back on release. */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-[500] -translate-x-1/2 -translate-y-full" aria-hidden>
        <div className="pin" data-lifted={lifted}><MapPin size={44} weight="fill" className="text-ink" /></div>
        <div className="pin-shadow mx-auto -mt-1 h-1.5 w-4 rounded-full bg-[rgb(28_30_38/0.35)]" />
      </div>
      {tileFailed && <p role="status" className="type-small absolute inset-x-3 top-3 z-[500] rounded-control bg-wall-yellow-soft p-2 text-warn-ink">
        {tr("Map tiles are unavailable; you can still pick a point.")}</p>}
    </div>
    <div className="space-y-3 border-t border-line p-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
      <p className="type-small text-ink-muted">{tr("Drag the map to place the pin")}</p>
      <p className="tnum text-lg font-semibold" aria-live="polite">{format(center.latitude)}, {format(center.longitude)}</p>
      {!inside && <p role="alert" className="type-small text-sign-red-text">{tr("Choose a point within the Hanoi service area.")}</p>}
      <Button variant="primary" className="w-full" disabled={!inside} onClick={() => onPick(center)}>{tr("Use this point")}</Button>
    </div>
  </div>, document.body);
}

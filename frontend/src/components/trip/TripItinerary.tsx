"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { preconnect } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { ArrowsClockwise, CaretLeft, CloudRain, CloudSlash, PencilSimple, ShareNetwork, SquaresFour, Sun } from "@phosphor-icons/react";

import type { ItineraryItem, ItineraryOption, TripResponse, Weather } from "@/types/trip";
import { createShareToken, fetchWeatherDays, optimizeTrip, replacePlace, type OptimizeStrategy, type ReplaceReason } from "@/services/api";
import { mapTileOrigin } from "@/services/map-provider";
import { usePrefs } from "@/lib/prefs";
import { nameLang } from "@/lib/lang";
import { spring } from "@/lib/motion";
import { useSetTrip, useTrip } from "@/lib/useTrip";
import { formatDateRange, formatDayShort, formatDuration, formatMoney } from "@/lib/format";
import { savePlanDraft, saveShareUrl, savedShareUrl, tripSummary } from "@/lib/storage";
import { OPTION_LABELS, budgetTotal, dayColor, editPrefill, optionHref, tripHref } from "@/lib/trip";
import { usePageChrome } from "@/components/shell/chrome";
import { Button } from "@/components/ui/Button";
import { Menu } from "@/components/ui/Menu";
import { StreetPlate } from "@/components/ui/Signboard";
import { EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { RunningNumber } from "@/components/ui/RunningNumber";
import { BudgetMeter } from "./Meters";
import { DayTimeline } from "./Timeline";
import { BudgetBreakdown, StayList } from "./BudgetAndStays";
import { OptimizeSheet, ReplaceSheet, ShareSheet, StopDetails, StopSheet } from "./Sheets";
import { ReadOnlyBanner, TripGate } from "./TripGate";

const loadRouteMap = () => import("@/components/map/RouteMap");
const RouteMap = dynamic(loadRouteMap, {
  ssr: false, loading: () => <div className="skeleton h-full w-full" aria-hidden />,
});

type View = "timeline" | "map" | "budget" | "stays";
const VIEWS: { value: View; label: string }[] = [
  { value: "timeline", label: "Itinerary" }, { value: "map", label: "Map" },
  { value: "budget", label: "Cost" }, { value: "stays", label: "Stays" },
];
const RAIN_THRESHOLD = 0.6;

const DESKTOP = "(min-width: 1024px)";
function subscribeDesktop(onChange: () => void) {
  const query = window.matchMedia(DESKTOP);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
/** Known on the first client render (false on the server and while hydrating). */
function useIsDesktop(): boolean {
  return useSyncExternalStore(subscribeDesktop, () => window.matchMedia(DESKTOP).matches, () => false);
}

export function TripItinerary({ tripId, optionId }: { tripId: string; optionId: string }) {
  const { tr } = usePrefs();
  const state = useTrip(tripId);
  // The map is the largest paint on phone (Map tab) and desktop: fetch its code
  // and open the tile connection while the trip itself is still loading.
  if (mapTileOrigin) preconnect(mapTileOrigin);
  useEffect(() => { void loadRouteMap(); }, []);
  const option = state.trip?.options.find((item) => item.id === optionId);
  const desktopView = useIsDesktop();
  // M12: the option name from the comparison becomes this page's title: the
  // header on the desktop, the top bar on the phone.
  usePageChrome({ title: option ? tr(OPTION_LABELS[option.type]) : tr("Itinerary"), backHref: tripHref(tripId, state.share),
    titleLayoutId: desktopView ? undefined : `option-title-${optionId}` });
  return <TripGate state={state}>{(trip) => {
    const current = trip.options.find((item) => item.id === optionId);
    if (!current) return <EmptyState title={tr("This option is no longer in the trip.")}
      action={<Button variant="secondary" onClick={() => window.location.assign(tripHref(tripId, state.share))}>{tr("See the 3 options")}</Button>} />;
    return <ItineraryBody trip={trip} option={current} share={state.share} readOnly={state.readOnly} ownerToken={state.ownerToken} />;
  }}</TripGate>;
}

function ItineraryBody({ trip, option, share, readOnly, ownerToken }: {
  trip: TripResponse; option: ItineraryOption; share: string | null; readOnly: boolean; ownerToken: string | null;
}) {
  const { tr, language } = usePrefs();
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const setTrip = useSetTrip(trip.tripId);
  const desktop = useIsDesktop();
  const dayCount = option.days.length;
  const dayNumber = Math.min(dayCount, Math.max(1, Number(params.get("day")) || 1));
  const requestedView = (params.get("view") as View | null) ?? "timeline";
  const view: View = VIEWS.some((item) => item.value === requestedView) ? (desktop && requestedView === "map" ? "timeline" : requestedView) : "timeline";
  const day = option.days.find((item) => item.dayNumber === dayNumber) ?? option.days[0];
  const start = trip.startLatitude !== undefined && trip.startLongitude !== undefined ? { latitude: trip.startLatitude, longitude: trip.startLongitude } : undefined;
  const summary = tripSummary(trip.tripId);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ItineraryItem | null>(null);
  // Desktop: the chosen stop expands in place (M16); the phone uses a sheet.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replacing, setReplacing] = useState<ItineraryItem | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const grown = useRef(new Set<number>());
  const stops = useRef(new Map<string, HTMLDivElement>());
  useEffect(() => { setShareUrl(savedShareUrl(trip.tripId)); }, [trip.tripId]);
  useEffect(() => { setSelectedId(null); }, [dayNumber]);
  // On desktop the map is always visible, so view=map means the timeline (spec §4.6).
  useEffect(() => {
    if (desktop && requestedView === "map") navigate({ view: "timeline" }, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desktop, requestedView]);
  const grow = !grown.current.has(dayNumber);
  useEffect(() => { grown.current.add(dayNumber); }, [dayNumber]);
  // M14: +1 when moving to a later day, -1 to an earlier one, 0 on first view.
  const shownDay = useRef(dayNumber);
  const dayDirection = dayNumber === shownDay.current ? 0 : dayNumber > shownDay.current ? 1 : -1;
  useEffect(() => { shownDay.current = dayNumber; setExpandedId(null); }, [dayNumber]);

  // M30: once the page scrolls, the header's second line folds away. The
  // gap between the two thresholds stops it flickering at the boundary.
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const onScroll = () => setCompact((was) => (was ? window.scrollY > 16 : window.scrollY > 64));
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  // The header and day bar stay under the top bar, so focused stops scroll
  // clear of them (WCAG 2.4.11) and the desktop map sits just below.
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = bar.current;
    if (!element) return;
    const root = document.documentElement;
    const update = () => {
      root.style.setProperty("--itinerary-bar", `${element.offsetHeight}px`);
      root.style.scrollPaddingTop = `calc(var(--topbar-h) + ${element.offsetHeight + 16}px)`;
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => { observer.disconnect(); root.style.removeProperty("--itinerary-bar"); root.style.scrollPaddingTop = ""; };
  }, []);

  // One afternoon forecast per trip day; days beyond the forecast horizon say so.
  const weather = useQuery({
    queryKey: ["weather-days", start?.latitude, start?.longitude, option.days[0]?.date, option.days.length],
    queryFn: () => fetchWeatherDays(start!.latitude, start!.longitude, option.days[0].date, option.days.length),
    enabled: Boolean(start && option.days[0]?.date), staleTime: 30 * 60 * 1000, retry: false,
  });
  const forecastFor = (date: string) => weather.data?.find((entry) => entry.date === date);

  function navigate(next: { day?: number; view?: View }, replace = false) {
    const query = new URLSearchParams(params.toString());
    if (next.day !== undefined) query.set("day", String(next.day));
    if (next.view !== undefined) query.set("view", next.view);
    const url = `${optionHref(trip.tripId, option.id, null)}?${query}`;
    if (replace) router.replace(url, { scroll: false }); else router.push(url, { scroll: false });
  }

  const select = useCallback((id: string) => {
    setSelectedId(id);
    // M15: a station tapped on the map scrolls the timeline to its card.
    const element = stops.current.get(id);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (element && view === "timeline") element.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  }, [view]);
  const registerStop = useCallback((id: string, element: HTMLDivElement | null) => {
    if (element) stops.current.set(id, element); else stops.current.delete(id);
  }, []);

  const replaceMutation = useMutation({
    mutationFn: ({ item, reason }: { item: ItineraryItem; reason: ReplaceReason }) =>
      replacePlace(trip.tripId, option.id, item.id, reason, ownerToken as string),
    onSuccess: (next, { item }) => {
      const nextOption = next.options.find((candidate) => candidate.id === option.id);
      const nextDay = nextOption?.days.find((candidate) => candidate.dayNumber === dayNumber);
      const before = new Map(day.items.map((stop) => [stop.place.id, stop.startTime]));
      // Changed cells flash by place: the API gives every stop a new id (M17).
      const changed = new Set((nextDay?.items ?? []).filter((stop) => before.get(stop.place.id) !== stop.startTime).map((stop) => stop.place.id));
      const replacement = nextDay?.items.find((stop) => !before.has(stop.place.id));
      setTrip(next);
      setReplacing(null);
      setDetail(null);
      setFlashIds(changed);
      window.setTimeout(() => setFlashIds(new Set()), 1300);
      const difference = (nextDay?.estimatedCost ?? day.estimatedCost) - day.estimatedCost;
      toast.show(`${tr("Replaced")} ${item.place.name}${replacement ? ` ${tr("with")} ${replacement.place.name}` : ""}. ${
        difference === 0 ? tr("Day cost unchanged.") : `${tr(difference > 0 ? "Day cost up" : "Day cost down")} ${formatMoney(Math.abs(difference), language)}.`}`, { tone: "success" });
    },
  });
  const optimizeMutation = useMutation({
    mutationFn: (strategy: OptimizeStrategy) => optimizeTrip(trip.tripId, option.id, strategy, ownerToken as string, dayNumber),
    onSuccess: (next) => {
      const nextOption = next.options.find((candidate) => candidate.id === option.id);
      const stopsOf = (value?: ItineraryOption) => value?.days.flatMap((item) => item.items.map((stop) => `${stop.place.id}@${stop.startTime}`)) ?? [];
      const before = new Set(stopsOf(option));
      const changed = stopsOf(nextOption).filter((stop) => !before.has(stop)).length;
      setTrip(next);
      setOptimizing(false);
      if (changed === 0) {
        toast.show(tr("This itinerary is already optimized this way; nothing changed."), { tone: "info" });
        return;
      }
      // Summarise what changed (spec §8.7): stops moved or swapped, and the cost.
      const difference = (nextOption?.estimatedTotalCost ?? option.estimatedTotalCost) - option.estimatedTotalCost;
      toast.show(`${tr("Itinerary re-optimized")}: ${changed} ${tr(changed === 1 ? "stop changed" : "stops changed")}, ${
        difference === 0 ? tr("cost unchanged") : `${tr(difference < 0 ? "cost down" : "cost up")} ${formatMoney(Math.abs(difference), language)}`}.`, { tone: "success" });
    },
  });
  const shareMutation = useMutation({
    mutationFn: () => createShareToken(trip.tripId, ownerToken as string),
    onSuccess: (token) => {
      const url = new URL(optionHref(trip.tripId, option.id, token), window.location.origin).toString();
      saveShareUrl(trip.tripId, url);
      setShareUrl(url);
    },
  });

  function editRequest() {
    savePlanDraft(editPrefill(trip));
    router.push("/plan?step=1");
  }
  const changeOption = { label: tr("Change option"), onSelect: () => router.push(tripHref(trip.tripId, share)), icon: <SquaresFour size={20} aria-hidden /> };
  // A shared, read-only view can still switch options; it cannot change the trip.
  const menuItems = readOnly ? [changeOption] : [
    { label: tr("Re-optimize"), onSelect: () => setOptimizing(true), icon: <ArrowsClockwise size={20} aria-hidden /> },
    { label: tr("Edit request"), onSelect: editRequest, icon: <PencilSimple size={20} aria-hidden /> },
    changeOption,
  ];
  const dayHolidays = (trip.holidays ?? []).filter((holiday) => holiday.tripDates.includes(day.date));
  const startName = summary?.startName ?? "";
  const activeId = hoverId ?? selectedId;
  // The place page gives directions with this trip's travel mode (F18).
  const placeHref = (item: ItineraryItem) => `/places/${encodeURIComponent(item.place.id)}?from=trips&mode=${trip.travelMode}`;

  const timeline = <DayTimeline day={day} mode={trip.travelMode} startName={startName} holidays={dayHolidays}
    selectedId={activeId} flashIds={flashIds} grow={grow} registerStop={registerStop}
    onOpen={(item) => {
      setSelectedId(item.id);
      if (desktop) setExpandedId((current) => (current === item.id ? null : item.id)); else setDetail(item);
    }} onHover={setHoverId}
    expandedId={desktop ? expandedId : null}
    renderDetails={desktop ? (item) => <StopDetails item={item} mode={trip.travelMode} readOnly={readOnly} showTags={false}
      onReplace={() => setReplacing(item)} placeHref={placeHref(item)} /> : undefined} />;
  const map = <RouteMap items={day.items} dayNumber={day.dayNumber} startLocation={start} selectedId={activeId}
    onSelect={select} className="h-full" follow={desktop ? "inside" : "center"} />;

  const optionIndex = Math.max(0, trip.options.findIndex((item) => item.id === option.id));
  const tag = "rounded-tag px-2 py-1 text-[13px] font-semibold";
  const facts = <ul className="flex flex-wrap gap-2">
    {option.days[0]?.date && <li className={`${tag} bg-wall-yellow-soft text-warn-ink`}>{formatDateRange(option.days[0].date, option.days[dayCount - 1].date, language)}</li>}
    {summary?.travelerCount ? <li className={`${tag} bg-sign-blue-soft text-sign-blue`}>{summary.travelerCount} {tr(summary.travelerCount === 1 ? "person" : "people")}</li> : null}
    <li className={`${tag} ${["bg-sign-red-soft text-sign-red-text", "bg-sign-blue-soft text-sign-blue", "bg-moss-soft text-moss"][optionIndex % 3]}`}>{option.matchScore}% {tr("match")}</li>
  </ul>;

  return <div className="mx-auto max-w-page px-4 sm:px-6 lg:px-10">
    {readOnly && share && <ReadOnlyBanner trip={trip} />}
    {/* Header (option, dates, money against budget, actions) and the day bar
        (spec §4.6) stay under the top bar; the header folds on scroll (M30). */}
    <div ref={bar} className="sticky top-[var(--topbar-h)] z-20 -mx-4 border-b border-line bg-paper px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
      {/* Line 1: the option's name on a street sign with the trip's facts as
          tags, the actions opposite. Line 2: the days, the money against the
          budget opposite. On phones the top bar names the option, the facts sit
          beside the actions and fold away on scroll, and the money comes first. */}
      <m.header layout transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 pt-3 lg:pt-6">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Link href={tripHref(trip.tripId, share)} aria-label={tr("Back")}
            className="press -ml-3 hidden h-11 w-11 shrink-0 place-items-center rounded-control text-ink hover:bg-paper-sunken lg:grid">
            <CaretLeft size={24} aria-hidden /></Link>
          <StreetPlate as="h1" className="max-lg:sr-only">{tr(OPTION_LABELS[option.type])}</StreetPlate>
          <AnimatePresence initial={false}>
            {(!compact || desktop) && <m.div key="facts" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6, transition: { duration: 0.13 } }}
              transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }} className="min-w-0 lg:ml-2">{facts}</m.div>}
          </AnimatePresence>
        </div>
        <div className="-mr-2 flex items-center gap-1">
          {!readOnly && <>
            <Button variant="secondary" className="hidden lg:inline-flex" onClick={() => setOptimizing(true)}><ArrowsClockwise size={20} aria-hidden />{tr("Re-optimize")}</Button>
            <Button variant="secondary" className="hidden lg:inline-flex" onClick={() => setSharing(true)}><ShareNetwork size={20} aria-hidden />{tr("Share")}</Button>
            <button type="button" onClick={() => setSharing(true)} aria-label={tr("Share")} className="press grid h-11 w-11 place-items-center rounded-control hover:bg-paper-sunken lg:hidden">
              <ShareNetwork size={24} aria-hidden /></button>
          </>}
          <Menu label={tr("More actions")} items={menuItems} />
        </div>
      </m.header>
      <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
      <m.div layout="position" transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }} className="min-w-0 lg:order-last lg:w-80 lg:shrink-0">
        <m.p layoutId={`option-cost-${option.id}`} transition={spring.sheet} className="tnum font-semibold">
          <RunningNumber value={option.budget.total} announce format={(value) => formatMoney(value, language).replace(/ (đ|VND)$/, "")} />
          <span className="font-normal text-ink-muted"> / {formatMoney(budgetTotal(option), language)}</span>
        </m.p>
        <BudgetMeter option={option} compact showTarget />
      </m.div>
      <div className="rail min-w-0 gap-2" role="group" aria-label={tr("Days")}>
        {option.days.map((item) => {
          const current = item.dayNumber === dayNumber;
          const entry = forecastFor(item.date);
          const forecast = entry?.available && entry.afternoonRainProbability !== null ? entry : null;
          const rainy = (forecast?.afternoonRainProbability ?? 0) >= RAIN_THRESHOLD;
          return <button key={item.dayNumber} type="button" aria-pressed={current} onClick={() => navigate({ day: item.dayNumber })}
            className={`press flex min-h-[48px] min-w-[104px] flex-col justify-center rounded-control border px-3 text-left ${current ? "border-hero-red bg-hero-red text-white" : "border-line-strong hover:bg-paper-sunken"}`}>
            <span className="flex items-center gap-2 font-semibold">
              <span className={`h-2.5 w-2.5 rounded-full ${current ? "ring-2 ring-white" : ""}`} style={{ background: dayColor(item.dayNumber) }} aria-hidden />
              {tr("Day")} {item.dayNumber}
            </span>
            <span className={`type-small flex items-center gap-1 ${current ? "text-white" : "text-ink-muted"}`}>
              {formatDayShort(item.date, language)}
              {forecast && forecast.afternoonRainProbability !== null && <>
                {rainy ? <CloudRain size={18} aria-hidden /> : <Sun size={18} aria-hidden />}
                <span className="tnum" aria-hidden>{Math.round(forecast.afternoonRainProbability * 100)}%</span>
                <span className="sr-only">{tr(rainy ? "Rain likely in the afternoon" : "Dry afternoon likely")} ({Math.round(forecast.afternoonRainProbability * 100)}%)</span>
              </>}
              {entry && !forecast && <>
                <CloudSlash size={18} aria-hidden />
                <span className="sr-only">{tr("No forecast yet for this day")}</span>
              </>}
            </span>
          </button>;
        })}
      </div>
      </div>
      <div className="mt-2 flex gap-1" role="group" aria-label={tr("View")}>
        {VIEWS.filter((item) => !(desktop && item.value === "map")).map((item) => <button key={item.value} type="button"
          aria-pressed={view === item.value} onClick={() => navigate({ view: item.value })}
          className={`press relative min-h-[44px] rounded-control px-3 font-semibold ${view === item.value ? "text-sign-red-text" : "text-ink-muted hover:text-ink"}`}>
          {tr(item.label)}
          {view === item.value && <m.span layoutId="view-marker" transition={spring.snappy} className="absolute inset-x-3 bottom-1 h-0.5 bg-sign-red" aria-hidden />}
        </button>)}
      </div>
    </div>

    <div className="mt-6 lg:grid lg:grid-cols-12 lg:gap-8">
      <section className="min-w-0 lg:col-span-5" aria-label={tr(VIEWS.find((item) => item.value === view)?.label ?? "Itinerary")}>
        <m.div key={dayNumber} initial={dayDirection === 0 ? false : { opacity: 0, x: 24 * dayDirection }} animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, ease: [0.05, 0.7, 0.1, 1] }}>
          {view === "timeline" && <>
            <DayForecast entry={forecastFor(day.date)} />
            {timeline}
            {!readOnly && <div className="mt-6"><Button variant="secondary" onClick={() => setOptimizing(true)}><ArrowsClockwise size={20} aria-hidden />{tr("Re-optimize")}</Button></div>}
          </>}
          {view === "map" && !desktop && <MapView map={map} items={day.items} selectedId={selectedId} onSelect={setSelectedId} onOpen={setDetail} />}
          {view === "budget" && <BudgetBreakdown option={option} travelMode={trip.travelMode} />}
          {view === "stays" && <StayList trip={trip} />}
        </m.div>
      </section>
      {desktop && <aside className="lg:col-span-7">
        <div className="sticky top-[calc(var(--topbar-h)+var(--itinerary-bar,200px)+24px)] h-[calc(100vh-var(--topbar-h)-var(--itinerary-bar,200px)-48px)] min-h-[420px]">{map}</div>
      </aside>}
    </div>

    <StopSheet item={detail} open={Boolean(detail)} onClose={() => setDetail(null)} mode={trip.travelMode} readOnly={readOnly}
      onReplace={() => { setReplacing(detail); setDetail(null); }} placeHref={detail ? placeHref(detail) : "#"} />
    <ReplaceSheet item={replacing} open={Boolean(replacing)} onClose={() => { setReplacing(null); replaceMutation.reset(); }}
      onConfirm={(reason) => replacing && replaceMutation.mutate({ item: replacing, reason })}
      pending={replaceMutation.isPending} error={replaceMutation.error} />
    <OptimizeSheet open={optimizing} onClose={() => { setOptimizing(false); optimizeMutation.reset(); }} dayNumber={dayNumber}
      onConfirm={(strategy) => optimizeMutation.mutate(strategy)} pending={optimizeMutation.isPending} error={optimizeMutation.error} />
    <ShareSheet open={sharing} onClose={() => setSharing(false)} savedUrl={shareUrl} onCreate={() => shareMutation.mutate()}
      pending={shareMutation.isPending} error={shareMutation.error} />
  </div>;
}

/** Phone map tab: the map plus a snapping rail of stop cards (M20). */
function MapView({ map, items, selectedId, onSelect, onOpen }: {
  map: React.ReactNode; items: ItineraryItem[]; selectedId: string | null; onSelect: (id: string) => void; onOpen: (item: ItineraryItem) => void;
}) {
  const { tr, language } = usePrefs();
  const rail = useRef<HTMLUListElement>(null);
  // True while the rail scrolls because of a selection made elsewhere (a
  // station tapped on the map); its intersection events are ignored then,
  // otherwise selecting and scrolling would keep triggering each other.
  const programmatic = useRef(false);
  const current = useRef<string | null>(selectedId);
  const ids = useMemo(() => items.map((item) => item.id).join(","), [items]);
  useEffect(() => {
    const root = rail.current;
    if (!root) return;
    const observer = new IntersectionObserver((entries) => {
      if (programmatic.current) return;
      const visible = entries.filter((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.75)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      const id = visible?.target.getAttribute("data-id");
      if (id && id !== current.current) { current.current = id; onSelect(id); }
    }, { root, threshold: [0.75] });
    root.querySelectorAll("[data-id]").forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [ids, onSelect]);
  useEffect(() => {
    if (!selectedId || selectedId === current.current) return;
    current.current = selectedId;
    const card = rail.current?.querySelector<HTMLElement>(`[data-id="${selectedId}"]`);
    const root = rail.current;
    if (!card || !root) return;
    programmatic.current = true;
    root.scrollTo({ left: card.offsetLeft - 16, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    const timer = window.setTimeout(() => { programmatic.current = false; }, 700);
    return () => window.clearTimeout(timer);
  }, [selectedId]);
  return <div className="-mx-4 sm:mx-0">
    <div className="h-[56vh] min-h-[320px] px-0 sm:px-0">{map}</div>
    <ul ref={rail} className="rail mt-3 gap-3 px-4 pb-2" aria-label={tr("Stops")}>
      {items.map((item) => <li key={item.id} data-id={item.id} className={`w-64 rounded-card border p-3 ${item.id === selectedId ? "border-2 border-sign-red" : "border-line"}`}>
        <button type="button" onClick={() => onOpen(item)} className="block w-full text-left">
          <span className="font-semibold">{item.sequence}. <span lang={nameLang(item.place.name, language)}>{item.place.name}</span></span>
          <span className="type-small mt-1 flex gap-3 text-ink-muted"><span className="tnum">{item.startTime}</span><span>{formatDuration(item.visitMinutes, language)}</span></span>
        </button>
      </li>)}
    </ul>
  </div>;
}


/** The day's afternoon forecast above its timeline, or why there is none yet. */
function DayForecast({ entry }: { entry: Weather | undefined }) {
  const { tr } = usePrefs();
  if (!entry) return null;
  const chance = entry.available && entry.afternoonRainProbability !== null ? Math.round(entry.afternoonRainProbability * 100) : null;
  const rainy = chance !== null && chance >= RAIN_THRESHOLD * 100;
  const Icon = chance === null ? CloudSlash : rainy ? CloudRain : Sun;
  const tone = chance === null ? "bg-paper-sunken text-ink-muted" : rainy ? "bg-sign-blue-soft text-sign-blue" : "bg-wall-yellow-soft text-warn-ink";
  return <p className={`type-small mb-4 flex items-start gap-2 rounded-control px-3 py-2 ${tone}`}>
    <Icon size={20} className="mt-0.5 shrink-0" aria-hidden />
    {chance === null
      ? <span>{tr("No forecast yet for this day")}. {tr("Forecasts come out up to 16 days ahead.")}</span>
      : <span>
        <strong className="font-semibold">{tr(rainy ? "Rain likely in the afternoon" : "Dry afternoon likely")}</strong>
        {" "}({tr("rain chance")} <span className="tnum">{chance}%</span>){rainy && <>. {tr("Outdoor stops come first today.")}</>}
      </span>}
  </p>;
}

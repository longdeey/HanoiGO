"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQueries } from "@tanstack/react-query";
import { CaretRight, Info, Path, Trash } from "@phosphor-icons/react";

import type { TripResponse } from "@/types/trip";
import { ApiRequestError, fetchTrip } from "@/services/api";
import { usePrefs } from "@/lib/prefs";
import { addDays, formatDateRange, sentence, todayInHanoi } from "@/lib/format";
import { forgetTrip, ownerToken, saveTripSummary, savedTripIds, tripIsToday, tripSummary, type TripSummary } from "@/lib/storage";
import { OPTION_LABELS, budgetTotal, dayColor, optionHref } from "@/lib/trip";
import { nameLang } from "@/lib/lang";
import { usePageChrome } from "@/components/shell/chrome";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EmptyState, Skeleton, TripListSkeleton } from "@/components/ui/States";
import { Menu } from "@/components/ui/Menu";
import { StreetPlate } from "@/components/ui/Signboard";
import { useToast } from "@/components/ui/Toast";

type Row = { id: string; token: string | null; summary: TripSummary | null };
type GroupKey = "today" | "upcoming" | "past" | "undated";

// Each group has its own colour: the label, the calendar tile's header and its date
// (important: .calendar-page-day sets red itself).
const GROUP_STYLES: Record<GroupKey, { plate: string; day: string }> = {
  today: { plate: "bg-hero-red text-white", day: "!text-sign-red-text" },
  upcoming: { plate: "bg-street-blue text-white", day: "!text-sign-blue" },
  past: { plate: "bg-plate-green text-white", day: "!text-moss" },
  undated: { plate: "bg-wall-yellow text-plate-ink", day: "!text-warn-ink" },
};

function summaryFromTrip(trip: TripResponse): TripSummary {
  const option = trip.options[0];
  return {
    tripId: trip.tripId, startDate: option?.days[0]?.date ?? null, days: option?.days.length ?? 0,
    travelerCount: null, budgetTotal: option ? budgetTotal(option) : null, startName: null, createdAt: "",
  };
}

export function TripsPage() {
  const { tr } = usePrefs();
  usePageChrome({});
  const toast = useToast();
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    setRows(savedTripIds().map((id) => ({ id, token: ownerToken(id), summary: tripSummary(id) })));
  }, []);
  const today = todayInHanoi();
  // Trips created before summaries existed, and today's trip (for its next stop), are loaded once.
  const toLoad = (rows ?? []).filter((row) => row.token && (!row.summary || tripIsToday(row.summary, today)));
  const loaded = useQueries({
    queries: toLoad.map((row) => ({
      queryKey: ["trip", row.id],
      queryFn: () => fetchTrip(row.id, row.token as string),
      retry: false, staleTime: 5 * 60 * 1000,
    })),
  });
  const results = useMemo(() => new Map(toLoad.map((row, index) => [row.id, loaded[index]])), [toLoad, loaded]);
  useEffect(() => {
    results.forEach((result, id) => {
      const row = rows?.find((item) => item.id === id);
      if (result?.data && row && !row.summary) {
        const summary = summaryFromTrip(result.data);
        saveTripSummary(summary);
        setRows((current) => current?.map((item) => item.id === id ? { ...item, summary } : item) ?? null);
      }
    });
  }, [results, rows]);

  function remove(id: string) {
    forgetTrip(id);
    setRows((current) => current?.filter((row) => row.id !== id) ?? null);
    toast.show(tr("Trip removed from this device."));
  }

  if (rows === null) return <TripListSkeleton />;
  const groups: { key: GroupKey; title: string; rows: Row[] }[] = [
    { key: "today", title: "Today", rows: [] }, { key: "upcoming", title: "Upcoming", rows: [] },
    { key: "past", title: "Past", rows: [] }, { key: "undated", title: "No date chosen", rows: [] },
  ];
  for (const row of rows) {
    const summary = row.summary;
    if (!summary?.startDate) { groups[3].rows.push(row); continue; }
    const end = addDays(summary.startDate, Math.max(1, summary.days) - 1);
    if (tripIsToday(summary, today)) groups[0].rows.push(row);
    else if (summary.startDate > today) groups[1].rows.push(row);
    else if (end < today) groups[2].rows.push(row);
  }
  groups[1].rows.sort((a, b) => (a.summary?.startDate ?? "").localeCompare(b.summary?.startDate ?? ""));
  groups[2].rows.sort((a, b) => (b.summary?.startDate ?? "").localeCompare(a.summary?.startDate ?? ""));
  return <div className="mx-auto max-w-3xl px-4 sm:px-6">
    <div className="pt-4 lg:pt-8"><StreetPlate as="h1" size="lg">{tr("Trips")}</StreetPlate></div>
    <p className="type-small mt-3 flex items-start gap-2 text-ink-muted"><Info size={20} className="mt-1 shrink-0" aria-hidden />
      {tr("Trips are saved only in this browser. Signing in does not show them on other devices.")}</p>
    {rows.length === 0 ? <EmptyState title={tr("No trips on this device yet.")} action={<ButtonLink href="/plan" variant="primary">{tr("Plan my trip")}</ButtonLink>} /> :
      groups.filter((group) => group.rows.length > 0).map((group) => <section key={group.key} aria-labelledby={`group-${group.key}`} className="mt-8">
        <h2 id={`group-${group.key}`} className="type-h3">
          <span className={`inline-flex items-center gap-2 rounded-control px-3 py-1 ${GROUP_STYLES[group.key].plate}`}>
            {group.key === "today" && <span className="live-dot h-2 w-2 rounded-full bg-white" aria-hidden />}{tr(group.title)}</span></h2>
        <ul className="mt-4 space-y-4">
          {group.rows.map((row) => <TripRow key={row.id} row={row} group={group.key} today={today} result={results.get(row.id)} onRemove={() => remove(row.id)} />)}
        </ul>
      </section>)}
  </div>;
}

function TripRow({ row, group, today, result, onRemove }: {
  row: Row; group: GroupKey; today: string; result?: { data?: TripResponse; isError: boolean; error: unknown }; onRemove: () => void;
}) {
  const { tr, language } = usePrefs();
  const [confirm, setConfirm] = useState(false);
  const summary = row.summary;
  // Only a refused or missing trip is gone; a network failure is not (F33).
  const gone = result?.error instanceof ApiRequestError && ["TRIP_ACCESS_DENIED", "NOT_FOUND"].includes(result.error.code);
  const broken = !row.token || gone;
  const todayPending = Boolean(summary && tripIsToday(summary, today) && result && !result.data && !result.isError);
  const title = summary?.startDate ? formatDateRange(summary.startDate, addDays(summary.startDate, Math.max(1, summary.days) - 1), language)
    : summary?.createdAt ? `${tr("Planned at")} ${plannedAt(summary.createdAt, language)}` : tr("Trip");
  const facts = [summary ? `${summary.days} ${tr(summary.days === 1 ? "day" : "days")}` : null,
    summary?.travelerCount ? `${summary.travelerCount} ${tr(summary.travelerCount === 1 ? "person" : "people")}` : null].filter((fact): fact is string => Boolean(fact));
  const option = result?.data?.options[0];
  const todayDay = option?.days.find((day) => day.date === today);
  const now = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" }).format(new Date());
  const next = todayDay?.items.find((item) => item.startTime >= now);
  const style = GROUP_STYLES[group];
  const locale = language === "vi" ? "vi-VN" : "en-GB";
  const start = summary?.startDate ? new Date(`${summary.startDate}T00:00:00Z`) : null;
  const chip = "rounded-tag px-2 py-1 text-[13px] font-semibold";
  return <li className="flex overflow-hidden rounded-card border border-line bg-paper shadow-float">
    {/* The calendar tile repeats the start date in the title, so it is hidden from assistive tech. */}
    <div aria-hidden className="flex w-20 shrink-0 flex-col border-r border-line sm:w-28">
      <span className={`block px-2 py-1 text-center text-[13px] font-bold leading-5 ${broken ? "bg-line-strong text-white" : style.plate}`}>
        {start ? sentence(new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(start)) : tr("Trip")}</span>
      <span className="flex flex-1 flex-col items-center justify-center px-2 py-3">
        {start ? <>
          <span className={`calendar-page-day tnum block ${broken ? "!text-ink-muted" : style.day}`}>{start.getUTCDate()}</span>
          <span className="type-small block text-center text-ink-muted">{sentence(new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(start))}</span>
        </> : <span className={style.day}><Path size={40} /></span>}
      </span>
    </div>
    {/* Content sits in the middle of the card's height, level with the calendar tile. */}
    <div className="flex min-w-0 flex-1 flex-col justify-center px-4 py-4 sm:px-5">
      <div className="flex items-start gap-2">
        {broken ? <div className="min-w-0 flex-1">
          <p className="type-h3">{title}</p>
          <p className="text-ink-muted">{tr("This trip can no longer be opened.")}</p>
        </div> : <Link href={`/trips/${encodeURIComponent(row.id)}`} className="group flex min-h-[44px] min-w-0 flex-1 items-center gap-2">
          <span className="type-h3 min-w-0 flex-1 group-hover:underline">{title}</span>
          <CaretRight size={20} className="shrink-0 text-ink-muted" aria-hidden />
        </Link>}
        {!confirm && <Menu label={tr("Trip actions")} items={[{ label: tr("Remove from this device"), onSelect: () => setConfirm(true), icon: <Trash size={20} aria-hidden /> }]} />}
      </div>
      {!broken && (facts.length > 0 || summary?.startName) && <div className="mt-3 flex flex-wrap gap-2">
        {facts[0] && <span className={`${chip} bg-sign-red-soft text-sign-red-text`}>{facts[0]}</span>}
        {facts[1] && <span className={`${chip} bg-sign-blue-soft text-sign-blue`}>{facts[1]}</span>}
        {summary?.startName && <span className={`${chip} bg-moss-soft text-moss`}>{tr("from")} <span lang={nameLang(summary.startName, language)}>{summary.startName}</span></span>}
      </div>}
      {todayDay && option && <div className="mt-4 rounded-control bg-sign-red-soft p-4">
        <p className="font-semibold">{tr("Day")} {todayDay.dayNumber} / {option.days.length}, {tr(OPTION_LABELS[option.type])}</p>
        {next && <p className="mt-1 flex items-center gap-2 text-ink-muted">{tr("Next")} <span className="tnum">{next.startTime}</span>
          <span className="station shrink-0" style={{ ["--station-color" as string]: dayColor(todayDay.dayNumber) }}>{next.sequence}</span>
          <span className="text-ink" lang={nameLang(next.place.name, language)}>{next.place.name}</span></p>}
        <ButtonLink href={optionHref(row.id, option.id, null, `day=${todayDay.dayNumber}`)} variant="primary" className="mt-3">{tr("Open today's itinerary")}</ButtonLink>
      </div>}
      {todayPending && <div className="mt-3" aria-busy="true"><Skeleton className="h-24" /></div>}
      {confirm && <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label={tr("Remove from this device")}>
        <span className="type-small">{tr("Remove this trip from this device?")}</span>
        <Button variant="danger" onClick={onRemove}>{tr("Remove")}</Button>
        <Button variant="text" onClick={() => setConfirm(false)}>{tr("Cancel")}</Button>
      </div>}
    </div>
  </li>;
}

/** When an undated trip was planned: "08:30, 18/10/2026" in Hanoi time. */
function plannedAt(iso: string, language: "vi" | "en"): string {
  const date = new Date(iso);
  const locale = language === "vi" ? "vi-VN" : "en-GB";
  const time = new Intl.DateTimeFormat(locale, { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" }).format(date);
  const day = new Intl.DateTimeFormat(locale, { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
  return `${time}, ${day}`;
}

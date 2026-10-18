"use client";

import * as m from "motion/react-m";
import { NavigationArrow } from "@phosphor-icons/react";

import type { ItineraryOption, TripResponse } from "@/types/trip";
import { usePrefs } from "@/lib/prefs";
import { distanceKm, formatKm, formatMoney } from "@/lib/format";
import { budgetTotal, dayColor } from "@/lib/trip";
import { nameLang } from "@/lib/lang";
import { sentence } from "@/lib/format";
import { googleMapsDirectionsUrl } from "@/services/maps";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState, Notice } from "@/components/ui/States";
import { RunningNumber } from "@/components/ui/RunningNumber";
import { StoryLink } from "./Timeline";

const TAG = "rounded-tag px-2 py-0.5 text-[13px] font-semibold";

const GROUPS = [
  { key: "attractions", label: "Attractions", color: "var(--cat-attraction)" },
  { key: "food", label: "Food & coffee", color: "var(--cat-food)" },
  { key: "transport", label: "Transport", color: "var(--cat-transport)" },
  { key: "others", label: "Others", color: "var(--cat-other)" },
] as const;

/**
 * Budget tab. The API already splits the cost into groups; the split is shown
 * only when the groups add up to the option's total (spec §8.6). Stacked bar,
 * never a pie; every segment also has a text label (colour is not the only cue).
 */
export function BudgetBreakdown({ option, travelMode }: { option: ItineraryOption; travelMode: TripResponse["travelMode"] }) {
  const { tr, language } = usePrefs();
  const money = (value: number) => formatMoney(value, language);
  const target = option.budgetTargetShare ? Math.round(option.budgetTargetShare * 100) : null;
  const total = budgetTotal(option);
  const used = option.budget.total;
  const groupsSum = GROUPS.reduce((sum, group) => sum + option.budget[group.key], 0);
  const consistent = groupsSum === used;
  const remaining = option.budget.remaining;
  return <div className="space-y-6">
    {/* Used, budget and what is left as three tiles in the brand colours. */}
    <dl className="grid grid-cols-3 gap-2">
      <div className="rounded-card bg-sign-red-soft p-3"><dt className="type-small">{tr("Used")}</dt>
        <dd className="tnum mt-1 font-bold text-sign-red-text"><RunningNumber value={used} from={0} format={money} /></dd></div>
      <div className="rounded-card bg-sign-blue-soft p-3"><dt className="type-small">{tr("Budget")}</dt>
        <dd className="tnum mt-1 font-bold text-sign-blue">{money(total)}</dd></div>
      <div className={`rounded-card p-3 ${remaining >= 0 ? "bg-moss-soft" : "bg-sign-red-soft"}`}><dt className="type-small">{tr("Remaining")}</dt>
        <dd className={`tnum mt-1 font-bold ${remaining >= 0 ? "text-moss" : "text-sign-red-text"}`}><RunningNumber value={remaining} from={0} format={money} /></dd></div>
    </dl>
    {/* F10: the option's budget target, and a warning next to it when unmet. */}
    {target && <div className="space-y-2">
      <p className="type-small text-ink-muted">{tr("This option aims to use at least")} {target}% {tr("of the budget")}.</p>
      {option.budgetTargetMet === false && <Notice>
        {tr("The suitable places along this route do not reach the")} {target}% {tr("of the budget this option aims for.")}{" "}
        {tr(travelMode === "walking" ? "Switch to motorbike or car for more choices." : "Try a wider range or more interests.")}
      </Notice>}
    </div>}
    {consistent && used > 0 && <>
      <div className="flex h-4 overflow-hidden rounded-full bg-paper-sunken" aria-hidden>
        {GROUPS.map((group, index) => option.budget[group.key] > 0 && <m.span key={group.key} className="h-full origin-left"
          style={{ width: `${(option.budget[group.key] / Math.max(total, used)) * 100}%`, background: group.color }}
          initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.5, delay: index * 0.08, ease: [0.05, 0.7, 0.1, 1] }} />)}
      </div>
      <ul className="space-y-2">
        {GROUPS.map((group) => <li key={group.key} className="flex items-center gap-3">
          <span className="h-3 w-3 shrink-0 rounded-tag" style={{ background: group.color }} aria-hidden />
          <span className="flex-1">{tr(group.label)}</span>
          <span className="font-semibold"><RunningNumber value={option.budget[group.key]} from={0} format={money} /></span>
        </li>)}
      </ul>
    </>}
    <section>
      <h3 className="font-semibold">{tr("By day")}</h3>
      <ul className="mt-2 space-y-3">
        {option.days.map((day) => <li key={day.dayNumber}>
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: dayColor(day.dayNumber) }} aria-hidden />{tr("Day")} {day.dayNumber}</span>
            <span className="tnum font-semibold">{formatMoney(day.estimatedCost, language)}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-paper-sunken" aria-hidden>
            <span className="block h-full rounded-full" style={{ width: `${used > 0 ? (day.estimatedCost / used) * 100 : 0}%`, background: dayColor(day.dayNumber) }} />
          </div>
        </li>)}
      </ul>
    </section>
    <p className="type-small text-ink-muted">{tr("Prices, fares and distances are estimates.")}</p>
  </div>;
}

export function StayList({ trip }: { trip: TripResponse }) {
  const { tr, language } = usePrefs();
  const start = trip.startLatitude !== undefined && trip.startLongitude !== undefined
    ? { latitude: trip.startLatitude, longitude: trip.startLongitude } : null;
  if (trip.stayOptions.length === 0) return <EmptyState title={tr("No stays to suggest near this trip.")} />;
  return <div>
    <p className="type-small text-ink-muted">{tr("Places to stay within 5 km of your starting point or route.")}</p>
    <ul className="mt-3 space-y-3">
      {trip.stayOptions.map((stay) => <li key={stay.id} className="rounded-card border border-l-4 border-line border-l-street-blue bg-paper p-4 shadow-float">
        <p className="type-h3" lang={nameLang(stay.name, language)}>{stay.name}</p>
        <ul className="type-small mt-2 flex flex-wrap gap-2">
          <li className={`${TAG} bg-sign-blue-soft text-sign-blue`}>{sentence(tr(stay.category).replaceAll("_", " "))}</li>
          {start && <li className={`tnum ${TAG} bg-wall-yellow-soft text-warn-ink`}>{formatKm(distanceKm(start, stay), language)} {tr("from your starting point")}</li>}
          {stay.averageCost > 0 && <li className={`tnum ${TAG} bg-sign-red-soft text-sign-red-text`}>{tr("About")} {formatMoney(stay.averageCost, language)} {tr("a night")}</li>}
        </ul>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <a href={googleMapsDirectionsUrl(stay, trip.travelMode)} target="_blank" rel="noopener noreferrer" className={buttonClass("street")}>
            <NavigationArrow size={20} aria-hidden />{tr("Directions")}</a>
        </div>
        {stay.story && <div className="mt-2"><StoryLink story={stay.story} /></div>}
      </li>)}
    </ul>
  </div>;
}

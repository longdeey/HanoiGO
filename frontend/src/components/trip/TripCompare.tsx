"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { Clock, MapPin, NavigationArrow, Path, Scroll } from "@phosphor-icons/react";

import type { ItineraryOption, Place, TripResponse } from "@/types/trip";
import { usePrefs } from "@/lib/prefs";
import { nameLang } from "@/lib/lang";
import { useTrip } from "@/lib/useTrip";
import { formatDateRange, formatDayLong, formatDuration, formatKm, formatMoney } from "@/lib/format";
import { savePlanDraft, tripSummary } from "@/lib/storage";
import { OPTION_LABELS, editPrefill, optionBadges, optionHref, stopCount } from "@/lib/trip";
import { usePageChrome } from "@/components/shell/chrome";
import { Button, ButtonLink, type ButtonVariant } from "@/components/ui/Button";
import { StreetPlate } from "@/components/ui/Signboard";
import { EmptyState, Notice } from "@/components/ui/States";
import { spring } from "@/lib/motion";
import { googleMapsDirectionsUrl } from "@/services/maps";
import { RunningNumber } from "@/components/ui/RunningNumber";
import { BudgetMeter, MiniRoute } from "./Meters";
import { TripGate, ReadOnlyBanner } from "./TripGate";

// Each option has its own colour, the same three as elsewhere in HanoiGO:
// red for the best match, street blue for the cheapest, green for exploring.
const ACCENTS: { band: string; chip: string; price: string; button: ButtonVariant }[] = [
  { band: "bg-hero-red", chip: "text-hero-red", price: "text-sign-red-text", button: "primary" },
  { band: "bg-street-blue", chip: "text-street-blue", price: "text-sign-blue", button: "street" },
  { band: "bg-plate-green", chip: "text-plate-green", price: "text-moss", button: "green" },
];
const CHIP = "rounded-tag px-2 py-1 text-[13px] font-semibold";

export function TripCompare({ tripId }: { tripId: string }) {
  const { tr } = usePrefs();
  const state = useTrip(tripId);
  usePageChrome({ title: tr("Itineraries"), backHref: "/trips" });
  return <TripGate state={state}>{(trip) => <CompareBody trip={trip} share={state.share} readOnly={state.readOnly} />}</TripGate>;
}

function CompareBody({ trip, share, readOnly }: { trip: TripResponse; share: string | null; readOnly: boolean }) {
  const { tr, language } = usePrefs();
  const router = useRouter();
  const badges = optionBadges(trip.options);
  const first = trip.options[0];
  const summary = tripSummary(trip.tripId);
  const days = first?.days.length ?? 0;
  const facts = [
    `${days} ${tr(days === 1 ? "day" : "days")}`,
    summary?.travelerCount ? `${summary.travelerCount} ${tr(summary.travelerCount === 1 ? "person" : "people")}` : null,
    first?.days[0]?.date ? formatDateRange(first.days[0].date, first.days[first.days.length - 1].date, language) : null,
  ].filter((fact): fact is string => Boolean(fact));
  function editRequest() {
    savePlanDraft(editPrefill(trip));
    router.push("/plan?step=1");
  }
  const datedCards = [
    ...(trip.holidays ?? []).map((holiday) => ({ key: `h-${holiday.key}-${holiday.startDate}`, title: holiday.name,
      date: formatDateRange(holiday.tripDates[0] ?? holiday.startDate, holiday.tripDates[holiday.tripDates.length - 1] ?? holiday.endDate, language),
      story: holiday.relatedPlaces.find((place) => place.story)?.story ?? null, place: null as Place | null })),
    ...trip.seasonalHighlights.map((highlight) => ({ key: `s-${highlight.place.id}-${highlight.date}`, title: highlight.place.name,
      date: formatDayLong(highlight.date, language), story: highlight.place.story ?? null, place: highlight.place })),
  ];
  return <div className="mx-auto max-w-page px-4 pb-12 sm:px-6 lg:px-10">
    {readOnly && share && <ReadOnlyBanner trip={trip} />}
    {/* The sign and the edit action share one line; the request's facts sit under it. */}
    <div className="pt-4 lg:pt-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <StreetPlate as="h1" size="lg">{tr("Itineraries")}</StreetPlate>
        {!readOnly && <Button variant="secondary" onClick={editRequest}>{tr("Edit request")}</Button>}
      </div>
      {facts.length > 0 && <ul className="mt-4 flex flex-wrap gap-2">
        {facts.map((fact, index) => <li key={fact} className={`${CHIP} ${["bg-sign-red-soft text-sign-red-text", "bg-sign-blue-soft text-sign-blue", "bg-wall-yellow-soft text-warn-ink"][index]}`}>{fact}</li>)}
        {summary?.startName && <li className={`${CHIP} bg-moss-soft text-moss`}>{tr("from")} <span lang={nameLang(summary.startName, language)}>{summary.startName}</span></li>}</ul>}
    </div>

    {datedCards.length > 0 && <section aria-labelledby="dated-title" className="mt-8">
      <h2 id="dated-title" className="type-h3">{tr("During your dates")}</h2>
      <ul className="rail -mx-4 mt-3 gap-3 px-4 pb-1 sm:mx-0 sm:px-0">
        {datedCards.map((card) => <li key={card.key} className="w-64 rounded-card border border-line p-4">
          <p className="font-semibold" lang={nameLang(card.title, language)}>{card.title}</p>
          <p className="type-small mt-1 text-ink-muted">{card.date}</p>
          {card.place?.annual && <p className="type-small text-ink-muted">{tr("Repeats around this date each year")}</p>}
          <div className="type-small mt-1 flex flex-wrap gap-x-4">
            {card.story && <Link href={`/stories/${card.story.slug}`} className="inline-flex min-h-[44px] items-center gap-1 font-semibold text-sign-blue">
              <Scroll size={20} aria-hidden />{tr("Read the story")}</Link>}
            {card.place && <a href={googleMapsDirectionsUrl(card.place, trip.travelMode)} target="_blank" rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center gap-1 font-semibold text-sign-blue"><NavigationArrow size={20} aria-hidden />{tr("Directions")}</a>}
            {card.place?.informationSource && <a href={card.place.informationSource} target="_blank" rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center font-semibold text-sign-blue underline-offset-4 hover:underline">{tr("Event information")}</a>}
          </div>
        </li>)}
      </ul>
    </section>}

    {/* Desktop: the three panels share row tracks (subgrid), so each metric
        lines up across the columns for side-by-side comparison (spec §8.5). */}
    {trip.options.length === 0 ? <div className="mt-8"><EmptyState title={tr("This trip has no itinerary options.")}
      action={!readOnly ? <Button variant="secondary" onClick={editRequest}>{tr("Edit request")}</Button> : undefined} /></div> :
    <div className="mt-8 grid gap-4 lg:grid-cols-3 lg:gap-x-6 lg:gap-y-0">
      {trip.options.map((option, index) => <OptionPanel key={option.id} option={option} index={index}
        badges={badges.get(option.id) ?? []} href={optionHref(trip.tripId, option.id, share)} travelMode={trip.travelMode} />)}
    </div>}
    <p className="type-small mt-6 text-ink-muted">{tr("Prices, fares and distances are estimates; distances are straight lines, not road routes.")}</p>
  </div>;
}

function OptionPanel({ option, index, badges, href, travelMode }: {
  option: ItineraryOption; index: number; badges: string[]; href: string; travelMode: TripResponse["travelMode"];
}) {
  const { tr, language } = usePrefs();
  const reduce = useReducedMotion();
  const places = stopCount(option);
  const target = option.budgetTargetShare ? Math.round(option.budgetTargetShare * 100) : null;
  const accent = ACCENTS[index % ACCENTS.length];
  // M11: the three options arrive 80 ms apart (at once with reduced motion).
  return <m.article initial={reduce ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, ease: [0.05, 0.7, 0.1, 1], delay: index * 0.08 }}
    className="flex flex-col overflow-hidden rounded-card border border-line bg-paper p-4 shadow-float lg:row-span-7 lg:grid lg:grid-rows-subgrid" aria-labelledby={`option-${option.id}`}>
    {/* The option's colour band: name, match and badges in white. */}
    <div className={`-mx-4 -mt-4 flex flex-wrap items-start justify-between gap-2 px-4 py-3 text-white ${accent.band}`}>
      <div>
        <m.h2 layoutId={`option-title-${option.id}`} transition={spring.sheet} id={`option-${option.id}`} className="type-h3">{tr(OPTION_LABELS[option.type])}</m.h2>
        {/* How well the option matches the request (kept from the old cards, F34). */}
        <p className="type-small tnum">{option.matchScore}% {tr("match")}</p>
      </div>
      <div className="flex flex-wrap gap-1">{badges.map((badge) => <span key={badge} className={`${CHIP} bg-white ${accent.chip}`}>{tr(badge)}</span>)}</div>
    </div>
    <div className="mt-4"><MiniRoute option={option} /></div>
    <m.p layoutId={`option-cost-${option.id}`} transition={spring.sheet} className={`type-money-l mt-4 ${accent.price}`}>
      <RunningNumber value={option.estimatedTotalCost} from={0} format={(value) => formatMoney(value, language)} />
    </m.p>
    <BudgetMeter option={option} grow showRemaining />
    {/* Always one row, empty when there is no warning, so the rows below stay aligned. */}
    <div>{option.budgetTargetMet === false && target && <div className="mt-3"><Notice>
      {tr("The suitable places along this route do not reach the")} {target}% {tr("of the budget this option aims for.")}{" "}
      {tr(travelMode === "walking" ? "Switch to motorbike or car for more choices." : "Try a wider range or more interests.")}
    </Notice></div>}</div>
    {/* Labels in one row, values in the next, so a label that wraps never pushes its value out of line. */}
    <dl className="mt-4 grid grid-flow-col grid-rows-[auto_auto] gap-x-2 gap-y-1">
      <Metric icon={<Path size={20} aria-hidden />} label={tr("Distance")} value={formatKm(option.estimatedTotalDistanceKm, language)} />
      <Metric icon={<Clock size={20} aria-hidden />} label={tr("Travel time")} value={formatDuration(option.estimatedTotalTravelMinutes, language)} />
      <Metric icon={<MapPin size={20} aria-hidden />} label={tr("Places")} value={String(places)} />
    </dl>
    <div className="mt-auto pt-6">
      <ButtonLink href={href} variant={accent.button} className="w-full">{tr("View itinerary")}</ButtonLink>
    </div>
  </m.article>;
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="contents">
    <dt className="type-small flex items-end gap-1 self-end text-ink-muted">{icon}{label}</dt>
    <dd className="tnum font-semibold">{value}</dd>
  </div>;
}

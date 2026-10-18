"use client";

import { forwardRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { Car, Clock, MapPin, Motorcycle, NavigationArrow, PersonSimpleWalk, Scroll, Ticket } from "@phosphor-icons/react";

import type { Holiday, ItineraryDay, ItineraryItem, Place, PlaceStory, TripResponse } from "@/types/trip";
import { usePrefs } from "@/lib/prefs";
import { formatDuration, formatKm, formatMoney, sentence } from "@/lib/format";
import { dayColor, stayExtended } from "@/lib/trip";
import { nameLang } from "@/lib/lang";
import { spring } from "@/lib/motion";
import { googleMapsDirectionsUrl } from "@/services/maps";

type Mode = TripResponse["travelMode"];
const EASE_STANDARD = [0.2, 0, 0, 1] as const;
const TAG = "rounded-tag px-2 py-0.5 text-[13px] font-semibold";

/** Each kind of place keeps one colour on its tag: food green, sights blue, outdoors yellow, the rest red. */
function categoryTone(category: string): string {
  if (/food|coffee|cafe|restaurant|street|drink|bar|market/.test(category)) return "bg-moss-soft text-moss";
  if (/histor|museum|culture|temple|pagoda|heritage|art|religio|architect/.test(category)) return "bg-sign-blue-soft text-sign-blue";
  if (/nature|park|lake|hik|garden|outdoor|view/.test(category)) return "bg-wall-yellow-soft text-warn-ink";
  return "bg-sign-red-soft text-sign-red-text";
}

function ModeIcon({ mode }: { mode: Mode }) {
  if (mode === "motorbike") return <Motorcycle size={20} aria-hidden />;
  if (mode === "car" || mode === "grab") return <Car size={20} aria-hidden />;
  return <PersonSimpleWalk size={20} aria-hidden />;
}

/** "Must see" (red) or "Worth a stop" (blue, kept from the old interface, F34). */
export function PlaceTags({ place }: { place: Place }) {
  const { tr } = usePrefs();
  if (place.highlightLevel === "must_see") return <span className="rounded-tag bg-sign-red px-2 py-1 text-[13px] font-semibold text-white">{tr("Must see")}</span>;
  if (place.highlightLevel === "notable") return <span className="rounded-tag bg-sign-blue-soft px-2 py-1 text-[13px] font-semibold text-sign-blue">{tr("Worth a stop")}</span>;
  return null;
}

/**
 * A story link with its title, teaser and reading time (F25). On the yellow
 * holiday band every line stays in ink, never muted ink (spec §6.1).
 */
export function StoryLink({ story, onYellow = false }: { story: PlaceStory; onYellow?: boolean }) {
  const { tr, language } = usePrefs();
  const muted = onYellow ? "" : "text-ink-muted";
  return <div className="type-small">
    <Link href={`/stories/${story.slug}`} className={`inline-flex min-h-[44px] items-center gap-2 font-semibold ${onYellow ? "underline underline-offset-4" : "text-sign-blue"}`}>
      <Scroll size={20} aria-hidden /><span lang={nameLang(story.title, language)}>{story.title}</span>
    </Link>
    <p className={`line-clamp-2 ${muted}`}>{story.teaser}</p>
    <p className={muted}>{story.readingMinutes} {tr("min read")}</p>
  </div>;
}

/**
 * The day's holiday band: wall yellow, only when the API lists a holiday for
 * this date (F13). "See where it is held" appears only when the API names the
 * places that host it; each has directions and its story when there is one.
 */
export function HolidayBand({ holiday, mode }: { holiday: Holiday; mode: Mode }) {
  const { tr, language } = usePrefs();
  const [open, setOpen] = useState(false);
  const places = holiday.relatedPlaces;
  const listId = `holiday-places-${holiday.key}`;
  return <section className="mb-6 rounded-card bg-wall-yellow p-4 text-[#1C1E26]" aria-label={holiday.name}>
    <p className="font-semibold" lang={nameLang(holiday.name, language)}>{holiday.name}</p>
    <p className="type-small mt-1">{holiday.suggestion}</p>
    {places.length > 0 && <>
      <button type="button" aria-expanded={open} aria-controls={listId} onClick={() => setOpen(!open)}
        className="type-small mt-1 min-h-[44px] font-semibold underline underline-offset-4">{tr("See where it is held")}</button>
      {open && <ul id={listId} className="mt-1 space-y-3">
        {places.map((place) => <li key={place.id} className="border-t border-[#1C1E26]/20 pt-2">
          <div className="type-small flex flex-wrap items-center gap-x-4">
            <Link href={`/places/${encodeURIComponent(place.id)}?from=trips&mode=${mode}`} lang={nameLang(place.name, language)}
              className="inline-flex min-h-[44px] items-center font-semibold underline underline-offset-4">{place.name}</Link>
            <a href={googleMapsDirectionsUrl(place, mode)} target="_blank" rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center gap-2 font-semibold underline underline-offset-4">
              <NavigationArrow size={20} aria-hidden />{tr("Directions")}</a>
          </div>
          {place.story && <StoryLink story={place.story} onYellow />}
        </li>)}
      </ul>}
    </>}
  </section>;
}

export function LegRow({ item, mode, color }: { item: ItineraryItem; mode: Mode; color?: string }) {
  const { tr, language } = usePrefs();
  return <div className="py-2"><div className="type-small inline-flex flex-wrap items-center gap-x-4 gap-y-1 rounded-full bg-paper-sunken px-3 py-1 text-ink-muted">
    <span className="sr-only">{tr("Travel to the next place")}:</span>
    <span className="inline-flex items-center gap-1"><span style={{ color }}><ModeIcon mode={mode} /></span><span className="tnum">{formatDuration(item.travelMinutes, language)}</span></span>
    <span className="tnum">{formatKm(item.travelKm, language)}</span>
    {item.travelCost > 0 && <span className="tnum">{formatMoney(item.travelCost, language)}</span>}
  </div></div>;
}

/** M17: a changed time flips to its new value. */
function TimeFlip({ value }: { value: string }) {
  const reduce = useReducedMotion();
  return <AnimatePresence mode="popLayout" initial={false}>
    <m.span key={value} className="inline-block" initial={reduce ? false : { opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
      exit={reduce ? undefined : { opacity: 0, y: 8 }} transition={{ duration: 0.2, ease: EASE_STANDARD }}>{value}</m.span>
  </AnimatePresence>;
}

type StopProps = {
  item: ItineraryItem; color: string; selected: boolean; flash: boolean;
  onOpen: (item: ItineraryItem) => void; onHover: (id: string | null) => void;
  /** Desktop: the card expands in place (M16) instead of opening a sheet. */
  expanded?: boolean; details?: React.ReactNode;
  /** Set on the day's first draw: stations appear one after another (M13). */
  appearIndex?: number;
};

export const StopCard = forwardRef<HTMLDivElement, StopProps>(function StopCard({ item, color, selected, flash, onOpen, onHover, expanded = false, details, appearIndex }, ref) {
  const { tr, language } = usePrefs();
  const mustSee = item.place.highlightLevel === "must_see";
  const detailsId = `stop-details-${item.id}`;
  return <m.div ref={ref} layout transition={expanded ? spring.sheet : spring.gentle} id={`stop-${item.id}`}
    className="relative grid grid-cols-[52px_28px_1fr] gap-x-3"
    onMouseEnter={() => onHover(item.id)} onMouseLeave={() => onHover(null)}>
    <p className="type-time relative pt-3 text-right text-ink"><TimeFlip value={item.startTime} /></p>
    <span className={`station relative z-[1] mt-2 ${mustSee ? "station-must" : ""} ${item.place.story ? "station-story" : ""} ${selected ? "station-active" : ""} ${appearIndex !== undefined ? "station-appear" : ""}`}
      style={{ ["--station-color" as string]: color, animationDelay: appearIndex !== undefined ? `${200 + appearIndex * 80}ms` : undefined }} aria-hidden>{item.sequence}</span>
    <div className={`rounded-card border border-l-4 bg-paper p-3 shadow-float transition-colors duration-200 ease-[cubic-bezier(0.2,0,0,1)] ${selected ? "border-sign-red" : "border-line"} ${flash ? "flash-change" : ""}`}
      style={selected ? undefined : { borderLeftColor: color }}>
      {/* The visible content is the button's name, so assistive tech hears the
          tags, cost and duration too, and the Vietnamese name keeps its lang. */}
      <button type="button" onClick={() => onOpen(item)} onFocus={() => onHover(item.id)} onBlur={() => onHover(null)}
        aria-expanded={details ? expanded : undefined} aria-controls={details ? detailsId : undefined} className="block w-full text-left">
        <span className="flex flex-wrap items-start gap-2">
          <span className="type-h3 flex-1"><span className="sr-only">{item.sequence}. </span><span lang={nameLang(item.place.name, language)}>{item.place.name}</span></span>
          <span className="mt-1"><PlaceTags place={item.place} /></span>
        </span>
        <span className="type-small mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-ink-muted">
          <span className={`${TAG} ${categoryTone(item.place.category)}`}>{sentence(tr(item.place.category).replaceAll("_", " "))}</span>
          <span className="inline-flex items-center gap-1"><Clock size={20} aria-hidden /><span className="tnum">{formatDuration(item.visitMinutes, language)}</span></span>
          <span className={`tnum ${TAG} ${item.estimatedCost > 0 ? "bg-sign-red-soft text-sign-red-text" : "bg-moss-soft text-moss"}`}>{item.estimatedCost > 0 ? `${formatMoney(item.estimatedCost, language)} ${tr("for the group")}` : tr("Free")}</span>
          {item.place.entranceFee > 0 && <span className="inline-flex items-center gap-1"><Ticket size={20} aria-hidden /><span className="tnum">{formatMoney(item.place.entranceFee, language)} {tr("per person")}</span></span>}
        </span>
        {stayExtended(item) && <span className="type-small mt-1 block text-ink-muted">{tr("Longer stay so the next place is open when you arrive")}</span>}
        <span className="sr-only"> {tr("Open details")}</span>
      </button>
      {item.place.story && <Link href={`/stories/${item.place.story.slug}`}
        className="type-small mt-1 inline-flex min-h-[44px] items-center gap-2 font-semibold text-sign-blue">
        <Scroll size={20} aria-hidden />{tr("Story")}<span className="font-normal text-ink-muted">{item.place.story.readingMinutes} {tr("min read")}</span>
      </Link>}
      {details && <AnimatePresence initial={false}>
        {expanded && <m.div key="details" id={detailsId} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.13 } }} transition={{ duration: 0.2, ease: EASE_STANDARD }}
          className="mt-3 border-t border-line pt-4">{details}</m.div>}
      </AnimatePresence>}
    </div>
  </m.div>;
});

export function StartRow({ name }: { name: string }) {
  const { tr, language } = usePrefs();
  return <div className="grid grid-cols-[52px_28px_1fr] items-center gap-x-3">
    <span />
    <span className="station station-start relative z-[1]" aria-hidden>0</span>
    <p><span className="font-semibold">{tr("Starting point")}</span>{name && <span className="text-ink-muted" lang={nameLang(name, language)}> {name}</span>}</p>
  </div>;
}

export function DayTotal({ day }: { day: ItineraryDay }) {
  const { tr, language } = usePrefs();
  const stories = day.items.filter((item) => item.place.story).length;
  return <div className="mt-6 rounded-card bg-sign-red-soft p-4">
    <div className="flex items-baseline justify-between gap-4">
      <p className="font-semibold">{tr("Total for day")} {day.dayNumber}</p>
      <p className="type-h3 tnum font-bold text-sign-red-text" style={{ fontStretch: "112%" }}>{formatMoney(day.estimatedCost, language)}</p>
    </div>
    <ul className="type-small mt-1 flex flex-wrap gap-x-4 text-ink-muted">
      <li className="inline-flex items-center gap-1"><MapPin size={20} aria-hidden />{day.items.length} {tr("places")}</li>
      <li className="tnum">{formatKm(day.estimatedDistanceKm, language)}</li>
      <li className="tnum">{formatDuration(day.estimatedTravelMinutes, language)} {tr("on the move")}</li>
      {stories > 0 && <li className="inline-flex items-center gap-1"><Scroll size={20} aria-hidden />{stories} {tr("stories on this day")}</li>}
    </ul>
    <p className="type-small mt-3 text-ink-muted">{tr("Travel time, distance and fares are straight-line estimates.")}</p>
  </div>;
}

/**
 * One day as a line: the vertical rule is the day's route (same colour and
 * station numbers as the map). It grows from the top the first time (M13).
 * Stops are keyed by place, because the API gives every stop a new id when a
 * trip changes: re-optimised stops then move into place (M18), and a replaced
 * stop leaves to the left while the new one arrives from the right (M17).
 */
export function DayTimeline({ day, mode, startName, holidays, selectedId, flashIds, onOpen, onHover, registerStop, grow, expandedId = null, renderDetails }: {
  day: ItineraryDay; mode: Mode; startName: string; holidays: Holiday[]; selectedId: string | null; flashIds: Set<string>;
  onOpen: (item: ItineraryItem) => void; onHover: (id: string | null) => void;
  registerStop: (id: string, element: HTMLDivElement | null) => void; grow: boolean;
  expandedId?: string | null; renderDetails?: (item: ItineraryItem) => React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const color = dayColor(day.dayNumber);
  const repeated = new Set(day.items.map((item) => item.place.id).filter((id, index, ids) => ids.indexOf(id) !== index));
  const keyOf = (item: ItineraryItem) => (repeated.has(item.place.id) ? item.id : item.place.id);
  return <div>
    {holidays.map((holiday) => <HolidayBand key={holiday.key} holiday={holiday} mode={mode} />)}
    <div className="relative">
      <span className={`absolute bottom-6 left-[calc(52px+12px+12px)] top-4 w-1 rounded-full ${grow ? "route-grow" : ""}`}
        style={{ background: color }} aria-hidden />
      <ol className="relative space-y-0">
        <li><StartRow name={startName} /></li>
        <AnimatePresence initial={false} mode="popLayout">
          {day.items.map((item, index) => <m.li key={keyOf(item)} layout={reduce ? false : "position"}
            initial={reduce ? false : { opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }}
            exit={reduce ? undefined : { opacity: 0, x: -24, transition: { duration: 0.33, ease: [0.3, 0, 0.8, 0.15] } }}
            transition={reduce ? { duration: 0 } : spring.gentle}>
            <div className="grid grid-cols-[52px_28px_1fr] gap-x-3"><span /><span /><LegRow item={item} mode={mode} color={color} /></div>
            <StopCard ref={(element) => registerStop(item.id, element)} item={item} color={color}
              selected={selectedId === item.id} flash={flashIds.has(item.place.id)} onOpen={onOpen} onHover={onHover}
              expanded={expandedId === item.id} details={renderDetails?.(item)} appearIndex={grow ? index : undefined} />
          </m.li>)}
        </AnimatePresence>
      </ol>
    </div>
    <DayTotal day={day} />
  </div>;
}

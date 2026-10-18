"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Scroll } from "@phosphor-icons/react";

import type { Holiday } from "@/types/trip";
import { fetchHolidays } from "@/services/api";
import { usePrefs } from "@/lib/prefs";
import { nameLang } from "@/lib/lang";
import { addDays, formatDateRange, formatMonth, sentence, todayInHanoi } from "@/lib/format";
import { hanoiImages } from "@/data/hanoi-images";
import { storyPhotos } from "@/data/story-photos";
import { festivalGalleries, holidayPhotos } from "@/data/festivals";
import { holidayCovers } from "@/data/holiday-photos";
import { usePageChrome } from "@/components/shell/chrome";
import { Signboard, StreetPlate } from "@/components/ui/Signboard";
import { Collage, type Canvas, type Clip } from "@/components/ui/Collage";
import { ButtonLink } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Controls";
import { ErrorState, FestivalListSkeleton, PhotoSource, apiErrorMessage } from "@/components/ui/States";

const UPCOMING_DAYS = 90;
// The gallery opens on this many photos; the rest are one tap away.
const GALLERY_FIRST = 12;
const KIND_LABELS: Record<Holiday["kind"], string> = {
  public_holiday: "Public holiday", traditional: "Traditional", festival: "Festival", observance: "Observance",
};
// Each kind keeps its own colour, so the calendar reads at a glance.
const KIND_TAGS: Record<Holiday["kind"], string> = {
  public_holiday: "bg-sign-red-soft text-sign-red-text", traditional: "bg-wall-yellow-soft text-warn-ink",
  festival: "bg-sign-blue-soft text-sign-blue", observance: "bg-moss-soft text-moss",
};

const label = (key: string) => festivalGalleries.find((festival) => festival.key === key)!.label;
const HEADLINE = { vi: "Mùa lễ hội Hà Nội", en: "Hanoi's festival season" };
// The festival collage, laid out like the home one: clear gutters, fixed aspect ratio.
const DESKTOP_CANVAS: Canvas = { w: 1200, h: 440 };
const DESKTOP_CLIPS: Clip[] = [
  { image: "le-hoi-chua-huong-3", label: label("huong"), x: 18, y: 26, w: 300, h: 220, tilt: -3 },
  { image: "le-hoi-go-dong-da-3", label: label("dong-da"), x: 342, y: 40, w: 250, h: 200, tilt: 2 },
  { headline: HEADLINE, headlineSize: 26, x: 616, y: 30, w: 220, h: 150, tilt: -2 },
  { image: "hoi-giong-2", label: label("giong"), x: 860, y: 24, w: 320, h: 230, tilt: 3 },
  { image: "le-hoi-co-loa-2", label: label("co-loa"), x: 30, y: 268, w: 220, h: 150, tilt: 2 },
  { image: "le-hoi-den-hai-ba-trung-8", label: label("hai-ba-trung"), x: 274, y: 262, w: 230, h: 160, tilt: -3 },
  { image: "festival", x: 528, y: 202, w: 200, h: 218, tilt: 2 },
  { image: "chua-quan-su-2", label: label("quan-su"), x: 752, y: 276, w: 200, h: 146, tilt: 3 },
  { image: "le-hoi-co-loa-4", label: label("co-loa"), x: 976, y: 278, w: 200, h: 144, tilt: -2 },
];
const PHONE_CANVAS: Canvas = { w: 400, h: 480 };
const PHONE_CLIPS: Clip[] = [
  { image: "le-hoi-chua-huong-3", label: label("huong"), x: 12, y: 20, w: 228, h: 170, tilt: -3 },
  { image: "hoi-giong-2", label: label("giong"), x: 256, y: 30, w: 132, h: 150, tilt: 4 },
  { headline: HEADLINE, headlineSize: 18, x: 20, y: 214, w: 150, h: 110, tilt: 2 },
  { image: "le-hoi-go-dong-da-3", label: label("dong-da"), x: 188, y: 212, w: 200, h: 138, tilt: -2 },
  { image: "le-hoi-co-loa-2", label: label("co-loa"), x: 14, y: 346, w: 176, h: 122, tilt: -3 },
  { image: "le-hoi-den-hai-ba-trung-8", label: label("hai-ba-trung"), x: 208, y: 370, w: 178, h: 100, tilt: 3 },
];

export function FestivalsPage() {
  const { tr, language } = usePrefs();
  usePageChrome({});
  const [range, setRange] = useState<"upcoming" | "year">("upcoming");
  const [filter, setFilter] = useState<string | null>(null);
  const today = todayInHanoi();
  const holidays = useQuery({
    queryKey: ["holidays", today, 365, language],
    queryFn: () => fetchHolidays(today, 365, language),
    staleTime: 60 * 60 * 1000,
  });
  const limit = addDays(today, UPCOMING_DAYS);
  const items = (holidays.data ?? []).filter((holiday) => range === "year" || holiday.startDate <= limit);
  const months = new Map<string, Holiday[]>();
  for (const holiday of items) {
    const key = (holiday.startDate < today ? today : holiday.startDate).slice(0, 7);
    months.set(key, [...(months.get(key) ?? []), holiday]);
  }
  return <div className="mx-auto max-w-page px-4 pb-12 sm:px-6 lg:px-10">
    <div className="pt-4 lg:pt-8"><Signboard textClassName="type-display">{tr("Hanoi festival calendar")}</Signboard></div>
    <div className="collage-table collage-table-hero mt-4 overflow-hidden rounded-card">
      <Collage canvas={PHONE_CANVAS} clips={PHONE_CLIPS} className="mx-auto max-w-[560px] md:hidden" sizes="(min-width: 560px) 300px, 55vw" />
      <Collage canvas={DESKTOP_CANVAS} clips={DESKTOP_CLIPS} className="hidden md:block" sizes="(min-width: 1280px) 340px, 28vw" />
    </div>

    {/* The calendar, month by month, each entry with its photo and story when there is one. */}
    <div className="mx-auto max-w-4xl">
      <div className="mt-8 flex gap-2" role="group" aria-label={tr("Show")}>
        {(["upcoming", "year"] as const).map((value) => <button key={value} type="button" aria-pressed={range === value} onClick={() => setRange(value)}
          className={`press min-h-[44px] rounded-control border px-4 font-semibold ${range === value ? "border-2 border-sign-red bg-sign-red-soft text-sign-red-text" : "border-line-strong hover:bg-paper-sunken"}`}>
          {tr(value === "upcoming" ? "Coming up" : "Whole year")}</button>)}
      </div>
      <div className="mt-6">
        {holidays.isPending && <FestivalListSkeleton />}
        {holidays.isError && <ErrorState message={apiErrorMessage(holidays.error, tr)} onRetry={() => void holidays.refetch()} />}
        {holidays.isSuccess && items.length === 0 && <p className="text-ink-muted">{tr("No festivals in this period.")}</p>}
        {[...months.entries()].map(([month, list]) => <section key={month} aria-labelledby={`month-${month}`} className="mb-8">
          <h2 id={`month-${month}`} className="type-h3 sticky top-[var(--topbar-h)] z-10 -mx-4 bg-paper px-4 py-2 sm:-mx-6 sm:px-6">
            <span className="inline-block rounded-control bg-hero-red px-3 py-1 text-white">{formatMonth(`${month}-01`, language, month.slice(0, 4) !== today.slice(0, 4))}</span></h2>
          <ul className="space-y-4">{list.map((holiday) => <FestivalItem key={`${holiday.key}-${holiday.startDate}`} holiday={holiday} today={today} />)}</ul>
        </section>)}
      </div>
      <p className="type-small mt-4 text-ink-muted">{tr("Dates of recurring festivals are planning suggestions. Check the official calendar before you go.")}</p>
    </div>


    <section aria-labelledby="festival-moments" className="mt-14">
      <StreetPlate id="festival-moments">{tr("Festival moments")}</StreetPlate>
      <Gallery filter={filter} onFilter={setFilter} />
    </section>
  </div>;
}

function FestivalItem({ holiday, today }: { holiday: Holiday; today: string }) {
  const { tr, language } = usePrefs();
  const [open, setOpen] = useState(false);
  const ongoing = holiday.startDate <= today && today <= holiday.endDate;
  const planDate = ongoing ? today : holiday.startDate;
  const detailsId = `festival-${holiday.key}-${holiday.startDate}`;
  const locale = language === "vi" ? "vi-VN" : "en-GB";
  const start = new Date(`${holiday.startDate}T00:00:00Z`);
  const monthName = sentence(new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(start));
  const weekday = sentence(new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(start));
  const extra = holidayPhotos[holiday.key];
  // Each entry's own cover photo; the older story photo only when it has none.
  const cover = holidayCovers[holiday.key];
  const photo = cover ?? (extra ? hanoiImages[extra.image] : undefined);
  // Always visible: dates, name, a short suggestion (spec §5); the rest is one tap away.
  // The calendar page on the left repeats the start date and the photo repeats the name,
  // so both are hidden from assistive tech.
  // The photo runs across the top of the card at 16:7, so a landscape photo is shown nearly whole.
  return <li className="overflow-hidden rounded-card border border-line bg-paper shadow-float">
    {photo && <span aria-hidden className="relative block aspect-[16/7] overflow-hidden border-b border-line">
      <Image src={photo.src} alt="" fill sizes="(min-width: 960px) 896px, 100vw" className="object-cover"
        style={cover?.position ? { objectPosition: cover.position } : undefined} />
    </span>}
    <div className="flex">
    <div aria-hidden className="flex w-24 shrink-0 flex-col border-r border-line sm:w-32">
      <span className="calendar-page-head block">{monthName}</span>
      <span className="calendar-page-day tnum block pt-2">{Number(holiday.startDate.slice(8, 10))}</span>
      <span className="type-small block px-2 pb-3 text-center text-ink-muted">{weekday}</span>
    </div>
    <div className="min-w-0 flex-1 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-tag px-2 py-1 text-[13px] font-semibold ${KIND_TAGS[holiday.kind]}`}>{tr(KIND_LABELS[holiday.kind])}</span>
        {ongoing && <span className="type-small inline-flex items-center gap-2 font-semibold">
          <span className="live-dot h-2 w-2 rounded-full bg-sign-red" aria-hidden />{tr("Happening now")}</span>}
      </div>
      <h3 className="type-h3 mt-2" lang={nameLang(holiday.name, language)}>{holiday.name}</h3>
      <p className="tnum mt-1 font-semibold text-sign-red-text">{formatDateRange(holiday.startDate, holiday.endDate, language)}</p>
      <p className="mt-2 text-ink-muted">{holiday.suggestion}</p>
      <div className="mt-1 flex flex-wrap gap-x-5">
        <button type="button" aria-expanded={open} aria-controls={detailsId} onClick={() => setOpen(!open)}
          className="min-h-[44px] font-semibold text-sign-red-text underline-offset-4 hover:underline">
          {tr(holiday.relatedPlaces.length > 0 ? "Details and where it is held" : "Details")}</button>
        {extra?.story && <Link href={`/stories/${extra.story}`} className="inline-flex min-h-[44px] items-center gap-1 font-semibold text-sign-blue underline-offset-4 hover:underline">
          <Scroll size={20} aria-hidden />{tr("Read the story")}</Link>}
      </div>
      {open && <div id={detailsId} className="space-y-2">
        <p>{holiday.description}</p>
        {holiday.relatedPlaces.length > 0 && <div>
          <p className="type-small font-semibold">{tr("Where to go")}</p>
          <ul className="mt-1 flex flex-wrap gap-x-4">{holiday.relatedPlaces.map((place) => <li key={place.id}>
            <Link href={`/places/${encodeURIComponent(place.id)}?from=festivals`} lang={nameLang(place.name, language)} className="inline-flex min-h-[44px] items-center text-sign-blue underline-offset-4 hover:underline">{place.name}</Link>
          </li>)}</ul>
        </div>}
        {holiday.isPublicHoliday && <p className="type-small text-ink-muted">{tr("Expect crowds and some closures; check opening hours.")}</p>}
      </div>}
      <div className="mt-4"><ButtonLink href={`/plan?step=1&startDate=${planDate}`} variant="primary">{tr("Plan for these dates")}</ButtonLink></div>
    </div>
    </div>
  </li>;
}

/** Every festival photo, filterable by festival, in columns that keep each photo's own shape. */
function Gallery({ filter, onFilter }: { filter: string | null; onFilter: (key: string | null) => void }) {
  const { tr, language } = usePrefs();
  const [all, setAll] = useState(false);
  const groups = festivalGalleries
    .filter((festival) => filter === null || festival.key === filter)
    .map((festival) => (storyPhotos[festival.story] ?? []).map((photo) => ({ photo, festival })));
  // All festivals: take one photo from each in turn, so the first screen shows every festival.
  const longest = Math.max(0, ...groups.map((group) => group.length));
  const photos = Array.from({ length: longest }, (_, index) => groups.map((group) => group[index])).flat().filter(Boolean);
  const shown = filter === null && !all ? photos.slice(0, GALLERY_FIRST) : photos;
  return <>
    <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label={tr("Festival moments")}>
      <Chip selected={filter === null} onToggle={() => onFilter(null)}>{tr("All")}</Chip>
      {festivalGalleries.map((festival) => <Chip key={festival.key} selected={filter === festival.key}
        onToggle={() => onFilter(filter === festival.key ? null : festival.key)}>{festival.label[language]}</Chip>)}
    </div>
    <ul className="mt-5 columns-1 gap-5 sm:columns-2 lg:columns-3 xl:columns-4">
      {shown.map(({ photo, festival }) => <li key={photo.key} className="mb-5 break-inside-avoid">
        <figure>
          <Image src={photo.src} alt={photo.caption[language]} width={photo.width} height={photo.height}
            sizes="(min-width: 1280px) 300px, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="h-auto w-full rounded-card" />
          <figcaption className="type-caption mt-2 text-ink-muted">
            {/* The festival name only in the mixed view; one festival shown needs only the captions. */}
            {filter === null && <span className="block font-semibold text-ink">{festival.label[language]}</span>}
            {photo.caption[language]}<span className="block"><PhotoSource photo={photo} /></span>
          </figcaption>
        </figure>
      </li>)}
    </ul>
    {shown.length < photos.length && <button type="button" onClick={() => setAll(true)}
      className="press mt-2 inline-flex min-h-[48px] items-center rounded-control border-2 border-hero-red bg-white px-6 font-semibold text-hero-red hover:brightness-95">
      {tr("Show more photos")} <span className="tnum ml-1">({photos.length - shown.length})</span></button>}
  </>;
}

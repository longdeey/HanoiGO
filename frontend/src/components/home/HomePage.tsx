"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CaretLeft, CaretRight, CloudRain, Sun } from "@phosphor-icons/react";

import { fetchHolidays, fetchStories, fetchTrip, fetchWeather } from "@/services/api";
import { usePrefs } from "@/lib/prefs";
import { nameLang } from "@/lib/lang";
import { hanoiImages, imagePlaces } from "@/data/hanoi-images";
import { storyForImage } from "@/data/story-photos";
import { formatDateRange, sentence, todayInHanoi } from "@/lib/format";
import { ownerToken, savedTripIds, tripIsToday, tripSummary, type TripSummary } from "@/lib/storage";
import { OPTION_LABELS, optionHref } from "@/lib/trip";
import { Signboard, StreetPlate } from "@/components/ui/Signboard";
import { Collage, type Canvas, type Clip } from "@/components/ui/Collage";
import { Button, ButtonLink } from "@/components/ui/Button";
import { MoneyInput, Stepper } from "@/components/ui/Controls";
import { ErrorState, PhotoCredit, Skeleton, apiErrorMessage } from "@/components/ui/States";

const HANOI_CENTER = { latitude: 21.0285, longitude: 105.8542 };
const DAY_CHOICES = [1, 2, 3, 4] as const;

// Before paint on the client (M03 must start with the sign), a no-op on the server.
const useBeforePaint = typeof window === "undefined" ? useEffect : useLayoutEffect;
const SIGN_PAINTED = "hanoigo-sign-painted";

/**
 * M03, once per browser session: the inline script in the root layout marks a
 * first home load before paint; reaching home inside the app is marked here.
 * The mark is cleared when the paint is done, so coming back does not repaint.
 */
function useSignPaintOncePerSession() {
  useBeforePaint(() => {
    const root = document.documentElement;
    if (root.dataset.signPaint !== "1") {
      try {
        if (sessionStorage.getItem(SIGN_PAINTED)) return;
        sessionStorage.setItem(SIGN_PAINTED, "1");
      } catch { return; }
      root.dataset.signPaint = "1";
    }
    const timer = window.setTimeout(() => { delete root.dataset.signPaint; }, 1200);
    return () => { window.clearTimeout(timer); delete root.dataset.signPaint; };
  }, []);
}

export function HomePage() {
  useSignPaintOncePerSession();
  return <>
    <Hero />
    <div className="mx-auto max-w-page px-4 sm:px-6 lg:px-10">
      <OngoingTrip />
      <PhotoStrip />
      <FeaturedStories />
      <UpcomingFestivals />
      <HomeFooter />
    </div>
  </>;
}

function HomeFooter() {
  const { tr } = usePrefs();
  return <footer className="type-small mt-16 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-6 text-ink-muted">
    <Link href="/credits" className="inline-flex min-h-[44px] items-center underline-offset-4 hover:underline">{tr("Photo credits")}</Link>
    <span className="inline-flex min-h-[44px] items-center">{tr("Map data")} © OpenStreetMap contributors</span>
  </footer>;
}

const HEADLINE_STREETS = { vi: "Hà Nội 36 phố phường", en: "The 36 streets of old Hanoi" };
const HEADLINE_LAKE = { vi: "Một vòng Hồ Gươm", en: "Around Hoan Kiem Lake" };
// Each canvas is laid out in design pixels on a fixed aspect ratio, with a
// clear gutter between clippings (wider than a tilt can swing a corner), so no
// clipping covers another's photo or caption at any width or zoom.
const PHONE_CANVAS: Canvas = { w: 400, h: 540 };
const PHONE_CLIPS: Clip[] = [
  { image: "hero", x: 14, y: 22, w: 222, h: 192, tilt: -3 },
  { image: "food", x: 254, y: 30, w: 132, h: 160, tilt: 4 },
  { headline: HEADLINE_STREETS, headlineSize: 19, x: 18, y: 238, w: 152, h: 140, tilt: 2 },
  { image: "old-quarter", x: 190, y: 214, w: 196, h: 170, tilt: -2 },
  { image: "coffee", x: 16, y: 400, w: 168, h: 124, tilt: -4 },
  { image: "local_experience", x: 204, y: 408, w: 180, h: 116, tilt: 3 },
];
const DESKTOP_CANVAS: Canvas = { w: 1200, h: 480 };
const DESKTOP_CLIPS: Clip[] = [
  { image: "hero", x: 18, y: 26, w: 250, h: 214, tilt: -3 },
  { image: "old-quarter", x: 294, y: 36, w: 330, h: 254, tilt: 2 },
  { image: "one_pillar_pagoda", x: 652, y: 22, w: 200, h: 228, tilt: -2 },
  { image: "festival", x: 880, y: 34, w: 300, h: 222, tilt: 3 },
  { headline: HEADLINE_STREETS, headlineSize: 26, x: 26, y: 268, w: 232, h: 186, tilt: 2 },
  { image: "coffee", x: 300, y: 318, w: 150, h: 148, tilt: -4 },
  { image: "food", x: 474, y: 320, w: 156, h: 146, tilt: 3 },
  { image: "local_experience", x: 658, y: 278, w: 210, h: 186, tilt: 3 },
  { headline: HEADLINE_LAKE, headlineSize: 20, x: 892, y: 286, w: 140, h: 172, tilt: -3 },
  { image: "craft", x: 1054, y: 290, w: 130, h: 168, tilt: 4 },
];

function Hero() {
  const { tr, language } = usePrefs();
  const router = useRouter();
  const [days, setDays] = useState(3);
  const [moreDays, setMoreDays] = useState(false);
  const [people, setPeople] = useState(2);
  const [budget, setBudget] = useState(3_000_000);
  const today = todayInHanoi();
  const weather = useQuery({
    queryKey: ["weather", "home", today],
    queryFn: () => fetchWeather(HANOI_CENTER.latitude, HANOI_CENTER.longitude, today),
    staleTime: 30 * 60 * 1000, retry: false,
  });
  const rain = weather.data?.available && weather.data.afternoonRainProbability !== null ? weather.data.afternoonRainProbability : null;
  const query = { step: "1", days: String(days), people: String(people), budget: String(budget || 3_000_000) };
  function start(event: React.FormEvent) {
    event.preventDefault();
    router.push(`/plan?${new URLSearchParams(query)}`);
  }
  // The collage band on top, the sign and the quick plan below it on their own
  // paper: nothing in the form ever sits on the photos.
  return <section aria-labelledby="hero-sign" className="collage-table collage-table-hero overflow-hidden">
    <div className="mx-auto max-w-page pt-2 sm:px-2 lg:px-6 lg:pt-4">
      <Collage canvas={PHONE_CANVAS} clips={PHONE_CLIPS} className="mx-auto max-w-[560px] md:hidden" sizes="(min-width: 560px) 300px, 55vw" />
      <Collage canvas={DESKTOP_CANVAS} clips={DESKTOP_CLIPS} className="hidden md:block" sizes="(min-width: 1280px) 340px, 28vw" />
    </div>
    <div className="mx-auto max-w-page pb-4 pt-6 sm:px-2 lg:grid lg:grid-cols-12 lg:items-start lg:gap-10 lg:px-6 lg:pb-8 lg:pt-10">
      <div className="lg:col-span-5 lg:sticky lg:top-24">
        <Signboard paintOnce textClassName="type-display-sign" as="h1"><span id="hero-sign">{tr("How many days do you have in Hanoi?")}</span></Signboard>
      </div>
      {/* A real GET form: tapping before the page hydrates still opens step 1. */}
      <form action="/plan" method="get" onSubmit={start} className="mt-6 rounded-card bg-paper p-4 shadow-sheet sm:p-6 lg:col-span-7 lg:mt-0 lg:p-8">
        {Object.entries(query).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
        <div className="space-y-6">
          <fieldset>
            <legend className="mb-2 font-semibold">{tr("Days")}</legend>
            <div className="flex flex-wrap gap-2">
              {DAY_CHOICES.map((value) => <button key={value} type="button" aria-pressed={!moreDays && days === value}
                onClick={() => { setMoreDays(false); setDays(value); }}
                className={`press tnum h-12 min-w-12 rounded-control border px-3 text-lg font-semibold ${!moreDays && days === value ? "border-2 border-sign-red bg-sign-red-soft text-sign-red-text" : "border-line-strong hover:bg-paper-sunken"}`}>
                {value}</button>)}
              <button type="button" aria-pressed={moreDays} onClick={() => { setMoreDays(true); setDays(Math.max(5, days)); }}
                className={`press h-12 rounded-control border px-3 text-lg font-semibold ${moreDays ? "border-2 border-sign-red bg-sign-red-soft text-sign-red-text" : "border-line-strong hover:bg-paper-sunken"}`}>5+</button>
            </div>
            {moreDays && <div className="mt-3"><Stepper id="home-days" label={tr("Days")} value={days} min={5} max={14} onChange={setDays} /></div>}
          </fieldset>
          <div className="grid gap-6 sm:grid-cols-2 sm:items-end">
            <div>
              <label htmlFor="home-budget" className="mb-2 block font-semibold">{tr("Budget")}</label>
              <MoneyInput id="home-budget" value={budget} onChange={setBudget} language={language} />
            </div>
            <div className="sm:pb-1"><Stepper id="home-people" label={tr("People")} value={people} min={1} max={20} onChange={setPeople} /></div>
          </div>
          <Button type="submit" variant="primary" className="w-full">{tr("Plan my trip")}</Button>
          {rain !== null && <p className="type-small flex items-center gap-2 text-ink-muted">
            {rain >= 0.6 ? <CloudRain size={20} aria-hidden /> : <Sun size={20} aria-hidden />}
            {tr("This afternoon in Hanoi")}: {tr("chance of rain")} <span className="tnum">{Math.round(rain * 100)}%</span>
          </p>}
          <p className="type-caption text-ink-muted">{tr("Photos")}: Wikimedia Commons. <Link href="/credits" className="inline-flex min-h-[24px] items-center underline underline-offset-2">{tr("Photo credits")}</Link></p>
        </div>
      </form>
    </div>
  </section>;
}

// ── Hanoi, street by street: every photo, with its story when there is one ─
const STRIP = ["old-quarter", "food", "history", "local_experience", "coffee", "festival", "one_pillar_pagoda", "art", "shopping",
  "craft", "park", "hidden_gem", "imperial_citadel", "flag_tower", "nature", "hiking", "museum", "accommodation", "ho_chi_minh_mausoleum", "hero"];

function PhotoStrip() {
  const { tr, language } = usePrefs();
  const stories = useQuery({ queryKey: ["stories", language], queryFn: () => fetchStories(language), staleTime: Infinity });
  const storyFor = new Map((stories.data ?? []).filter((story) => story.imageKey).map((story) => [story.imageKey as string, story]));
  // Stories now open on their own photos; the strip's Wikimedia photos still lead to them.
  const bySlug = new Map((stories.data ?? []).map((story) => [story.slug, story]));
  const rail = useRef<HTMLUListElement>(null);
  const scroll = (direction: number) => {
    const element = rail.current;
    if (!element) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollBy({ left: direction * element.clientWidth * 0.8, behavior: reduce ? "auto" : "smooth" });
  };
  return <section aria-labelledby="strip-title" className="mt-12">
    <div className="flex items-end justify-between gap-4">
      <StreetPlate id="strip-title">{tr("Hanoi, street by street")}</StreetPlate>
      <div className="hidden gap-2 sm:flex">
        <button type="button" onClick={() => scroll(-1)} aria-label={tr("Previous photos")} className="press grid h-11 w-11 place-items-center rounded-full border border-line-strong hover:bg-paper-sunken"><CaretLeft size={20} aria-hidden /></button>
        <button type="button" onClick={() => scroll(1)} aria-label={tr("Next photos")} className="press grid h-11 w-11 place-items-center rounded-full border border-line-strong hover:bg-paper-sunken"><CaretRight size={20} aria-hidden /></button>
      </div>
    </div>
    <ul ref={rail} tabIndex={0} aria-labelledby="strip-title" className="rail -mx-4 mt-4 gap-4 px-4 pb-4 pt-2 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
      {STRIP.filter((key) => hanoiImages[key]).map((key, index) => {
        const image = hanoiImages[key];
        const story = storyFor.get(key) ?? bySlug.get(storyForImage[key] ?? "");
        const body = <>
          <span className="relative block aspect-[4/5] w-full overflow-hidden">
            <Image src={image.src} alt={image.alt} fill sizes="224px" className="object-cover" />
          </span>
          <span className="mt-2 block"><StreetPlate as="span" size="sm">{imagePlaces[key]?.[language] ?? image.title}</StreetPlate></span>
          {story && <span className="print-link type-small mt-1 block font-semibold">{tr("Read the story")}</span>}
        </>;
        return <li key={key} className="print w-48 sm:w-56" style={{ ["--tilt" as string]: `${index % 2 === 0 ? -1.5 : 1.5}deg` }}>
          {story ? <Link href={`/stories/${story.slug}`} className="block">{body}</Link> : <div>{body}</div>}
        </li>;
      })}
    </ul>
    <Link href="/credits" className="type-small inline-flex min-h-[44px] items-center text-ink-muted underline underline-offset-4">{tr("Photo credits")}</Link>
  </section>;
}

/** Only when a trip saved on this device covers today (spec §8.2). */
function OngoingTrip() {
  const { tr, language } = usePrefs();
  const [summary, setSummary] = useState<TripSummary | null>(null);
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    const today = todayInHanoi();
    const found = savedTripIds().map((id) => tripSummary(id)).find((item): item is TripSummary => Boolean(item && tripIsToday(item, today)));
    if (found) { setSummary(found); setToken(ownerToken(found.tripId)); }
  }, []);
  const trip = useQuery({
    queryKey: ["trip", summary?.tripId],
    queryFn: () => fetchTrip(summary!.tripId, token!),
    enabled: Boolean(summary && token), retry: false,
  });
  if (!summary || !trip.data) return null;
  const option = trip.data.options[0];
  const today = todayInHanoi();
  const day = option?.days.find((item) => item.date === today);
  if (!option || !day) return null;
  const now = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" }).format(new Date());
  const nextStop = day.items.find((item) => item.startTime >= now);
  return <section aria-labelledby="ongoing" className="mt-12 rounded-card border border-line p-4">
    <h2 id="ongoing" className="type-h3">{tr("Trip in progress")}</h2>
    <p className="mt-1">{tr("Day")} {day.dayNumber} / {option.days.length}, {tr(OPTION_LABELS[option.type])}</p>
    {nextStop && <p className="text-ink-muted">{tr("Next")} <span className="tnum">{nextStop.startTime}</span> <span lang={nameLang(nextStop.place.name, language)}>{nextStop.place.name}</span></p>}
    <ButtonLink href={optionHref(summary.tripId, option.id, null, `day=${day.dayNumber}`)} variant="secondary" className="mt-4">{tr("Open today's itinerary")}</ButtonLink>
  </section>;
}

function UpcomingFestivals() {
  const { tr, language } = usePrefs();
  const today = todayInHanoi();
  const holidays = useQuery({
    queryKey: ["holidays", today, 60, language],
    queryFn: () => fetchHolidays(today, 60, language),
    staleTime: 60 * 60 * 1000,
  });
  const items = (holidays.data ?? []).slice(0, 6);
  const month = (date: string) => sentence(new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en-GB", { month: "long", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`)));
  return <section aria-labelledby="festivals-title" className="mt-12 min-w-0">
    <StreetPlate id="festivals-title">{tr("Festivals coming up")}</StreetPlate>
    {holidays.isPending ? <div className="mt-4 grid gap-3 sm:grid-cols-3"><Skeleton className="h-40" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div> :
      holidays.isError ? <div className="mt-4"><ErrorState message={apiErrorMessage(holidays.error, tr)} onRetry={() => void holidays.refetch()} /></div> :
      items.length === 0 ? <p className="mt-4 text-ink-muted">{tr("No festivals in the next two months.")}</p> :
      <ul className="rail -mx-4 mt-4 gap-3 px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0 lg:grid-cols-6">
        {items.map((holiday) => <li key={`${holiday.key}-${holiday.startDate}`} className="w-40 sm:w-auto">
          <Link href={`/plan?step=1&startDate=${holiday.startDate < today ? today : holiday.startDate}`} className="calendar-page press block h-full">
            <span className="calendar-page-head block">{month(holiday.startDate)}</span>
            <span className="calendar-page-day tnum block">{Number(holiday.startDate.slice(8, 10))}</span>
            <span className="block px-3 pb-3">
              <span className="block font-semibold" lang={nameLang(holiday.name, language)}>{holiday.name}</span>
              <span className="type-small tnum block text-ink-muted">{formatDateRange(holiday.startDate, holiday.endDate, language)}</span>
              <span className="type-small mt-1 block font-semibold text-sign-red-text">{tr("Plan for these dates")}</span>
            </span>
          </Link>
        </li>)}
      </ul>}
    <Link href="/festivals" className="mt-3 inline-flex min-h-[44px] items-center font-semibold text-sign-blue underline-offset-4 hover:underline">{tr("See the whole year")}</Link>
  </section>;
}

function FeaturedStories() {
  const { tr, language } = usePrefs();
  const stories = useQuery({ queryKey: ["stories", language], queryFn: () => fetchStories(language), staleTime: Infinity });
  const withPhoto = (stories.data ?? []).filter((story) => story.featured && story.imageKey && story.imageKey !== "hero" && hanoiImages[story.imageKey]);
  const lead = withPhoto[0];
  const tiles = withPhoto.slice(1, 5);
  const rest = (stories.data ?? []).filter((story) => story !== lead && !tiles.includes(story)).slice(0, lead ? 3 : 4);
  return <section aria-labelledby="stories-title" className="mt-12 min-w-0">
    <StreetPlate id="stories-title">{tr("Stories about Hanoi")}</StreetPlate>
    {stories.isPending ? <Skeleton className="mt-4 aspect-[3/2]" /> :
      stories.isError ? <div className="mt-4"><ErrorState message={apiErrorMessage(stories.error, tr)} onRetry={() => void stories.refetch()} /></div> :
      (stories.data ?? []).length === 0 ? <p className="mt-4 text-ink-muted">{tr("No stories yet.")}</p> :
      <div className="mt-4 grid gap-6 lg:grid-cols-12">
        {lead && <article className="lg:col-span-6">
          <Link href={`/stories/${lead.slug}`} className="photo-zoom block">
            <figure className="relative aspect-[3/2] overflow-hidden rounded-card">
              <Image src={hanoiImages[lead.imageKey!].src} alt={hanoiImages[lead.imageKey!].alt} fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
            </figure>
          </Link>
          <PhotoCredit imageKey={lead.imageKey!} className="mt-2" />
          <h3 className="type-h3 mt-3"><Link href={`/stories/${lead.slug}`} className="hover:underline" lang={nameLang(lead.title, language)}>{lead.title}</Link></h3>
          <p className="mt-1 line-clamp-2 text-ink-muted">{lead.teaser}</p>
          <p className="type-small mt-1 text-ink-muted">{lead.readingMinutes} {tr("min read")}</p>
        </article>}
        <div className="lg:col-span-6">
          {tiles.length > 0 && <ul className="grid grid-cols-2 gap-4">
            {tiles.map((story, index) => <li key={story.slug} className="print" style={{ ["--tilt" as string]: `${index % 2 === 0 ? -1 : 1}deg` }}>
              <Link href={`/stories/${story.slug}`} className="block">
                <span className="relative block aspect-[4/3] overflow-hidden">
                  <Image src={hanoiImages[story.imageKey!].src} alt={hanoiImages[story.imageKey!].alt} fill sizes="(min-width: 1024px) 22vw, 45vw" className="object-cover" />
                </span>
                <span className="mt-2 block font-semibold leading-snug" lang={nameLang(story.title, language)}>{story.title}</span>
                <span className="print-muted type-small block">{story.readingMinutes} {tr("min read")}</span>
              </Link>
            </li>)}
          </ul>}
          {rest.length > 0 && <ul className="mt-4 divide-y divide-line">
            {rest.map((story) => <li key={story.slug}>
              <Link href={`/stories/${story.slug}`} className="flex min-h-[56px] items-center justify-between gap-4 py-3 hover:underline">
                <span className="font-semibold" lang={nameLang(story.title, language)}>{story.title}</span>
                <span className="type-small shrink-0 text-ink-muted">{story.readingMinutes} {tr("min")}</span>
              </Link>
            </li>)}
          </ul>}
        </div>
      </div>}
    <Link href="/stories" className="mt-3 inline-flex min-h-[44px] items-center font-semibold text-sign-blue underline-offset-4 hover:underline">{tr("See all stories")}</Link>
  </section>;
}

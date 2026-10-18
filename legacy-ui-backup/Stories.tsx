"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";

import { fetchStories, fetchStory } from "@/services/api";
import { googleMapsDirectionsUrl } from "@/services/maps";
import { hanoiImages } from "@/data/hanoi-images";
import { translate, type Language } from "@/i18n";
import type { Place, PlaceStory, StorySummary, TripResponse } from "@/types/trip";

// Shown while stories load or when the API is unavailable, so the home page
// never loses its landmark photos.
const FALLBACK_TILES: [string, string][] = [
  ["history", "Temple of Literature"], ["one_pillar_pagoda", "One Pillar Pagoda"],
  ["imperial_citadel", "Imperial Citadel of Thang Long"], ["ho_chi_minh_mausoleum", "Ho Chi Minh Mausoleum"],
  ["park", "Tran Quoc Pagoda, West Lake"], ["hidden_gem", "St. Joseph's Cathedral"],
  ["art", "Hanoi Opera House"], ["local_experience", "Long Bien Bridge"],
  ["flag_tower", "Hanoi Flag Tower"], ["old-quarter", "Hanoi Old Quarter"],
  ["shopping", "Dong Xuan Market"], ["nature", "Duong Lam ancient village"],
];
const TILE_SIZES = "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw";

export function StoryHighlights({ language, readSlugs, onOpen }: {
  language: Language; readSlugs: ReadonlySet<string>; onOpen: (slug: string) => void;
}) {
  const tr = (text: string) => translate(language, text);
  const stories = useQuery({ queryKey: ["stories", language], queryFn: () => fetchStories(language), staleTime: Infinity });
  const withPhoto = (stories.data ?? []).filter((story) => story.featured && story.imageKey && hanoiImages[story.imageKey]);
  const others = (stories.data ?? []).filter((story) => !withPhoto.includes(story));
  return <section aria-label={tr("Stories of Hanoi")} className="mx-auto max-w-6xl px-5 pt-10">
    <h2 className="text-2xl font-black text-brand-red-deep">{tr("Stories of Hanoi")}</h2>
    <p className="mt-1 text-sm text-brand-muted">{tr("Tap a landmark to read its history, legends and what to know before you go.")}</p>
    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {withPhoto.length > 0 ? withPhoto.map((story) => <StoryTile key={story.slug} story={story} language={language}
        read={readSlugs.has(story.slug)} onOpen={onOpen} />) :
        FALLBACK_TILES.map(([key, label]) => <figure key={key} className="photo-tile aspect-[4/3]">
          <Image src={hanoiImages[key].src} alt={hanoiImages[key].alt} fill sizes={TILE_SIZES} />
          <figcaption className="photo-tile-label text-sm">{tr(label)}</figcaption></figure>)}
    </div>
    {others.length > 0 && <div className="mt-4">
      <p className="text-xs font-bold uppercase tracking-widest text-brand-muted">{tr("More stories")}</p>
      <div className="mt-2 flex flex-wrap gap-2">{others.map((story) =>
        <button key={story.slug} type="button" onClick={() => onOpen(story.slug)}
          className="rounded-full border border-brand-line bg-white px-3 py-2 text-sm font-semibold text-brand-red-deep hover:border-brand-red">
          {readSlugs.has(story.slug) ? "✓ " : "📖 "}{story.title}</button>)}</div>
    </div>}
  </section>;
}

function StoryTile({ story, language, read, onOpen }: {
  story: StorySummary; language: Language; read: boolean; onOpen: (slug: string) => void;
}) {
  const tr = (text: string) => translate(language, text);
  const image = hanoiImages[story.imageKey ?? ""];
  return <button type="button" onClick={() => onOpen(story.slug)} className="photo-tile aspect-[4/3] text-left"
    aria-label={`${story.title}. ${tr("Read the story")}`}>
    <Image src={image.src} alt={image.alt} fill sizes={TILE_SIZES} />
    {read && <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-1 text-xs font-bold text-brand-red-deep">✓ {tr("Read")}</span>}
    <span className="photo-tile-label block text-sm">{story.title}
      <span className="mt-1 block text-xs font-semibold text-brand-yellow">📖 {story.readingMinutes} {tr("min read")}</span></span>
  </button>;
}

/** Compact link from an itinerary stop (or a holiday place) to its story. */
export function PlaceStoryCard({ story, language, onOpen }: {
  story: PlaceStory; language: Language; onOpen: (slug: string) => void;
}) {
  const tr = (text: string) => translate(language, text);
  return <div className="mt-3 rounded-xl border border-[#e7d4ad] bg-[#fff8e9] p-3 text-sm">
    <p className="text-xs font-bold uppercase tracking-wide text-[#6b3c1c]">📖 {tr("Story")} · {story.readingMinutes} {tr("min read")}</p>
    <p className="mt-1 font-bold text-brand-ink">{story.title}</p>
    <p className="mt-1 text-[#73593e]">{story.teaser}</p>
    <button type="button" onClick={() => onOpen(story.slug)} className="mt-2 font-bold text-brand-red underline">{tr("Read the story")}</button>
  </div>;
}

export function StoryReader({ slug, language, travelMode, onClose, onOpen, onRead, onPlanFrom }: {
  slug: string; language: Language; travelMode: TripResponse["travelMode"];
  onClose: () => void; onOpen: (slug: string) => void; onRead: (slug: string) => void;
  onPlanFrom?: (place: Place) => void;
}) {
  const tr = (text: string) => translate(language, text);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const story = useQuery({ queryKey: ["story", slug, language], queryFn: () => fetchStory(slug, language), staleTime: Infinity });
  useEffect(() => {
    closeRef.current?.focus();
    panelRef.current?.scrollTo?.({ top: 0 });
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slug, onClose]);
  useEffect(() => { if (story.data) onRead(story.data.slug); }, [story.data, onRead]);
  const data = story.data;
  const image = data?.imageKey ? hanoiImages[data.imageKey] : undefined;
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="story-title"
      className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
      <div className="sticky top-0 z-10 flex justify-end bg-gradient-to-b from-white/95 to-white/0 p-3">
        <button ref={closeRef} type="button" onClick={onClose}
          className="rounded-full bg-white px-4 py-2 text-sm font-bold text-brand-red shadow">{tr("Close")} ✕</button>
      </div>
      {story.isPending && <p role="status" className="px-6 pb-10 text-center font-semibold text-brand-red">{tr("Loading story...")}</p>}
      {story.isError && <p role="alert" className="px-6 pb-10 text-center text-red-800">{tr("Could not load this story.")}</p>}
      {data && <article className="-mt-14">
        {image && <figure className="relative aspect-[16/9] w-full">
          <Image src={image.src} alt={image.alt} fill priority sizes="(min-width: 768px) 768px, 100vw" className="object-cover sm:rounded-t-3xl" />
          <figcaption className="absolute bottom-1 right-2 rounded bg-black/50 px-2 py-0.5 text-[10px] text-white">
            {tr("Photo")}: <a href={image.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">{image.author}</a> · {image.license}
          </figcaption>
        </figure>}
        <div className={`px-6 pb-8 ${image ? "pt-6" : "pt-16"}`}>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-red">📖 {tr("Story")} · {data.readingMinutes} {tr("min read")}
            {data.themes.length > 0 && <span className="text-brand-muted"> · {data.themes.map((theme) => tr(theme).replaceAll("_", " ")).join(" · ")}</span>}</p>
          <h2 id="story-title" className="mt-2 text-3xl font-black text-brand-red-deep">{data.title}</h2>
          <p className="mt-3 text-lg font-semibold leading-relaxed text-brand-ink">{data.teaser}</p>
          {data.sections.map((section) => <section key={section.heading} className="mt-6">
            <h3 className="text-xl font-bold text-brand-maroon">{section.heading}</h3>
            {section.body.split(/\n\n+/).map((paragraph) =>
              <p key={paragraph.slice(0, 40)} className="mt-2 leading-relaxed">{paragraph}</p>)}
          </section>)}
          {data.timeline.length > 0 && <section className="mt-7 rounded-2xl bg-brand-sand p-5">
            <h3 className="font-bold text-brand-maroon">{tr("Timeline")}</h3>
            <ol className="mt-3 space-y-2 text-sm">{data.timeline.map((entry) =>
              <li key={`${entry.year}-${entry.text.slice(0, 20)}`} className="flex gap-3">
                <span className="w-16 shrink-0 font-black text-brand-red">{entry.year}</span><span>{entry.text}</span></li>)}</ol>
          </section>}
          {data.tips.length > 0 && <section className="mt-5 rounded-2xl border border-brand-line p-5">
            <h3 className="font-bold text-brand-maroon">{tr("When you visit")}</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{data.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
          </section>}
          {data.place && <div className="mt-5 flex flex-wrap items-center gap-4">
            <a href={googleMapsDirectionsUrl(data.place, travelMode)} target="_blank" rel="noopener noreferrer"
              className="text-sm font-bold text-brand-red underline">{tr("Navigate with Google Maps")}</a>
            {onPlanFrom && <button type="button" onClick={() => onPlanFrom(data.place as Place)}
              className="rounded-xl bg-brand-red px-4 py-2 text-sm font-bold text-white">{tr("Plan a trip from here")}</button>}
          </div>}
          {data.nearby.length > 0 && <section className="mt-7">
            <h3 className="font-bold text-brand-maroon">{tr("Nearby stories")}</h3>
            <div className="mt-2 flex flex-wrap gap-2">{data.nearby.map((other) =>
              <button key={other.slug} type="button" onClick={() => onOpen(other.slug)}
                className="rounded-full border border-brand-line px-3 py-2 text-sm font-semibold text-brand-red-deep hover:border-brand-red">
                {other.title} <span className="font-normal text-brand-muted">· {other.distanceKm.toFixed(1)} km</span></button>)}</div>
          </section>}
          <section className="mt-7 border-t border-brand-line pt-4 text-xs text-brand-muted">
            <h3 className="font-bold uppercase tracking-widest">{tr("Sources")}</h3>
            <ul className="mt-2 space-y-1">{data.sources.map((source) => <li key={source.url}>
              <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline">{source.title}</a></li>)}</ul>
            <p className="mt-3">{tr("Opening hours and visiting rules can change; check the official source before you go.")}</p>
          </section>
        </div>
      </article>}
    </div>
  </div>;
}

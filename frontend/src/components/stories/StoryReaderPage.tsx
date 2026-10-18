"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { NavigationArrow, Path, SealCheck } from "@phosphor-icons/react";

import type { StoryDetail } from "@/types/trip";
import { ApiRequestError, fetchStory } from "@/services/api";
import { usePrefs } from "@/lib/prefs";
import { nameLang } from "@/lib/lang";
import { markStoryRead } from "@/lib/storage";
import { sentence } from "@/lib/format";
import { hanoiImages } from "@/data/hanoi-images";
import { storyPhotos, type StoryPhoto } from "@/data/story-photos";
import { googleMapsDirectionsUrl } from "@/services/maps";
import { usePageChrome } from "@/components/shell/chrome";
import { Signboard } from "@/components/ui/Signboard";
import { ButtonLink, buttonClass } from "@/components/ui/Button";
import { EmptyState, ErrorState, PhotoCredit, PhotoSource, Skeleton, apiErrorMessage } from "@/components/ui/States";

/** The landmark name is the sign; the rest of the title becomes the subtitle. */
function splitTitle(title: string): [string, string | null] {
  const index = title.indexOf(":");
  return index > 0 ? [title.slice(0, index).trim(), sentence(title.slice(index + 1).trim())] : [title, null];
}

/** M23: hide the bottom bar while scrolling down; show it on the way up and at the end. */
function useHideOnScrollDown(): boolean {
  const [hidden, setHidden] = useState(false);
  const last = useRef(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const onScroll = () => {
      const y = window.scrollY;
      const atEnd = window.innerHeight + y >= document.documentElement.scrollHeight - 80;
      setHidden(y > last.current && y > 200 && !atEnd);
      last.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return hidden;
}

export function StoryReaderPage({ slug }: { slug: string }) {
  const { tr, language } = usePrefs();
  const hidden = useHideOnScrollDown();
  const story = useQuery({ queryKey: ["story", slug, language], queryFn: () => fetchStory(slug, language), staleTime: Infinity, retry: false });
  usePageChrome({ title: story.data ? splitTitle(story.data.title)[0] : tr("Story"), backHref: "/stories", hideBottomNav: hidden });
  useEffect(() => { if (story.data) markStoryRead(story.data.slug); }, [story.data]);
  if (story.isPending) return <div role="status" className="mx-auto max-w-page space-y-4 px-4 pt-6 sm:px-6 lg:px-10">
    <span className="sr-only">{tr("Loading story...")}</span><Skeleton className="aspect-[4/5] lg:aspect-[16/9]" /><Skeleton className="h-20 w-2/3" /><Skeleton className="h-40" />
  </div>;
  if (story.isError) return story.error instanceof ApiRequestError && story.error.code === "NOT_FOUND"
    ? <EmptyState title={tr("This story does not exist.")} action={<ButtonLink href="/stories" variant="secondary">{tr("See all stories")}</ButtonLink>} />
    : <div className="mx-auto max-w-xl px-4 pt-12"><ErrorState message={apiErrorMessage(story.error, tr)} onRetry={() => void story.refetch()} /></div>;
  return <Reader story={story.data} />;
}

function Reader({ story }: { story: StoryDetail }) {
  const { tr, language } = usePrefs();
  const [sign, subtitle] = splitTitle(story.title);
  const image = story.imageKey ? hanoiImages[story.imageKey] : undefined;
  const [tocOpen, setTocOpen] = useState(false);
  const sectionId = (index: number) => `section-${index + 1}`;
  // The story's other photos: one under each section, the rest together after the last one.
  const photos = (storyPhotos[story.slug] ?? []).filter((photo) => photo.key !== story.imageKey);
  const morePhotos = photos.slice(story.sections.length);
  const toc = <nav aria-label={tr("In this story")}>
    <ol className="space-y-1">{story.sections.map((section, index) => <li key={section.heading}>
      <a href={`#${sectionId(index)}`} className="inline-flex min-h-[44px] items-center text-sign-blue underline-offset-4 hover:underline">{section.heading}</a>
    </li>)}</ol>
  </nav>;
  return <article className="pb-12">
    {/* M22: reading progress, scroll-driven where the browser supports it. */}
    <div className="fixed inset-x-0 top-[var(--topbar-h)] z-30 h-0.5" aria-hidden><div className="read-progress h-full bg-ink" /></div>
    <div className="mx-auto max-w-page px-4 sm:px-6 lg:px-10">
      {image && <figure className="pt-2 lg:pt-6">
        <div className="reader-hero relative aspect-[4/5] overflow-hidden rounded-card lg:aspect-[16/9]">
          <Image src={image.src} alt={image.alt} fill priority sizes="(min-width: 1280px) 1200px, 100vw" className="object-cover" />
        </div>
        <PhotoCredit imageKey={story.imageKey!} className="mt-2" />
      </figure>}
      <div className="mt-8 lg:grid lg:grid-cols-12 lg:gap-10">
        <div className="min-w-0 lg:col-span-8">
          <Signboard as="h1" textClassName="type-display" lang={nameLang(sign, language)}>{sign}</Signboard>
          {subtitle && <p className="type-h3 mt-4 max-w-read">{subtitle}</p>}
          <p className="type-small mt-3 text-ink-muted">{story.readingMinutes} {tr("min read")}</p>
          <p className="type-body-read mt-6 max-w-read font-medium">{story.teaser}</p>
          {story.sections.length > 1 && <div className="mt-6 lg:hidden">
            <button type="button" aria-expanded={tocOpen} onClick={() => setTocOpen(!tocOpen)} className="min-h-[44px] font-semibold text-sign-blue">
              {tr("In this story")}</button>
            {tocOpen && <div className="mt-1">{toc}</div>}
          </div>}
          {story.sections.map((section, index) => <section key={section.heading} id={sectionId(index)} className="mt-12 max-w-read">
            <h2 className="type-h2">{section.heading}</h2>
            {section.body.split(/\n\n+/).map((paragraph) => <p key={paragraph.slice(0, 48)} className="type-body-read mt-4">{paragraph}</p>)}
            {photos[index] && <StoryFigure photo={photos[index]} />}
          </section>)}
          {morePhotos.length > 0 && <section className="mt-12" aria-labelledby="photos-title">
            <h2 id="photos-title" className="type-h2">{tr("More photos")}</h2>
            <ul className="mt-4 grid gap-6 sm:grid-cols-2">{morePhotos.map((photo) => <li key={photo.key}><StoryFigure photo={photo} grid /></li>)}</ul>
          </section>}
          {story.timeline.length > 0 && <section className="mt-12 max-w-read" aria-labelledby="timeline-title">
            <h2 id="timeline-title" className="type-h2">{tr("Timeline")}</h2>
            <ol className="relative mt-4 space-y-4 border-l-2 border-line pl-6">
              {story.timeline.map((entry) => <li key={`${entry.year}-${entry.text.slice(0, 16)}`} className="milestone relative">
                <span className="milestone-dot absolute -left-[33px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-ink bg-paper" aria-hidden />
                <p className="tnum font-bold" style={{ fontStretch: "112%" }}>{entry.year}</p>
                <p className="mt-1">{entry.text}</p>
              </li>)}
            </ol>
          </section>}
          {story.tips.length > 0 && <section className="mt-12 max-w-read" aria-labelledby="tips-title">
            <h2 id="tips-title" className="type-h2">{tr("When you visit")}</h2>
            <ul className="mt-4 list-disc space-y-2 pl-6">{story.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
          </section>}
          <section className="mt-12 max-w-read" aria-labelledby="sources-title">
            <h2 id="sources-title" className="type-h3 flex items-center gap-2"><SealCheck size={20} aria-hidden />{tr("Sources")}</h2>
            <ol className="type-small mt-3 list-decimal space-y-1 pl-6 text-ink-muted">{story.sources.map((source) => <li key={source.url}>
              <a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center underline underline-offset-2 hover:text-ink">{source.title}</a>
            </li>)}</ol>
            <p className="type-small mt-3 text-ink-muted">{tr("Opening hours and visiting rules can change; check the official source before you go.")}</p>
          </section>
          <div className="mt-12 lg:hidden"><LandmarkCard story={story} /></div>
          {story.nearby.length > 0 && <section className="mt-12" aria-labelledby="nearby-title">
            <h2 id="nearby-title" className="type-h3">{tr("Other stories within 2 km")}</h2>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">{story.nearby.map((other) => <li key={other.slug}>
              <Link href={`/stories/${other.slug}`} className="block rounded-card border border-line p-4 hover:border-line-strong">
                <span className="block font-semibold" lang={nameLang(other.title, language)}>{other.title}</span>
                <span className="type-small mt-1 flex gap-3 text-ink-muted"><span className="tnum">{other.distanceKm.toFixed(1)} km</span><span>{other.readingMinutes} {tr("min read")}</span></span>
              </Link>
            </li>)}</ul>
          </section>}
        </div>
        <aside className="hidden lg:col-span-4 lg:block">
          <div className="sticky top-[calc(var(--topbar-h)+24px)] space-y-8">
            <LandmarkCard story={story} />
            {story.sections.length > 1 && <div><h2 className="font-semibold">{tr("In this story")}</h2><div className="mt-2">{toc}</div></div>}
          </div>
        </aside>
      </div>
    </div>
  </article>;
}

/** A photo of the story with its caption and the source it comes from. */
function StoryFigure({ photo, grid = false }: { photo: StoryPhoto; grid?: boolean }) {
  const { language } = usePrefs();
  return <figure className={grid ? "" : "mt-6"}>
    {grid
      ? <span className="relative block aspect-[4/3] overflow-hidden rounded-card">
        <Image src={photo.src} alt={photo.caption[language]} fill sizes="(min-width: 1024px) 380px, (min-width: 640px) 45vw, 100vw" className="object-cover" />
      </span>
      : <Image src={photo.src} alt={photo.caption[language]} width={photo.width} height={photo.height}
        sizes="(min-width: 1024px) 680px, 100vw" className="max-h-[70vh] w-full rounded-card object-cover" />}
    <figcaption className="type-caption mt-2 text-ink-muted">
      {photo.caption[language]}<span className="block"><PhotoSource photo={photo} /></span>
    </figcaption>
  </figure>;
}

/** Directions and "plan from here" for the landmark the story is about. */
function LandmarkCard({ story }: { story: StoryDetail }) {
  const { tr, language } = usePrefs();
  const place = story.place;
  if (!place) return null;
  const plan = new URLSearchParams({ step: "2", startName: place.name, startLat: String(place.latitude), startLng: String(place.longitude) });
  return <section className="rounded-card border border-line p-4" aria-label={place.name}>
    <p className="font-semibold" lang={nameLang(place.name, language)}>{place.name}</p>
    <div className="mt-3 flex flex-wrap gap-3">
      <a href={googleMapsDirectionsUrl(place, "walking")} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary")}>
        <NavigationArrow size={20} aria-hidden />{tr("Directions")}</a>
      <Link href={`/plan?${plan}`} className={buttonClass("ink")}><Path size={20} aria-hidden />{tr("Plan from here")}</Link>
    </div>
  </section>;
}

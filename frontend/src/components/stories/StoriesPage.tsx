"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Check, Scroll } from "@phosphor-icons/react";

import type { StorySummary } from "@/types/trip";
import { fetchStories } from "@/services/api";
import { usePrefs } from "@/lib/prefs";
import { nameLang } from "@/lib/lang";
import { readStories } from "@/lib/storage";
import { hanoiImages } from "@/data/hanoi-images";
import { StreetPlate } from "@/components/ui/Signboard";
import { EmptyState, ErrorState, PhotoCredit, Skeleton, apiErrorMessage } from "@/components/ui/States";

type GroupKey = "landmarks" | "museums" | "festivals";
// Each group keeps one colour on its cards: landmarks red, museums street blue, festivals green.
const GROUPS: { key: GroupKey; title: string; accent: string }[] = [
  { key: "landmarks", title: "Landmarks", accent: "border-t-hero-red" },
  { key: "museums", title: "Museums", accent: "border-t-street-blue" },
  { key: "festivals", title: "Festivals", accent: "border-t-plate-green" },
];
const groupOf = (story: StorySummary): GroupKey =>
  story.themes.includes("festival") ? "festivals" : story.themes.includes("museum") ? "museums" : "landmarks";
const photoOf = (story: StorySummary) => (story.imageKey ? hanoiImages[story.imageKey] : undefined);

export function StoriesPage() {
  const { tr, language } = usePrefs();
  const stories = useQuery({ queryKey: ["stories", language], queryFn: () => fetchStories(language), staleTime: Infinity });
  const [read, setRead] = useState<Set<string>>(new Set());
  useEffect(() => { setRead(readStories()); }, []);
  const all = stories.data ?? [];
  // A spotlight on the first featured stories, then every other story by kind.
  const withPhoto = all.filter((story) => story.featured && photoOf(story));
  const lead = withPhoto[0];
  const side = withPhoto.slice(1, 3);
  const rest = all.filter((story) => story !== lead && !side.includes(story));
  return <div className="mx-auto max-w-page px-4 pb-12 sm:px-6 lg:px-10">
    <div className="pt-4 lg:pt-8"><StreetPlate as="h1" size="lg">{tr("Stories about Hanoi")}</StreetPlate></div>
    <p className="mt-2 max-w-read text-ink-muted">{tr("The history and legends behind Hanoi's landmarks, with what to know before you go.")}</p>
    {stories.isPending && <div className="mt-8 grid gap-6 lg:grid-cols-12"><Skeleton className="aspect-[3/2] lg:col-span-8" /><Skeleton className="h-48 lg:col-span-4" /></div>}
    {stories.isError && <div className="mt-8"><ErrorState message={apiErrorMessage(stories.error, tr)} onRetry={() => void stories.refetch()} /></div>}
    {stories.isSuccess && all.length === 0 && <div className="mt-8"><EmptyState title={tr("No stories yet.")} /></div>}
    {lead && <div className="mt-8 grid gap-8 lg:grid-cols-12">
      <article className="min-w-0 lg:col-span-8">
        <Link href={`/stories/${lead.slug}`} className="photo-zoom block">
          <figure className="relative aspect-[3/2] overflow-hidden rounded-card">
            <Image src={photoOf(lead)!.src} alt={photoOf(lead)!.alt} fill priority sizes="(min-width: 1024px) 60vw, 100vw" className="object-cover" />
          </figure>
        </Link>
        <PhotoCredit imageKey={lead.imageKey!} className="mt-2" />
        <h2 className="type-h2 mt-3"><Link href={`/stories/${lead.slug}`} className="hover:underline" lang={nameLang(lead.title, language)}>{lead.title}</Link></h2>
        <p className="mt-2 max-w-read text-ink-muted">{lead.teaser}</p>
        <ReadMeta story={lead} read={read.has(lead.slug)} />
      </article>
      {side.length > 0 && <ul className="space-y-6 lg:col-span-4">
        {side.map((story) => <li key={story.slug}><SideStory story={story} read={read.has(story.slug)} /></li>)}
      </ul>}
    </div>}
    {GROUPS.map((group) => {
      const items = rest.filter((story) => groupOf(story) === group.key);
      if (items.length === 0) return null;
      return <section key={group.key} aria-labelledby={`group-${group.key}`} className="mt-14">
        <StreetPlate id={`group-${group.key}`}>{tr(group.title)}</StreetPlate>
        <ul className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((story) => <li key={story.slug}><StoryCard story={story} accent={group.accent} read={read.has(story.slug)} /></li>)}
        </ul>
      </section>;
    })}
    {all.length > 0 && <Link href="/credits" className="type-small mt-8 inline-flex min-h-[44px] items-center text-ink-muted underline underline-offset-4">{tr("Photo credits")}</Link>}
  </div>;
}

function ReadMeta({ story, read }: { story: StorySummary; read: boolean }) {
  const { tr } = usePrefs();
  return <p className="type-small mt-1 flex items-center gap-3 text-ink-muted">
    <span>{story.readingMinutes} {tr("min read")}</span>
    {read && <span className="inline-flex items-center gap-1 text-moss"><Check size={20} aria-hidden />{tr("Read")}</span>}
  </p>;
}

/** Spotlight beside the lead story: a wide photo over the title. */
function SideStory({ story, read }: { story: StorySummary; read: boolean }) {
  const { language } = usePrefs();
  const image = photoOf(story)!;
  return <Link href={`/stories/${story.slug}`} className="photo-zoom group block">
    <span className="relative block aspect-[16/9] overflow-hidden rounded-card">
      <Image src={image.src} alt={image.alt} fill sizes="(min-width: 1024px) 30vw, 100vw" className="object-cover" />
    </span>
    <span className="mt-2 block font-semibold group-hover:underline" lang={nameLang(story.title, language)}>{story.title}</span>
    <ReadMeta story={story} read={read} />
  </Link>;
}

/** One story in its group: photo, title, the opening line and the reading time. Photos are credited on /credits. */
function StoryCard({ story, accent, read }: { story: StorySummary; accent: string; read: boolean }) {
  const { language } = usePrefs();
  const image = photoOf(story);
  return <Link href={`/stories/${story.slug}`}
    className={`photo-zoom group flex h-full flex-col overflow-hidden rounded-card border border-t-4 border-line bg-paper shadow-float ${accent}`}>
    {image ? <span className="relative block aspect-[4/3] overflow-hidden">
      <Image src={image.src} alt={image.alt} fill sizes="(min-width: 1024px) 380px, (min-width: 640px) 45vw, 100vw" className="object-cover" />
    </span> : <span className="grid aspect-[4/3] place-items-center bg-paper-sunken text-ink-muted" aria-hidden><Scroll size={48} /></span>}
    <span className="flex flex-1 flex-col p-4">
      <span className="type-h3 block group-hover:underline" lang={nameLang(story.title, language)}>{story.title}</span>
      {story.teaser && <span className="mt-2 line-clamp-2 text-ink-muted">{story.teaser}</span>}
      <span className="mt-auto pt-2"><ReadMeta story={story} read={read} /></span>
    </span>
  </Link>;
}

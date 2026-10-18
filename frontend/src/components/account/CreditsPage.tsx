"use client";

import Image from "next/image";

import { wikimediaImages } from "@/data/hanoi-images";
import { storyNames, storyPhotos } from "@/data/story-photos";
import { holidayCovers } from "@/data/holiday-photos";
import { usePrefs } from "@/lib/prefs";
import { usePageChrome } from "@/components/shell/chrome";
import { PhotoSource } from "@/components/ui/States";

/** Attribution for every photo and the map data (README: required before publishing). */
export function CreditsPage() {
  const { tr, language } = usePrefs();
  usePageChrome({});
  return <div className="mx-auto max-w-3xl px-4 pb-12 sm:px-6">
    <h1 className="type-h1 pt-4 lg:pt-8">{tr("Credits")}</h1>
    <section className="mt-6" aria-labelledby="story-photo-credits">
      <h2 id="story-photo-credits" className="type-h3">{tr("Story photos")}</h2>
      <p className="mt-2 text-ink-muted">{tr("Photos in the stories come from the sources named under each photo.")}</p>
      {Object.entries(storyPhotos).map(([slug, photos]) => <div key={slug} className="mt-6">
        <h3 className="font-semibold">{storyNames[slug]?.[language] ?? slug}</h3>
        <ul className="mt-2 divide-y divide-line border-y border-line">
          {photos.map((photo) => <li key={photo.key} className="flex gap-4 py-3">
            <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-control">
              <Image src={photo.src} alt="" fill sizes="64px" className="object-cover" />
            </span>
            <div className="min-w-0">
              <p>{photo.caption[language]}</p>
              <p className="type-small text-ink-muted"><PhotoSource photo={photo} /></p>
            </div>
          </li>)}
        </ul>
      </div>)}
    </section>
    <section className="mt-10" aria-labelledby="calendar-photo-credits">
      <h2 id="calendar-photo-credits" className="type-h3">{tr("Festival calendar photos")}</h2>
      <ul className="mt-4 divide-y divide-line border-y border-line">
        {Object.values(holidayCovers).map((photo) => <li key={photo.key} className="flex gap-4 py-3">
          <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-control">
            <Image src={photo.src} alt="" fill sizes="64px" className="object-cover" />
          </span>
          <div className="min-w-0">
            <p>{photo.caption[language]}</p>
            <p className="type-small text-ink-muted"><PhotoSource photo={photo} /></p>
          </div>
        </li>)}
      </ul>
    </section>
    <h2 className="type-h3 mt-10">{tr("Wikimedia Commons photos")}</h2>
    <p className="mt-2 text-ink-muted">{tr("Photos are openly licensed images from Wikimedia Commons, used under the licences below.")}</p>
    <ul className="mt-6 divide-y divide-line border-y border-line">
      {Object.values(wikimediaImages).map((image) => <li key={image.key} className="flex gap-4 py-4">
        <span className="relative h-20 w-20 shrink-0 overflow-hidden rounded-control">
          <Image src={image.src} alt="" fill sizes="80px" className="object-cover" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold">{image.title}</p>
          <p className="type-small text-ink-muted">{image.author}, {image.license}</p>
          <a href={image.sourceUrl} target="_blank" rel="noopener noreferrer" className="type-small inline-flex min-h-[44px] items-center text-sign-blue underline-offset-4 hover:underline">
            {tr("Original file")}</a>
        </div>
      </li>)}
    </ul>
    <section className="mt-8" aria-labelledby="map-credits">
      <h2 id="map-credits" className="type-h3">{tr("Map data")}</h2>
      <p className="mt-2">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="text-sign-blue underline">OpenStreetMap</a> contributors, ODbL.</p>
      <p className="type-small mt-1 text-ink-muted">{tr("Map tiles: OpenStreetMap France (humanitarian style).")}</p>
    </section>
  </div>;
}

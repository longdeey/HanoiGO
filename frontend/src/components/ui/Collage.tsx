"use client";

import Image from "next/image";

import { usePrefs } from "@/lib/prefs";
import { hanoiImages, imagePlaces } from "@/data/hanoi-images";

/**
 * One clipping, placed in design pixels of its canvas: a photo (image key) or
 * a headline. x, y, w, h are measured on the canvas drawn at its design size.
 */
export type Clip = {
  x: number; y: number; w: number; h: number; tilt: number; image?: string;
  headline?: { vi: string; en: string }; headlineSize?: number;
  /** The caption under a photo, when it is not the photo's place name. */
  label?: { vi: string; en: string };
};
export type Canvas = { w: number; h: number };

/**
 * Hanoi photos cut out like newspaper clippings and laid on a table: torn
 * edges, tape, a place name under each photo. The canvas keeps its aspect
 * ratio and every size (clippings, captions, tape) is a fraction of its width,
 * so zooming or resizing scales the whole composition and never rearranges or
 * overlaps it. Decorative only (hidden from assistive tech); the photos are
 * credited on /credits. They drop in once and lift under the pointer, both
 * off with reduced motion.
 */
const tape = (index: number) => index % 3 === 0;

export function Collage({ canvas, clips, className = "", sizes = "(min-width: 1024px) 30vw, 50vw" }: {
  canvas: Canvas; clips: Clip[]; className?: string; sizes?: string;
}) {
  const { language } = usePrefs();
  return <div className={`collage-canvas ${className}`} aria-hidden
    style={{ aspectRatio: `${canvas.w} / ${canvas.h}`, ["--u" as string]: `calc(100cqw / ${canvas.w})` }}>
    {clips.map((clip, index) => <div key={`${clip.image ?? "text"}-${index}`} className="clipping"
      style={{ left: `${(clip.x / canvas.w) * 100}%`, top: `${(clip.y / canvas.h) * 100}%`,
        width: `${(clip.w / canvas.w) * 100}%`, height: `${(clip.h / canvas.h) * 100}%`,
        ["--tilt" as string]: `${clip.tilt}deg`, ["--delay" as string]: `${index * 70}ms` }}>
      <div className="clipping-paper">
        {clip.image ? <>
          <div className="clipping-photo">
            <Image src={hanoiImages[clip.image].src} alt="" fill sizes={sizes} className="object-cover" />
          </div>
          <span className="clipping-caption">{clip.label?.[language] ?? imagePlaces[clip.image]?.[language]}</span>
        </> : clip.headline && <div className="clipping-text">
          <p className="clipping-headline" style={{ fontSize: `calc(var(--u) * ${clip.headlineSize ?? 22})` }}>{clip.headline[language]}</p>
          <div className="rule" />
          <div className="columns" />
        </div>}
      </div>
      {tape(index) && <span className="tape" style={{ ["--tape-tilt" as string]: `${clip.tilt > 0 ? -4 : 4}deg` }} />}
    </div>)}
  </div>;
}

"use client";

import { Info, Warning } from "@phosphor-icons/react";

import { usePrefs } from "@/lib/prefs";
import { hanoiImages } from "@/data/hanoi-images";
import { Button } from "./Button";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

/** Skeleton block shaped like a list of text rows, with a status for screen readers. */
export function LoadingRows({ rows = 3, label }: { rows?: number; label?: string }) {
  const { tr } = usePrefs();
  return <div role="status" className="space-y-3">
    <span className="sr-only">{label ?? tr("Loading...")}</span>
    {Array.from({ length: rows }, (_, index) => <Skeleton key={index} className={`h-16 ${index % 2 ? "w-11/12" : "w-full"}`} />)}
  </div>;
}

/** Loading shapes that match the page that is coming (M27), per page. */
export function PlaceSkeleton() {
  return <div className="mx-auto max-w-3xl px-4 pt-6 sm:px-6 lg:pt-12" aria-busy="true">
    <Skeleton className="h-9 w-2/3" />
    <Skeleton className="mt-3 h-5 w-1/3" />
    <Skeleton className="mt-3 h-5 w-40" />
    <div className="mt-6 flex gap-3"><Skeleton className="h-11 w-32" /><Skeleton className="h-11 w-36" /></div>
    <Skeleton className="mt-8 h-32" />
  </div>;
}

export function FestivalListSkeleton() {
  return <div aria-busy="true">
    <Skeleton className="h-7 w-32" />
    <div className="mt-4 space-y-4">{[0, 1, 2].map((index) => <Skeleton key={index} className="h-44 rounded-card" />)}</div>
  </div>;
}

export function TripListSkeleton() {
  return <div className="mx-auto max-w-3xl px-4 pt-6 sm:px-6 lg:pt-12" aria-busy="true">
    <Skeleton className="h-12 w-48" />
    <Skeleton className="mt-4 h-5 w-full max-w-md" />
    <Skeleton className="mt-8 h-6 w-24" />
    <div className="mt-3 space-y-3">{[0, 1, 2].map((index) => <Skeleton key={index} className="h-16" />)}</div>
  </div>;
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return <div className="mx-auto max-w-md py-12 text-center">
    <p className="type-h3">{title}</p>
    {body && <p className="mt-2 text-ink-muted">{body}</p>}
    {action && <div className="mt-6 flex justify-center">{action}</div>}
  </div>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { tr } = usePrefs();
  return <div role="alert" className="flex items-start gap-3 rounded-card bg-sign-red-soft p-4 text-sign-red-text">
    <Warning size={20} className="mt-1 shrink-0" aria-hidden />
    <div className="flex-1">
      <p className="font-medium">{message}</p>
      {onRetry && <Button variant="text" className="-ml-2 mt-1" onClick={onRetry}>{tr("Try again")}</Button>}
    </div>
  </div>;
}

/** Warning placed right next to what it is about (spec §4.8 rule 4). */
export function Notice({ children, tone = "warn" }: { children: React.ReactNode; tone?: "warn" | "info" }) {
  return <div role="note" className={`flex items-start gap-2 rounded-control p-3 type-small ${tone === "warn" ? "bg-wall-yellow-soft text-warn-ink" : "bg-sign-blue-soft text-sign-blue"}`}>
    {tone === "warn" ? <Warning size={20} className="mt-1 shrink-0" aria-hidden /> : <Info size={20} className="mt-1 shrink-0" aria-hidden />}
    <div>{children}</div>
  </div>;
}

/** Author, licence and link right under a large photo (spec §6.6). */
export function PhotoCredit({ imageKey, className = "" }: { imageKey: string; className?: string }) {
  const { tr } = usePrefs();
  const image = hanoiImages[imageKey];
  if (!image) return null;
  // Story photos name their source only; Wikimedia photos link the original file and give the licence.
  return <p className={`type-caption text-ink-muted ${className}`}>
    {tr("Photo")}: {image.sourceUrl
      ? <a href={image.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-ink">{image.author}</a>
      : tr(image.author)}{image.license && `, ${image.license}`}
  </p>;
}

/** "Photo: source, licence" under a story photo; openly licensed photos link their original file. */
export function PhotoSource({ photo }: { photo: { credit: string; license?: string; sourceUrl?: string } }) {
  const { tr } = usePrefs();
  return <>{tr("Photo")}: {photo.sourceUrl
    ? <a href={photo.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-ink">{photo.credit}</a>
    : tr(photo.credit)}{photo.license && `, ${photo.license}`}</>;
}

/** Map an API error to a sentence that says what happened and what to do. */
export function apiErrorMessage(error: unknown, tr: (text: string) => string): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code: string }).code;
    if (code === "NETWORK") return tr("Cannot reach the server. Check your connection and try again.");
    if (code === "DATABASE_UNAVAILABLE" || code === "SERVICE_UNAVAILABLE") return tr("HanoiGO is temporarily unavailable. Try again in a few minutes.");
    if (code === "REQUEST_FAILED") return tr("HanoiGO could not complete this request. Try again.");
    if (code === "TRIP_ACCESS_DENIED") return tr("This link no longer opens. The person who shared it may have created a new one.");
  }
  if (error instanceof TypeError) return tr("Cannot reach the server. Check your connection and try again.");
  // Unknown API errors: the API's English sentence only in the English UI.
  if (error instanceof Error && error.message && tr("Try again") === "Try again") return error.message;
  return tr("HanoiGO could not complete this request. Try again.");
}

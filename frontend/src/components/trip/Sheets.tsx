"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { Copy, NavigationArrow, Scroll, Star, Swap } from "@phosphor-icons/react";

import type { ItineraryItem, TripResponse } from "@/types/trip";
import type { OptimizeStrategy, ReplaceReason } from "@/services/api";
import { usePrefs } from "@/lib/prefs";
import { formatDuration, formatMoney, sentence } from "@/lib/format";
import { nameLang } from "@/lib/lang";
import { googleMapsDirectionsUrl } from "@/services/maps";
import { Sheet } from "@/components/ui/Sheet";
import { Button, buttonClass } from "@/components/ui/Button";
import { RadioRow } from "@/components/ui/Controls";
import { PlaceTags } from "./Timeline";
import { ErrorState, apiErrorMessage } from "@/components/ui/States";

export const REPLACE_REASONS: { value: ReplaceReason; label: string }[] = [
  { value: "TOO_FAR", label: "Too far" }, { value: "TOO_EXPENSIVE", label: "Too expensive" },
  { value: "NOT_INTERESTED", label: "Not interested" }, { value: "ALREADY_VISITED", label: "Already visited" },
  { value: "PREFER_INDOOR", label: "Prefer indoor" }, { value: "PREFER_LOCAL", label: "Prefer local" },
];

export const STRATEGIES: { value: OptimizeStrategy; label: string; description: string }[] = [
  { value: "REDUCE_COST", label: "Reduce cost", description: "Swap in cheaper places of the same kind." },
  { value: "REDUCE_DISTANCE", label: "Reduce travel", description: "Keep places closer together." },
  { value: "PREFER_INDOOR", label: "Prefer indoor", description: "Favour indoor places, useful on rainy days." },
  { value: "MORE_LOCAL", label: "More local", description: "Favour places locals love." },
  { value: "MORE_FOOD", label: "More food", description: "Make room for more food stops." },
  { value: "MORE_CHECKIN", label: "More check-in", description: "Favour photogenic spots." },
  { value: "REGENERATE_DAY", label: "Regenerate day", description: "Plan the day you are viewing again with other places." },
];

export function StopSheet({ item, open, onClose, mode, readOnly, onReplace, placeHref }: {
  item: ItineraryItem | null; open: boolean; onClose: () => void; mode: TripResponse["travelMode"];
  readOnly: boolean; onReplace: () => void; placeHref: string;
}) {
  const { language } = usePrefs();
  return <Sheet open={open && Boolean(item)} onClose={onClose}
    title={item ? <>{item.sequence}. <span lang={nameLang(item.place.name, language)}>{item.place.name}</span></> : ""}>
    {item && <StopDetails item={item} mode={mode} readOnly={readOnly} onReplace={onReplace} placeHref={placeHref} />}
  </Sheet>;
}

/**
 * A stop's details (spec §8.7): in a sheet on the phone, inside the expanded
 * card on the desktop (M16).
 */
export function StopDetails({ item, mode, readOnly, onReplace, placeHref, showTags = true }: {
  item: ItineraryItem; mode: TripResponse["travelMode"]; readOnly: boolean; onReplace: () => void; placeHref: string; showTags?: boolean;
}) {
  const { tr, language } = usePrefs();
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2 text-ink-muted">
      <span>{sentence(tr(item.place.category).replaceAll("_", " "))}</span>
      {showTags && <PlaceTags place={item.place} />}
    </div>
    <p className="tnum font-semibold">{item.startTime} {tr("to")} {item.endTime} <span className="type-small font-normal text-ink-muted">({formatDuration(item.visitMinutes, language)})</span></p>
    <dl className="divide-y divide-line">
      <div className="flex justify-between py-2"><dt>{tr("Cost for the group")}</dt><dd className="tnum font-semibold">{item.estimatedCost > 0 ? formatMoney(item.estimatedCost, language) : tr("Free")}</dd></div>
      {item.place.entranceFee > 0 && <div className="flex justify-between py-2"><dt>{tr("Ticket per person")}</dt><dd className="tnum font-semibold">{formatMoney(item.place.entranceFee, language)}</dd></div>}
      {item.travelCost > 0 && <div className="flex justify-between py-2"><dt>{tr("Ride fare to here")}</dt><dd className="tnum font-semibold">{formatMoney(item.travelCost, language)}</dd></div>}
    </dl>
    {(item.place.ratingCount ?? 0) > 0 && <p className="flex items-center gap-2"><Star size={20} weight="fill" className="text-warn-ink" aria-hidden />
      <span className="tnum font-semibold">{(item.place.ratingAverage ?? 0).toFixed(1)}</span>
      <span className="text-ink-muted">{item.place.ratingCount} {tr("reviews")}</span></p>}
    {item.reasons.length > 0 && <section>
      <h3 className="font-semibold">{tr("Why it is in your itinerary")}</h3>
      <ul className="mt-1 list-disc space-y-1 pl-6 text-ink-muted">{item.reasons.map((reason) => <li key={reason}>{tr(reason)}</li>)}</ul>
    </section>}
    {item.place.story && <section className="rounded-card bg-paper-sunken p-4">
      <p className="type-small inline-flex items-center gap-2 font-semibold text-ink-muted"><Scroll size={20} aria-hidden />{tr("Story")}</p>
      <p className="mt-1 font-semibold" lang={nameLang(item.place.story.title, language)}>{item.place.story.title}</p>
      <p className="type-small mt-1 text-ink-muted">{item.place.story.teaser}</p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="type-small text-ink-muted">{item.place.story.readingMinutes} {tr("min read")}</span>
        <Link href={`/stories/${item.place.story.slug}`} className={buttonClass("secondary")}>{tr("Read the story")}</Link>
      </div>
    </section>}
    <div className="flex flex-wrap gap-3">
      <a href={googleMapsDirectionsUrl(item.place, mode)} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary")}>
        <NavigationArrow size={20} aria-hidden />{tr("Directions")}</a>
      {!readOnly && <Button variant="secondary" onClick={onReplace}><Swap size={20} aria-hidden />{tr("Replace place")}</Button>}
    </div>
    <Link href={placeHref} className="inline-flex min-h-[44px] items-center font-semibold text-sign-blue underline-offset-4 hover:underline">
      {tr("See the place page and reviews")}</Link>
  </div>;
}

export function ReplaceSheet({ item, open, onClose, onConfirm, pending, error }: {
  item: ItineraryItem | null; open: boolean; onClose: () => void; onConfirm: (reason: ReplaceReason) => void;
  pending: boolean; error: unknown;
}) {
  const { tr, language } = usePrefs();
  const name = useId();
  const [reason, setReason] = useState<ReplaceReason>("TOO_FAR");
  return <Sheet open={open} onClose={onClose}
    title={item ? <>{tr("Replace")} <span lang={nameLang(item.place.name, language)}>{item.place.name}</span></> : tr("Replace place")}
    footer={<Button variant="primary" className="w-full" loading={pending} loadingLabel={tr("Replacing...")} onClick={() => onConfirm(reason)}>{tr("Replace place")}</Button>}>
    <fieldset>
      <legend className="mb-2 text-ink-muted">{tr("Why replace it?")}</legend>
      <div className="space-y-1">{REPLACE_REASONS.map((option) => <RadioRow key={option.value} name={name} value={option.value}
        checked={reason === option.value} onChange={(value) => setReason(value as ReplaceReason)} label={tr(option.label)} />)}</div>
    </fieldset>
    {error ? <div className="mt-4"><ErrorState message={apiErrorMessage(error, tr)} /></div> : null}
  </Sheet>;
}

export function OptimizeSheet({ open, onClose, onConfirm, pending, error, dayNumber }: {
  open: boolean; onClose: () => void; onConfirm: (strategy: OptimizeStrategy) => void; pending: boolean; error: unknown; dayNumber: number;
}) {
  const { tr } = usePrefs();
  const name = useId();
  const [strategy, setStrategy] = useState<OptimizeStrategy>("REDUCE_COST");
  return <Sheet open={open} onClose={onClose} title={tr("Re-optimize")}
    footer={<Button variant="primary" className="w-full" loading={pending} loadingLabel={tr("Re-optimizing...")} onClick={() => onConfirm(strategy)}>{tr("Re-optimize")}</Button>}>
    <fieldset>
      <legend className="sr-only">{tr("How to re-optimize")}</legend>
      <div className="space-y-1">{STRATEGIES.map((option) => <RadioRow key={option.value} name={name} value={option.value}
        checked={strategy === option.value} onChange={(value) => setStrategy(value as OptimizeStrategy)} label={tr(option.label)}
        description={option.value === "REGENERATE_DAY" ? `${tr(option.description)} (${tr("Day")} ${dayNumber})` : tr(option.description)} />)}</div>
    </fieldset>
    {error ? <div className="mt-4"><ErrorState message={apiErrorMessage(error, tr)} /></div> : null}
  </Sheet>;
}

/**
 * Sharing (spec §8.7). Each POST /share creates a new read-only link and
 * disables the old one, and the API cannot return the current link, so the
 * last link is kept on this device [client].
 */
export function ShareSheet({ open, onClose, savedUrl, onCreate, pending, error }: {
  open: boolean; onClose: () => void; savedUrl: string | null; onCreate: () => void; pending: boolean; error: unknown;
}) {
  const { tr } = usePrefs();
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const reduce = useReducedMotion();
  const opener = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(false);
  // The confirmation replaces the button that opened it: move focus into it,
  // and back to that button when it closes, so keyboard focus is never lost.
  useEffect(() => {
    if (confirming) cancel.current?.focus();
    else if (wasConfirming.current) opener.current?.focus();
    wasConfirming.current = confirming;
  }, [confirming]);
  // The confirmation stays open (its button loading) until the new link arrives.
  useEffect(() => { setConfirming(false); }, [savedUrl]);
  async function copy() {
    if (!savedUrl) return;
    try { await navigator.clipboard.writeText(savedUrl); setCopied(true); window.setTimeout(() => setCopied(false), 2000); } catch { setCopied(false); }
  }
  return <Sheet open={open} onClose={() => { setConfirming(false); onClose(); }} title={tr("Share itinerary")}>
    {savedUrl ? <div className="space-y-4">
      <div className="flex gap-2">
        <input readOnly value={savedUrl} aria-label={tr("Share link")} onFocus={(event) => event.currentTarget.select()} className="field type-small flex-1" />
        <Button variant="secondary" onClick={() => void copy()} aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            {copied ? <m.span key="done" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="inline-flex items-center gap-1"><DrawnCheck />{tr("Link copied")}</m.span>
              : <m.span key="copy" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="inline-flex items-center gap-1"><Copy size={20} aria-hidden />{tr("Copy")}</m.span>}
          </AnimatePresence>
        </Button>
      </div>
      <p className="text-ink-muted">{tr("People with the link can view but not edit.")}</p>
      {confirming ? <div role="alertdialog" aria-label={tr("Create new link")} aria-describedby="share-confirm-text" className="rounded-card border border-line p-4">
        <p id="share-confirm-text" className="font-medium">{tr("The old link will stop working.")}</p>
        <div className="mt-3 flex gap-3">
          <Button variant="danger" loading={pending} onClick={onCreate}>{tr("Create new link")}</Button>
          <Button ref={cancel} variant="secondary" onClick={() => setConfirming(false)}>{tr("Cancel")}</Button>
        </div>
      </div> : <Button ref={opener} variant="text" className="-ml-2" onClick={() => setConfirming(true)}>{tr("Create new link")}</Button>}
    </div> : <div className="space-y-4">
      <p>{tr("People with the link can view but not edit.")}</p>
      <p className="text-ink-muted">{tr("If you shared this trip before, the old link will stop working.")}</p>
      <Button variant="primary" className="w-full" loading={pending} onClick={onCreate}>{tr("Create a share link")}</Button>
    </div>}
    {error ? <div className="mt-4"><ErrorState message={apiErrorMessage(error, tr)} /></div> : null}
  </Sheet>;
}

/** M26: the tick draws itself (pathLength 0 to 1) when the link is copied. */
function DrawnCheck() {
  const reduce = useReducedMotion();
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
    <m.path d="M4.5 12.5l5 5L19.5 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }} />
  </svg>;
}

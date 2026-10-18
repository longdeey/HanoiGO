"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NavigationArrow, Path, Scroll, Star, Ticket } from "@phosphor-icons/react";

import type { Place, PlaceComment } from "@/types/trip";
import { ApiRequestError, fetchPlace, submitPlaceReview } from "@/services/api";
import { usePrefs } from "@/lib/prefs";
import { nameLang } from "@/lib/lang";
import { formatMoney, sentence } from "@/lib/format";
import { googleMapsDirectionsUrl } from "@/services/maps";
import { usePageChrome } from "@/components/shell/chrome";
import { PlaceTags } from "@/components/trip/Timeline";
import { Button, buttonClass } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { EmptyState, ErrorState, PlaceSkeleton, apiErrorMessage } from "@/components/ui/States";
import { RunningNumber } from "@/components/ui/RunningNumber";
import { useToast } from "@/components/ui/Toast";
import { AuthForm } from "@/components/account/AuthForm";

export function PlacePage({ placeId }: { placeId: string }) {
  const { tr, language } = usePrefs();
  const place = useQuery({ queryKey: ["place", placeId, language], queryFn: () => fetchPlace(placeId, language), retry: false });
  usePageChrome({ title: place.data?.name ?? tr("Place"), backHref: "/" });
  if (place.isPending) return <PlaceSkeleton />;
  if (place.isError) return place.error instanceof ApiRequestError && place.error.code === "NOT_FOUND"
    ? <EmptyState title={tr("This place does not exist.")} />
    : <div className="mx-auto max-w-xl px-4 pt-12"><ErrorState message={apiErrorMessage(place.error, tr)} onRetry={() => void place.refetch()} /></div>;
  return <PlaceBody place={place.data} />;
}

const MODES = ["walking", "motorbike", "car"] as const;

function PlaceBody({ place }: { place: Place }) {
  const { tr, language } = usePrefs();
  const params = useSearchParams();
  const requested = params.get("mode");
  const mode = MODES.find((value) => value === requested) ?? "walking";
  const plan = new URLSearchParams({ step: "2", startName: place.name, startLat: String(place.latitude), startLng: String(place.longitude) });
  const sources = [
    place.hoursSource ? { label: tr("Opening hours source"), url: place.hoursSource } : null,
    place.priceSource ? { label: tr("Price source"), url: place.priceSource } : null,
    place.bookingSource ? { label: tr("Booking/ticket information"), url: place.bookingSource } : null,
    place.informationSource ? { label: tr("More information"), url: place.informationSource } : null,
  ].filter((item): item is { label: string; url: string } => Boolean(item));
  return <div className="mx-auto max-w-3xl px-4 pb-12 sm:px-6">
    <header className="pt-4 lg:pt-8">
      <h1 className="type-h1" lang={nameLang(place.name, language)}>{place.name}</h1>
      <p className="mt-2 flex flex-wrap items-center gap-2 text-ink-muted">
        <span>{sentence(tr(place.category).replaceAll("_", " "))}</span>
        <PlaceTags place={place} />
      </p>
      <Rating place={place} />
    </header>
    <div className="mt-6 flex flex-wrap gap-3">
      <a href={googleMapsDirectionsUrl(place, mode)} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary")}>
        <NavigationArrow size={20} aria-hidden />{tr("Directions")}</a>
      <Link href={`/plan?${plan}`} className={buttonClass("secondary")}><Path size={20} aria-hidden />{tr("Plan from here")}</Link>
    </div>
    <section className="mt-8" aria-labelledby="visit-title">
      <h2 id="visit-title" className="type-h3">{tr(place.hoursSource ? "Tickets and hours" : "Tickets")}</h2>
      <dl className="mt-2 divide-y divide-line">
        <div className="flex justify-between py-2"><dt className="flex items-center gap-2"><Ticket size={20} aria-hidden />{tr("Ticket per person")}</dt>
          <dd className="tnum font-semibold">{place.entranceFee > 0 ? formatMoney(place.entranceFee, language) : tr("Free")}</dd></div>
        {place.averageCost > 0 && <div className="flex justify-between py-2"><dt>{tr("Typical spend per person")}</dt><dd className="tnum font-semibold">{formatMoney(place.averageCost, language)}</dd></div>}
      </dl>
      {sources.length > 0 && <ul className="mt-2 flex flex-wrap gap-x-4">{sources.map((source) => <li key={source.url}>
        <a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center text-sign-blue underline-offset-4 hover:underline">{source.label}</a>
      </li>)}</ul>}
      <p className="type-small mt-2 text-ink-muted">{tr("Prices and hours may be estimates; check before you go.")}</p>
    </section>
    {place.story && <section className="mt-8 rounded-card bg-paper-sunken p-4" aria-labelledby="story-card">
      <p className="type-small inline-flex items-center gap-2 font-semibold text-ink-muted"><Scroll size={20} aria-hidden />{tr("Story")}</p>
      <h2 id="story-card" className="type-h3 mt-1">{place.story.title}</h2>
      <p className="mt-1 text-ink-muted">{place.story.teaser}</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="type-small text-ink-muted">{place.story.readingMinutes} {tr("min read")}</span>
        <Link href={`/stories/${place.story.slug}`} className={buttonClass("secondary")}>{tr("Read the story")}</Link>
      </div>
    </section>}
    <Reviews place={place} />
  </div>;
}

function Rating({ place }: { place: Place }) {
  const { tr } = usePrefs();
  const count = place.ratingCount ?? 0;
  if (count === 0) return <p className="type-small mt-2 text-ink-muted">{tr("No reviews yet")}</p>;
  return <p className="mt-2 flex items-center gap-2">
    <Star size={20} weight="fill" className="text-warn-ink" aria-hidden />
    <RunningNumber value={place.ratingAverage ?? 0} format={(value) => value.toFixed(1)} className="font-semibold" announce />
    <span className="text-ink-muted">{count} {tr("reviews")}</span>
  </p>;
}

const VISIBLE_REVIEWS = 3;

function Reviews({ place }: { place: Place }) {
  const { tr, auth, language } = usePrefs();
  const client = useQueryClient();
  const toast = useToast();
  const name = useId();
  const [writing, setWriting] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [added, setAdded] = useState<PlaceComment[]>([]);
  const [showAll, setShowAll] = useState(false);
  const mutation = useMutation({
    mutationFn: () => submitPlaceReview(place.id, auth?.token ?? "", rating, comment.trim()),
    onSuccess: (updated) => {
      setAdded((current) => [{ id: `local-${Date.now()}`, authorName: auth?.user.displayName ?? "", rating, comment: comment.trim(), createdAt: new Date().toISOString() }, ...current]);
      client.setQueryData(["place", place.id, language], updated);
      setComment(""); setWriting(false);
      toast.show(tr("Review posted"), { tone: "success" });
    },
  });
  const comments = [...added, ...(place.comments ?? []).filter((item) => !added.some((own) => own.comment === item.comment && own.authorName === item.authorName))];
  return <section className="mt-12" aria-labelledby="reviews-title">
    <div className="flex items-center justify-between gap-3">
      <h2 id="reviews-title" className="type-h3">{tr("Reviews")}</h2>
      {!writing && <Button variant="secondary" onClick={() => (auth ? setWriting(true) : setSigningIn(true))}>{tr("Write a review")}</Button>}
    </div>
    {writing && auth && <form className="mt-4 space-y-4 rounded-card border border-line p-4" noValidate
      onSubmit={(event) => { event.preventDefault(); if (comment.trim().length >= 2) mutation.mutate(); }}>
      <p className="type-small text-ink-muted">{tr("Posting as")} {auth.user.displayName}</p>
      <fieldset>
        <legend className="mb-1 font-semibold">{tr("Rating")}</legend>
        <div className="flex gap-1">{[1, 2, 3, 4, 5].map((value) => <label key={value} className="press grid h-11 w-11 cursor-pointer place-items-center rounded-control has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)]">
          <input type="radio" name={name} value={value} checked={rating === value} onChange={() => setRating(value)} className="sr-only" />
          <Star size={28} weight={value <= rating ? "fill" : "regular"} className={value <= rating ? "text-warn-ink" : "text-ink-muted"} aria-hidden />
          <span className="sr-only">{value} {tr(value === 1 ? "star" : "stars")}</span>
        </label>)}</div>
      </fieldset>
      <div>
        <label htmlFor={`${name}-comment`} className="mb-2 block font-semibold">{tr("Comment")}</label>
        <textarea id={`${name}-comment`} value={comment} onChange={(event) => setComment(event.target.value)} rows={3} className="field" maxLength={1000}
          aria-describedby={mutation.isError ? `${name}-comment-error` : `${name}-comment-hint`} aria-invalid={mutation.isError || undefined} />
        <p id={`${name}-comment-hint`} className="type-small mt-2 text-ink-muted">{tr("Write at least 2 characters.")}</p>
      </div>
      {mutation.isError && <p id={`${name}-comment-error`} role="alert" className="type-small text-sign-red-text">{apiErrorMessage(mutation.error, tr)}</p>}
      <div className="flex gap-3">
        <Button type="submit" variant="primary" loading={mutation.isPending} disabled={comment.trim().length < 2}>{tr("Post review")}</Button>
        <Button variant="secondary" onClick={() => setWriting(false)}>{tr("Cancel")}</Button>
      </div>
    </form>}
    {comments.length === 0 ? <p className="mt-3 text-ink-muted">{tr("No reviews yet")}</p> :
      <ul id={`${name}-reviews`} className="mt-4 divide-y divide-line">{(showAll ? comments : comments.slice(0, VISIBLE_REVIEWS)).map((review) => <li key={review.id} className="py-4">
        <p className="flex items-center gap-2"><span className="font-semibold">{review.authorName}</span>
          <span role="img" className="inline-flex" aria-label={`${review.rating} ${tr("stars")}`}>{Array.from({ length: 5 }, (_, index) =>
            <Star key={index} size={20} weight={index < review.rating ? "fill" : "regular"} className="text-warn-ink" aria-hidden />)}</span></p>
        <p className="mt-1">{review.comment}</p>
      </li>)}</ul>}
    {comments.length > VISIBLE_REVIEWS && <Button variant="text" className="-ml-2" aria-expanded={showAll} aria-controls={`${name}-reviews`}
      onClick={() => setShowAll(!showAll)}>{showAll ? tr("Show fewer reviews") : `${tr("Show all")} ${comments.length} ${tr("reviews")}`}</Button>}
    {/* Not signed in: sign in right here, then return to the review form. */}
    <Sheet open={signingIn} onClose={() => setSigningIn(false)} title={tr("Sign in to write a review")}>
      <AuthForm onDone={() => { setSigningIn(false); setWriting(true); }} />
    </Sheet>
  </section>;
}

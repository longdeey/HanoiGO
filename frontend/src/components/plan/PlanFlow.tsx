"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { AnimatePresence, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { X } from "@phosphor-icons/react";

import { tripSchema, type TripFormValues } from "@/schemas/trip";
import { ApiRequestError, generateTrip } from "@/services/api";
import { usePrefs } from "@/lib/prefs";
import { planDraft, savePlanDraft, saveTrip } from "@/lib/storage";
import { tripQueryKey } from "@/lib/useTrip";
import { todayInHanoi } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Collage, type Canvas, type Clip } from "@/components/ui/Collage";
import { ErrorState, apiErrorMessage } from "@/components/ui/States";
import { StepInterests, StepStart, StepTrip, StepTravel } from "./PlanSteps";
import { WaitingScreen } from "./WaitingScreen";

const PinPicker = dynamic(() => import("./PinPicker"), { ssr: false });

const STEP_FIELDS: (keyof TripFormValues)[][] = [
  ["days", "travelerCount", "budgetTotal", "startDate"],
  ["startLocationName"],
  ["travelMode", "travelRadiusMode", "dailyStartTime", "dailyEndTime", "pace"],
  ["interests"],
];
const STEP_LABELS = ["Trip", "Starting point", "Getting around", "Interests"];
// Steppers, the money field and the interest chips are set with setValue
// rather than registered, so react-hook-form cannot focus them on an error.
const FOCUS_TARGETS: Partial<Record<keyof TripFormValues, string>> = {
  days: "#days", travelerCount: "#travelerCount", budgetTotal: "#budgetTotal", interests: "#interests-group button",
  dailyStartTime: "#dailyStartTime", dailyEndTime: "#dailyEndTime",
};
const RATE_LIMIT_FALLBACK_SECONDS = 60;

// How many step entries the form has pushed onto the browser history (0 on the first step).
const PLAN_DEPTH = "hanoigoPlanDepth";
function planDepth(): number {
  const depth = (window.history.state as Record<string, unknown> | null)?.[PLAN_DEPTH];
  return typeof depth === "number" ? depth : 0;
}
/** False when the browser opened the form directly (a link, a bookmark): there is no page of ours to return to. */
function openedFromAnotherPage(): boolean {
  const entry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  const first = entry ? new URL(entry.name).pathname : "/plan";
  return window.history.length > 1 && !first.startsWith("/plan");
}

// Each step has its own Hanoi clippings: a tall panel beside the form on wide
// screens, a short strip above it on phones. Decorative (photos on /credits).
const STEP_ART: { images: [string, string, string, string]; headline: { vi: string; en: string } }[] = [
  { images: ["hero", "art", "old-quarter", "coffee"], headline: { vi: "Hà Nội, mùa nào cũng đẹp", en: "Hanoi in every season" } },
  { images: ["imperial_citadel", "hidden_gem", "accommodation", "flag_tower"], headline: { vi: "Bắt đầu từ phố cổ", en: "Start in the Old Quarter" } },
  { images: ["local_experience", "park", "nature", "one_pillar_pagoda"], headline: { vi: "Qua cầu Long Biên", en: "Across Long Bien Bridge" } },
  { images: ["food", "craft", "festival", "museum"], headline: { vi: "Phở sáng, cà phê chiều", en: "Pho at dawn, coffee at dusk" } },
];
const PANEL_CANVAS: Canvas = { w: 480, h: 620 };
const STRIP_CANVAS: Canvas = { w: 400, h: 160 };
function panelClips(step: number): Clip[] {
  const { images: [a, b, c, d], headline } = STEP_ART[step - 1];
  return [
    { image: a, x: 20, y: 24, w: 270, h: 230, tilt: -3 },
    { image: b, x: 312, y: 40, w: 148, h: 190, tilt: 4 },
    { image: c, x: 28, y: 282, w: 202, h: 198, tilt: 3 },
    { image: d, x: 254, y: 258, w: 206, h: 230, tilt: -2 },
    { headline, headlineSize: 24, x: 50, y: 512, w: 380, h: 92, tilt: -1 },
  ];
}
function stripClips(step: number): Clip[] {
  const [a, b, c] = STEP_ART[step - 1].images;
  return [
    { image: a, x: 8, y: 16, w: 122, h: 132, tilt: -3 },
    { image: b, x: 144, y: 22, w: 116, h: 122, tilt: 3 },
    { image: c, x: 274, y: 14, w: 118, h: 132, tilt: -2 },
  ];
}

function defaults(language: TripFormValues["language"]): TripFormValues {
  return {
    language, startDate: todayInHanoi(), days: 3, travelerCount: 2, budgetTotal: 3_000_000,
    startLocationName: "", startLocationCoordinates: undefined,
    interests: ["food", "history", "coffee", "local_culture"],
    travelMode: "walking", travelRadiusMode: "balanced", pace: "balanced",
    experiencePreferences: ["local"], dailyStartTime: "08:00", dailyEndTime: "21:00",
  };
}

/** Values passed in the URL from home, festivals or a story ("plan from here"). */
function urlPrefill(params: URLSearchParams): Partial<TripFormValues> {
  const prefill: Partial<TripFormValues> = {};
  const number = (key: string) => { const value = Number(params.get(key)); return Number.isFinite(value) && value > 0 ? value : undefined; };
  const days = number("days"); if (days) prefill.days = Math.min(14, Math.round(days));
  const people = number("people"); if (people) prefill.travelerCount = Math.min(20, Math.round(people));
  const budget = number("budget"); if (budget) prefill.budgetTotal = Math.round(budget);
  const startDate = params.get("startDate"); if (startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) prefill.startDate = startDate;
  const lat = Number(params.get("startLat")); const lng = Number(params.get("startLng"));
  const name = params.get("startName");
  if (name && Number.isFinite(lat) && Number.isFinite(lng) && params.has("startLat")) {
    prefill.startLocationName = name;
    prefill.startLocationCoordinates = { latitude: lat, longitude: lng };
  }
  return prefill;
}

type Outcome = { kind: "infeasible"; message: string; details: string[] } | { kind: "error"; message: string } | null;

export function PlanFlow() {
  const { tr, language } = usePrefs();
  const router = useRouter();
  const params = useSearchParams();
  const client = useQueryClient();
  const reduce = useReducedMotion();
  const step = Math.min(4, Math.max(1, Number(params.get("step")) || 1));
  // Server and client start from the same values (defaults + URL); the tab's
  // draft is applied after mount so hydration never mismatches.
  const prefill = useMemo(() => urlPrefill(new URLSearchParams(params.toString())),
    // Read once: later URL changes only move between steps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []);
  const form = useForm<TripFormValues>({ resolver: zodResolver(tripSchema), defaultValues: { ...defaults(language), ...prefill, language }, mode: "onTouched" });
  useEffect(() => {
    const draft = planDraft();
    if (draft) form.reset({ ...form.getValues(), ...draft, ...prefill, language: form.getValues("language") });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [direction, setDirection] = useState(1);
  const [mapOpen, setMapOpen] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const abort = useRef<AbortController | null>(null);
  const heading = useRef<HTMLDivElement>(null);

  // Keep the draft in this tab only, so Back and "edit" never lose input.
  useEffect(() => {
    const subscription = form.watch((values) => savePlanDraft(values as Partial<TripFormValues>));
    return () => subscription.unsubscribe();
  }, [form]);
  useEffect(() => { form.setValue("language", language); }, [form, language]);
  useEffect(() => {
    if (!lockedUntil) return;
    const timer = window.setInterval(() => {
      if (Date.now() >= lockedUntil) { setLockedUntil(null); }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [lockedUntil]);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); window.scrollTo({ top: 0 }); }, [step]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.scrollPaddingTop = "96px";
    root.style.scrollPaddingBottom = "104px";
    return () => { root.style.scrollPaddingTop = ""; root.style.scrollPaddingBottom = ""; };
  }, []);
  const mutation = useMutation({
    mutationFn: (values: TripFormValues) => {
      abort.current = new AbortController();
      return generateTrip(values, abort.current.signal);
    },
    onSuccess: (trip, values) => {
      saveTrip(trip, {
        startDate: values.startDate || null, days: values.days, travelerCount: values.travelerCount,
        budgetTotal: values.budgetTotal, startName: values.startLocationName,
      });
      client.setQueryData(tripQueryKey(trip.tripId), trip);
      savePlanDraft(null);
      router.push(`/trips/${encodeURIComponent(trip.tripId)}`);
    },
    onError: (error) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (error instanceof ApiRequestError) {
        if (error.code === "LOCATION_NOT_FOUND" || error.code === "LOCATION_SERVICE_UNAVAILABLE") {
          setLocationError(tr(error.code === "LOCATION_NOT_FOUND"
            ? "This address was not found in Hanoi. Add the ward name, or choose on the map."
            : "The address lookup service is not responding. You can still choose on the map or use your current location."));
          goTo(2);
          return;
        }
        if (error.code === "RATE_LIMITED") {
          // Retry-After is not exposed to the browser (CORS), so wait a fixed minute.
          setLockedUntil(Date.now() + RATE_LIMIT_FALLBACK_SECONDS * 1000);
          return;
        }
        if (error.code === "NO_FEASIBLE_ITINERARY") {
          setOutcome({ kind: "infeasible", message: error.message, details: error.details });
          return;
        }
      }
      setOutcome({ kind: "error", message: apiErrorMessage(error, tr) });
    },
  });

  function goTo(next: number) {
    setDirection(next > step ? 1 : -1);
    const query = new URLSearchParams(params.toString());
    query.set("step", String(next));
    ["days", "people", "budget", "startDate", "startName", "startLat", "startLng"].forEach((key) => query.delete(key));
    const url = `/plan?${query}`;
    // Same page, new step: the native History API updates useSearchParams
    // without a server round-trip, and Back still walks the steps. Each step
    // entry records how many steps deep it is, so Close can leave in one go.
    window.history.pushState({ [PLAN_DEPTH]: planDepth() + 1 }, "", url);
  }
  /** Move focus to the first field with an error (spec §8.3). */
  function focusFirstError(fields: (keyof TripFormValues)[]) {
    const first = fields.find((field) => form.getFieldState(field).invalid);
    const target = first && FOCUS_TARGETS[first];
    // After the next paint: a collapsed section opens itself on an error first.
    if (target) window.requestAnimationFrame(() => document.querySelector<HTMLElement>(target)?.focus());
  }
  async function next() {
    const fields = STEP_FIELDS[step - 1];
    if (await form.trigger(fields, { shouldFocus: true })) goTo(step + 1);
    else focusFirstError(fields);
  }
  function submit(values: TripFormValues) {
    setOutcome(null);
    setLocationError(null);
    mutation.mutate(values);
  }
  function cancel() {
    abort.current?.abort();
    mutation.reset();
  }
  /** Close leaves the form: back past every step to the page before it, or home when the form was the first page. */
  function close() {
    if (openedFromAnotherPage()) window.history.go(-(planDepth() + 1));
    else router.push("/");
  }

  if (mutation.isPending) return <WaitingScreen onCancel={cancel} />;
  if (outcome?.kind === "infeasible") return <Infeasible details={outcome.details} onEdit={() => { setOutcome(null); goTo(1); }} />;

  const slide = reduce ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } } : {
    initial: { opacity: 0, x: 24 * direction }, animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -24 * direction, transition: { duration: 0.2, ease: [0.3, 0, 0.8, 0.15] as const } },
  };
  const art = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.25 } };
  return <div className="flex min-h-screen flex-col">
    <header className="on-red sticky top-0 z-30 bg-hero-red text-white shadow-float">
      <div className="mx-auto flex h-14 max-w-page items-center gap-2 px-2 sm:px-4 lg:px-10">
        <button type="button" onClick={close} aria-label={tr("Close")} className="press grid h-11 w-11 place-items-center rounded-control hover:bg-white/15">
          <X size={24} aria-hidden />
        </button>
        <p className="type-h3 flex-1">{tr("Plan my trip")}</p>
        <p className="tnum pr-2">{tr("Step")} {step}/4</p>
      </div>
      <ol className="mx-auto grid max-w-page grid-cols-4 gap-2 px-4 pb-3 lg:px-10" aria-label={tr("Form progress")}>
        {STEP_LABELS.map((label, index) => <li key={label} aria-current={index + 1 === step ? "step" : undefined}>
          <span className={`block h-1.5 rounded-full transition-colors duration-300 ${index + 1 < step ? "bg-white/75" : index + 1 === step ? "bg-white" : "bg-white/30"}`} aria-hidden />
          <span className="sr-only">{tr(label)}{index + 1 < step ? ` (${tr("done")})` : ""}</span>
        </li>)}
      </ol>
    </header>
    <div className="mx-auto flex w-full max-w-page flex-1 lg:grid lg:grid-cols-12 lg:gap-10 lg:px-10">
      <aside aria-hidden className="hidden lg:col-span-5 lg:block">
        <div className="sticky top-[100px] py-8">
          <div className="collage-table overflow-hidden rounded-card">
            <AnimatePresence mode="wait" initial={false}>
              <m.div key={step} {...art}><Collage canvas={PANEL_CANVAS} clips={panelClips(step)} sizes="300px" /></m.div>
            </AnimatePresence>
          </div>
        </div>
      </aside>
      <form className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 sm:px-6 lg:col-span-7 lg:mx-0 lg:max-w-none lg:px-0" noValidate
        onSubmit={form.handleSubmit(submit, () => focusFirstError(STEP_FIELDS.flat()))}>
        <div ref={heading} tabIndex={-1} className="flex-1 pb-8 pt-4 outline-none lg:flex-none lg:pt-8">
          <div aria-hidden className="collage-table collage-table-strip -mx-4 mb-6 sm:-mx-6 lg:hidden">
            <div className="mx-auto max-w-[520px]">
              <AnimatePresence mode="wait" initial={false}>
                <m.div key={step} {...art}><Collage canvas={STRIP_CANVAS} clips={stripClips(step)} sizes="(min-width: 520px) 200px, 40vw" /></m.div>
              </AnimatePresence>
            </div>
          </div>
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <m.div key={step} {...slide} transition={{ duration: 0.3, ease: [0.05, 0.7, 0.1, 1] }}>
              {step === 1 && <StepTrip form={form} />}
              {step === 2 && <StepStart form={form} locationError={locationError} onLocationError={setLocationError} onOpenMap={() => setMapOpen(true)} />}
              {step === 3 && <StepTravel form={form} />}
              {step === 4 && <StepInterests form={form} onEdit={(target) => goTo(target)} />}
            </m.div>
          </AnimatePresence>
          {outcome?.kind === "error" && <div className="mt-6"><ErrorState message={outcome.message} onRetry={() => form.handleSubmit(submit)()} /></div>}
          {lockedUntil && <p role="alert" className="mt-6 rounded-control bg-wall-yellow-soft p-3 text-warn-ink">
            {tr("You have planned several trips in a short time. Try again in a few minutes.")}
          </p>}
        </div>
        {/* Sticky bar replaces the bottom navigation on /plan. */}
        {/* Phones: pinned to the bottom of the screen. Wide screens: right under
            the step's fields, so zooming never pulls it away from them. */}
        <div className="sticky bottom-0 -mx-4 flex gap-3 border-t border-line bg-paper px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))] sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:px-0 lg:pb-8">
          {/* Back walks the steps; on the first step it leaves the form, like Close. */}
          <Button variant="light" onClick={() => (step > 1 ? goTo(step - 1) : close())} className={step < 4 ? "min-w-[140px]" : "min-w-[180px]"}>{tr("Back")}</Button>
          <div className="flex-1" />
          {/* Separate keys: reusing one <button> and flipping it to type="submit"
              mid-click would submit the form straight from step 3. */}
          {step < 4 ? <Button key="next" variant="primary" onClick={() => void next()} className="min-w-[140px]">{tr("Continue")}</Button>
            : <Button key="submit" type="submit" variant="primary" disabled={Boolean(lockedUntil)} className="min-w-[180px]">{tr("Plan my trip")}</Button>}
        </div>
      </form>
    </div>
    {mapOpen && <PinPicker initial={form.getValues("startLocationCoordinates") ?? null} onClose={() => setMapOpen(false)}
      onPick={(point) => {
        form.setValue("startLocationCoordinates", point, { shouldValidate: true });
        form.setValue("startLocationName", `${tr("Map pin")} ${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`, { shouldValidate: true });
        setLocationError(null);
        setMapOpen(false);
      }} />}
  </div>;
}

function Infeasible({ details, onEdit }: { details: string[]; onEdit: () => void }) {
  const { tr } = usePrefs();
  return <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col justify-center px-6">
    <h1 className="type-h1">{tr("No itinerary fits all your conditions yet.")}</h1>
    {details.length > 0 && <>
      <p className="mt-4 text-ink-muted">{tr("You could try:")}</p>
      <ul className="mt-2 list-disc space-y-1 pl-6">{details.map((item) => <li key={item}>{tr(item)}</li>)}</ul>
    </>}
    <div className="mt-8"><Button variant="primary" onClick={onEdit}>{tr("Edit request")}</Button></div>
  </div>;
}

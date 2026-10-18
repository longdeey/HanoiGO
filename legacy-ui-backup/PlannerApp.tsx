"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { QueryClient, QueryClientProvider, useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { tripSchema, type TripFormValues } from "@/schemas/trip";
import { ApiRequestError, createShareToken, fetchTrip, generateTrip, loginAccount, optimizeTrip, registerAccount, replacePlace, submitPlaceReview } from "@/services/api";
import type { OptimizeStrategy, ReplaceReason } from "@/services/api";
import type { AuthResponse, AuthUser, Holiday, ItineraryOption, Place, TripResponse } from "@/types/trip";
import { translate, type Language } from "@/i18n";
import { hanoiImages } from "@/data/hanoi-images";
import { googleMapsDirectionsUrl } from "@/services/maps";
import { isWithinHanoiServiceArea, manualPinName, mapPinName, parseManualLocation, type Coordinates } from "@/services/locations";
import { PlaceStoryCard, StoryHighlights, StoryReader } from "@/components/Stories";

const ItineraryMap = dynamic(() => import("@/components/ItineraryMap"), { ssr: false });
const StartLocationPicker = dynamic(() => import("@/components/StartLocationPicker"), { ssr: false });
const interests = ["food", "history", "coffee", "local_culture", "museum", "park", "shopping",
  "festival", "hiking", "nature", "craft", "art"];
const steps = ["Trip basics", "Interests", "Budget & travel", "Preferences"];
const loadingMessages = [
  "Analyzing your preferences...", "Finding suitable places...", "Optimizing routes...",
  "Checking budget...", "Building your Hanoi trip...",
];
const optionLabels = {
  BEST_MATCH: "Best Match", BUDGET_FRIENDLY: "Budget Friendly", EXPLORE_MORE: "Explore More",
};
const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value) + " ₫";
const READ_STORIES_KEY = "hanoigo-read-stories";
const todayInHanoi = () => new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());

function PlanningScreen() {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(1);
  const [loadingIndex, setLoadingIndex] = useState(0);
  const [tripData, setTripData] = useState<TripResponse | null>(null);
  const [ownerToken, setOwnerToken] = useState<string | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [sharedTripError, setSharedTripError] = useState<string | null>(null);
  const [sharedTripLoading, setSharedTripLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [manualLocationInput, setManualLocationInput] = useState("");
  const [locationSource, setLocationSource] = useState<"map" | "device" | "manual" | "story" | null>(null);
  const [openStory, setOpenStory] = useState<string | null>(null);
  const [readStories, setReadStories] = useState<ReadonlySet<string>>(new Set());
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const mutation = useMutation({ mutationFn: generateTrip, onSuccess: (trip) => {
    setTripData(trip);
    setReadOnly(false);
    if (trip.ownerToken) {
      setOwnerToken(trip.ownerToken);
      window.localStorage?.setItem(`hanoigo-owner-${trip.tripId}`, trip.ownerToken);
    }
  } });
  const replaceMutation = useMutation({
    mutationFn: ({ tripId, itineraryId, itemId, reason, token }: {
      tripId: string; itineraryId: string; itemId: string; reason: ReplaceReason; token: string;
    }) => replacePlace(tripId, itineraryId, itemId, reason, token),
    onSuccess: setTripData,
  });
  const optimizeMutation = useMutation({
    mutationFn: ({ tripId, itineraryId, strategy, dayNumber, token }: {
      tripId: string; itineraryId: string; strategy: OptimizeStrategy; dayNumber: number; token: string;
    }) => optimizeTrip(tripId, itineraryId, strategy, token, dayNumber),
    onSuccess: setTripData,
  });
  const form = useForm<TripFormValues>({
    resolver: zodResolver(tripSchema),
    defaultValues: {
      language: "en", startDate: todayInHanoi(), days: 3, travelerCount: 2,
      budgetTotal: 3_000_000,
      startLocationName: "Hanoi Old Quarter", interests: ["food", "history", "coffee", "local_culture"],
      travelMode: "walking", travelRadiusMode: "balanced", pace: "balanced",
      experiencePreferences: ["local"], dailyStartTime: "08:00", dailyEndTime: "21:00",
    },
  });
  const values = form.watch();
  const language: Language = tripData?.language ?? values.language;
  const tr = (text: string) => translate(language, text);
  const errorText = (message?: string) => message ? tr(message) : undefined;
  useEffect(() => {
    const storedToken = window.localStorage?.getItem("hanoigo-auth-token");
    const storedUser = window.localStorage?.getItem("hanoigo-auth-user");
    if (storedToken && storedUser) {
      try { setAuthToken(storedToken); setAuthUser(JSON.parse(storedUser) as AuthUser); } catch { window.localStorage?.removeItem("hanoigo-auth-user"); }
    }
  }, []);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tripId = params.get("trip");
    if (!tripId) return;
    const shareToken = params.get("share");
    const savedOwnerToken = window.localStorage?.getItem(`hanoigo-owner-${tripId}`) ?? null;
    const token = shareToken ?? savedOwnerToken;
    if (!token) {
      setSharedTripError("This link needs a valid trip access token.");
      return;
    }
    setReadOnly(Boolean(shareToken));
    setOwnerToken(shareToken ? null : savedOwnerToken);
    setSharedTripLoading(true);
    fetchTrip(tripId, token).then((trip) => {
      setTripData(trip);
      const optionId = params.get("option");
      setSelected(trip.options.some((option) => option.id === optionId) ? optionId : trip.options[0]?.id ?? null);
    }).catch((error: unknown) => {
      setSharedTripError(error instanceof Error ? error.message : "Could not open this trip.");
    }).finally(() => setSharedTripLoading(false));
  }, []);
  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage?.getItem(READ_STORIES_KEY) ?? "[]") as unknown;
      if (Array.isArray(stored)) setReadStories(new Set(stored.filter((item): item is string => typeof item === "string")));
    } catch { /* A missing or corrupt list only hides the "read" marks. */ }
    const story = new URLSearchParams(window.location.search).get("story");
    if (story) setOpenStory(story);
  }, []);
  const showStory = useCallback((slug: string | null) => {
    setOpenStory(slug);
    // ?story=<slug> makes an open story shareable and survives a reload.
    const url = new URL(window.location.href);
    if (slug) url.searchParams.set("story", slug); else url.searchParams.delete("story");
    window.history.replaceState(null, "", url.toString());
  }, []);
  const closeStory = useCallback(() => showStory(null), [showStory]);
  const markStoryRead = useCallback((slug: string) => setReadStories((current) => {
    if (current.has(slug)) return current;
    const next = new Set(current).add(slug);
    try { window.localStorage?.setItem(READ_STORIES_KEY, JSON.stringify([...next])); } catch { /* Read marks are a convenience only. */ }
    return next;
  }), []);
  function planFromPlace(place: Place) {
    form.setValue("startLocationName", place.name, { shouldValidate: true });
    form.setValue("startLocationCoordinates", { latitude: place.latitude, longitude: place.longitude }, { shouldValidate: true });
    setLocationSource("story");
    setLocationError(null);
    setStep(0);
    showStory(null);
    document.getElementById("planner")?.scrollIntoView?.({ behavior: "smooth" });
  }
  useEffect(() => {
    if (!mutation.isPending) return;
    const timer = window.setInterval(() => setLoadingIndex((index) =>
      Math.min(index + 1, loadingMessages.length - 1)), 650);
    return () => window.clearInterval(timer);
  }, [mutation.isPending]);

  function toggle(field: "interests" | "experiencePreferences", value: string) {
    const current = form.getValues(field);
    form.setValue(field, current.includes(value) ? current.filter((item) => item !== value) :
      [...current, value], { shouldValidate: true });
  }

  function useCurrentLocation() {
    setLocationError(null);
    if (!window.isSecureContext) {
      setLocationError("Device location requires HTTPS or localhost. Enter coordinates or a map link instead.");
      setManualEntryOpen(true);
      return;
    }
    if (!navigator.geolocation) {
      setLocationError("Device location is unavailable. Enter coordinates or a map link instead.");
      setManualEntryOpen(true);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition((position) => {
      setLocating(false);
      const { latitude, longitude } = position.coords;
      if (!isWithinHanoiServiceArea({ latitude, longitude })) {
        setLocationError("Your current location is outside the Hanoi service area.");
        return;
      }
      form.setValue("startLocationName", "Current location", { shouldValidate: true });
      form.setValue("startLocationCoordinates", { latitude, longitude }, { shouldValidate: true });
      setLocationSource("device");
    }, (error) => {
      setLocating(false);
      setManualEntryOpen(true);
      setLocationError(error.code === 1 ?
        "Location permission was denied. Enter coordinates or a map link instead." :
        "Could not access device location. Enter coordinates or a map link instead.");
    }, { timeout: 8_000, enableHighAccuracy: false });
  }

  function pickMapLocation(coordinates: Coordinates) {
    if (!isWithinHanoiServiceArea(coordinates)) {
      setLocationError("Choose a point within the Hanoi service area.");
      return;
    }
    setLocationError(null);
    form.setValue("startLocationCoordinates", coordinates, { shouldValidate: true });
    form.setValue("startLocationName", mapPinName(coordinates), { shouldValidate: true });
    setLocationSource("map");
  }

  function saveManualLocation() {
    const coordinates = parseManualLocation(manualLocationInput);
    if (!coordinates) {
      setLocationError("Enter Hanoi coordinates such as 21.034, 105.850 or a Google Maps link containing coordinates.");
      return;
    }
    setLocationError(null);
    form.setValue("startLocationCoordinates", coordinates, { shouldValidate: true });
    form.setValue("startLocationName", manualPinName(coordinates), { shouldValidate: true });
    setLocationSource("manual");
  }

  async function next() {
    const fields: (keyof TripFormValues)[][] = [
      ["startDate", "days", "travelerCount", "startLocationName", "dailyStartTime", "dailyEndTime"],
      ["interests"], ["budgetTotal", "travelMode", "travelRadiusMode"],
    ];
    if (await form.trigger(fields[step])) setStep(step + 1);
  }

  function submit(values: TripFormValues) {
    setSelected(null);
    setSelectedDay(1);
    setLoadingIndex(0);
    setTripData(null);
    setOwnerToken(null);
    setReadOnly(false);
    setSharedTripError(null);
    setShareCopied(false);
    setShareUrl(null);
    setShareToken(null);
    setShareError(null);
    window.history.replaceState(null, "", window.location.pathname);
    mutation.mutate(values);
  }

  async function shareTrip() {
    if (!response || !selectedOption || !ownerToken) return;
    setShareError(null);
    let token = shareToken;
    if (!token) {
      try {
        token = await createShareToken(response.tripId, ownerToken);
        setShareToken(token);
      } catch (error) {
        setShareError(error instanceof Error ? error.message : "Could not create a share link.");
        return;
      }
    }
    const url = new URL(window.location.href);
    url.searchParams.set("trip", response.tripId);
    url.searchParams.set("option", selectedOption.id);
    url.searchParams.set("share", token);
    setShareUrl(url.toString());
    try {
      await navigator.clipboard.writeText(url.toString());
      setShareCopied(true);
    } catch {
      setShareCopied(false);
    }
  }

  const response = tripData;
  const selectedOption = response?.options.find((option) => option.id === selected);
  const modifying = replaceMutation.isPending || optimizeMutation.isPending;
  const modificationError = replaceMutation.error ?? optimizeMutation.error;
  function handleReplace(itemId: string, reason: ReplaceReason) {
    if (response && selectedOption && ownerToken) replaceMutation.mutate({
      tripId: response.tripId, itineraryId: selectedOption.id, itemId, reason, token: ownerToken,
    });
  }
  function handleOptimize(strategy: OptimizeStrategy) {
    if (response && selectedOption && ownerToken) optimizeMutation.mutate({
      tripId: response.tripId, itineraryId: selectedOption.id, strategy, dayNumber: selectedDay,
      token: ownerToken,
    });
  }
  return <main className="min-h-screen bg-brand-cream text-brand-ink">
    <header className="border-b border-brand-line bg-white/90 px-5 py-4">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <a href="#top" className="text-2xl font-black tracking-tight text-brand-red">HanoiGO<span className="text-brand-yellow">.</span></a>
        <div className="flex items-center gap-3"><AuthControls language={language} user={authUser} onAuthenticated={(result) => { setAuthToken(result.token); setAuthUser(result.user); window.localStorage?.setItem("hanoigo-auth-token", result.token); window.localStorage?.setItem("hanoigo-auth-user", JSON.stringify(result.user)); }} onLogout={() => { setAuthToken(null); setAuthUser(null); window.localStorage?.removeItem("hanoigo-auth-token"); window.localStorage?.removeItem("hanoigo-auth-user"); }} /><a href="#planner" className="rounded-full bg-brand-red px-5 py-2 text-sm font-semibold text-white">{tr("Build my trip")}</a></div>
      </div>
    </header>
    <section id="top" className="relative overflow-hidden bg-brand-maroon text-white">
      <Image src={hanoiImages.hero.src} alt={hanoiImages.hero.alt} fill priority sizes="100vw" className="hero-photo" />
      <div className="absolute inset-0 bg-gradient-to-r from-brand-maroon/95 via-brand-maroon/75 to-brand-maroon/10" aria-hidden="true" />
      <div className="relative mx-auto max-w-6xl px-5 py-16 md:py-28">
        <div className="max-w-2xl">
          <span className="rounded-full bg-brand-yellow px-4 py-2 text-sm font-bold text-brand-ink">{tr("Your Hanoi, thoughtfully planned")}</span>
          <h1 className="mt-6 max-w-2xl text-4xl font-black leading-tight md:text-6xl">{tr("More Hanoi. Less planning.")}</h1>
          <p className="mt-5 max-w-xl text-lg text-white/85">{tr("Build a practical trip around your time, budget, interests, and walking distance. Compare three routes and make every day count.")}</p>
          <p className="mt-3 text-sm font-semibold text-brand-yellow">{tr("Real Hanoi places, real opening hours, honest budgets.")}</p>
          <a href="#planner" className="mt-7 inline-block rounded-xl bg-brand-red px-6 py-3 font-bold text-white shadow-lg shadow-black/30 ring-2 ring-brand-yellow/70">{tr("Build my trip →")}</a>
          <div className="mt-9">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-yellow">{tr("A better way to explore")}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {["Tell us your time and budget", "Explore ranked Hanoi places", "Compare three practical itineraries", "See your day, route, and costs"].map((text, index) =>
                <div key={text} className="flex items-center gap-3 rounded-xl bg-white/10 p-3 text-sm backdrop-blur"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-yellow font-bold text-brand-ink">{index + 1}</span>{tr(text)}</div>)}
            </div>
          </div>
        </div>
      </div>
    </section>
    <StoryHighlights language={language} readSlugs={readStories} onOpen={showStory} />
    <section id="planner" className="mx-auto max-w-6xl px-5 pb-16 pt-10">
      <div className="rounded-3xl border border-brand-line bg-white p-5 shadow-sm md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-sm font-bold uppercase tracking-widest text-brand-red">{tr("Trip planner")}</p><h2 className="mt-1 text-2xl font-bold">{tr("Shape your Hanoi days")}</h2></div>
          <p className="text-sm text-brand-muted">{tr("Step")} {step + 1} {tr("of")} 4</p>
        </div>
        <div className="mt-5 grid grid-cols-4 gap-2" aria-label="Form progress">{steps.map((label, index) =>
          <div key={label}><div className={`h-2 rounded-full ${index <= step ? "bg-brand-red" : "bg-brand-line"}`} /><span className="mt-2 hidden text-xs text-brand-muted sm:block">{tr(label)}</span></div>)}</div>
        <form className="mt-8" onSubmit={form.handleSubmit(submit)}>
          {step === 0 && <div className="grid gap-5 sm:grid-cols-2">
            <Field label={tr("Days")} error={errorText(form.formState.errors.days?.message)}><input type="number" min="1" max="14" {...form.register("days", { valueAsNumber: true })} className="input" /></Field>
            <Field label={tr("People")} error={errorText(form.formState.errors.travelerCount?.message)}><input type="number" min="1" max="20" {...form.register("travelerCount", { valueAsNumber: true })} className="input" /></Field>
            <Field label={tr("Travel start date")} error={errorText(form.formState.errors.startDate?.message)}>
              <input type="date" min={todayInHanoi()} {...form.register("startDate")} className="input" />
            </Field>
            <div>
              <Field label={tr("Starting point")} error={errorText(form.formState.errors.startLocationName?.message)}>
                <input type="text" {...form.register("startLocationName", { onChange: () => {
                  form.setValue("startLocationCoordinates", undefined);
                  setLocationSource(null);
                  setLocationError(null);
                } })} placeholder={tr("Enter any Hanoi address or place")} className="input" />
              </Field>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold text-brand-red">
                <button type="button" onClick={useCurrentLocation} disabled={locating}
                  className="underline disabled:opacity-50">{tr(locating ? "Finding device location..." : "Use my current location")}</button>
                <button type="button" onClick={() => setMapPickerOpen((open) => !open)}
                  className="underline">{tr(mapPickerOpen ? "Hide map picker" : "Pick on map")}</button>
                <button type="button" onClick={() => setManualEntryOpen((open) => !open)}
                  className="underline">{tr("Enter coordinates or Google Maps link")}</button>
              </div>
              <p className="mt-2 text-xs text-brand-muted">{tr("Typed addresses use online lookup. Coordinates and map links work when lookup is unavailable.")}</p>
              {manualEntryOpen && <div className="mt-3 rounded-xl border border-brand-line bg-brand-sand p-3">
                <label className="block text-sm font-semibold">{tr("Coordinates or map link")}
                  <input type="text" value={manualLocationInput} onChange={(event) => setManualLocationInput(event.target.value)}
                    placeholder="21.034, 105.850" className="input mt-2" />
                </label>
                <button type="button" onClick={saveManualLocation}
                  className="mt-3 rounded-lg bg-brand-red px-4 py-2 text-sm font-bold text-white">{tr("Use this starting point")}</button>
              </div>}
              {mapPickerOpen && <StartLocationPicker selected={values.startLocationCoordinates ?? null}
                onPick={pickMapLocation} language={language} />}
              {locationError && <p role="alert" className="mt-2 text-sm text-red-700">{tr(locationError)}</p>}
              {values.startLocationCoordinates && <p role="status" className="mt-2 text-xs text-brand-muted">
                {tr(locationSource === "manual" ? "Manual starting point selected" :
                  locationSource === "map" ? "Map starting point selected" :
                  locationSource === "story" ? "Starting point set from a story" : "Device location selected")}
                {` · ${values.startLocationCoordinates.latitude.toFixed(5)}, ${values.startLocationCoordinates.longitude.toFixed(5)}`}
              </p>}
            </div>
            <Field label={tr("Language")}><select {...form.register("language")} className="input"><option value="en">English</option><option value="vi">Tiếng Việt</option></select></Field>
            <Field label={tr("Daily start")} error={errorText(form.formState.errors.dailyStartTime?.message)}><input type="time" {...form.register("dailyStartTime")} className="input" /></Field>
            <Field label={tr("Daily end")} error={errorText(form.formState.errors.dailyEndTime?.message)}><input type="time" {...form.register("dailyEndTime")} className="input" /></Field>
          </div>}
          {step === 1 && <div><h3 className="text-lg font-bold">{tr("What would you enjoy?")}</h3><p className="text-sm text-brand-muted">{tr("Choose at least one.")}</p><div className="mt-5 flex flex-wrap gap-3">{interests.map((interest) =>
            <button key={interest} type="button" aria-pressed={values.interests.includes(interest)} onClick={() => toggle("interests", interest)} className={`choice ${values.interests.includes(interest) ? "choice-active" : ""}`}>{tr(interest).replaceAll("_", " ")}</button>)}</div>
            {form.formState.errors.interests && <p role="alert" className="mt-3 text-sm text-red-700">{errorText(form.formState.errors.interests.message)}</p>}</div>}
          {step === 2 && <div className="grid gap-5 sm:grid-cols-2">
            <Field label={tr("Total budget (VND)")} error={errorText(form.formState.errors.budgetTotal?.message)}><input type="number" min="1" step="10000" {...form.register("budgetTotal", { valueAsNumber: true })} className="input" /></Field>
            <Field label={tr("Travel mode")}><select {...form.register("travelMode")} className="input"><option value="walking">{tr("Walking")}</option><option value="motorbike">{tr("Motorbike")}</option><option value="car">{tr("Car")}</option></select></Field>
            <Field label={tr("Travel radius")}><select {...form.register("travelRadiusMode")} className="input"><option value="near">{tr("Nearby · under 5 km")}</option><option value="balanced">{tr("Medium · 5–15 km")}</option><option value="wide">{tr("Far · over 15 km")}</option></select>
              <p className="mt-2 text-xs text-brand-muted">{values.travelMode === "walking" ? tr("Walking is capped at 10 km; choose motorbike or car for wider areas.") : tr("The selected radius is used to find places around your starting point.")}</p>
            </Field>
          </div>}
          {step === 3 && <div><h3 className="text-lg font-bold">{tr("Pace")}</h3><p className="mt-1 text-sm text-brand-muted">{tr("Choose how full each day should feel.")}</p><div className="mt-4 flex flex-wrap gap-2">{(["relaxed", "balanced", "active"] as const).map((pace) =>
            <button key={pace} type="button" aria-pressed={values.pace === pace} onClick={() => form.setValue("pace", pace)} className={`choice ${values.pace === pace ? "choice-active" : ""}`}>{tr(pace)}</button>)}</div></div>}
          <div className="mt-8 flex justify-between gap-3"><button type="button" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} className="rounded-xl border px-5 py-3 font-semibold disabled:opacity-40">{tr("Back")}</button>
            {step < 3 ? <button type="button" onClick={next} className="rounded-xl bg-brand-red px-6 py-3 font-bold text-white">{tr("Next")}</button> : <button type="submit" disabled={mutation.isPending} className="rounded-xl bg-brand-red px-6 py-3 font-bold text-white disabled:opacity-60">{tr("Build my Hanoi trip")}</button>}</div>
        </form>
      </div>
      {mutation.isPending && <div role="status" className="mt-8 rounded-2xl bg-brand-yellow-soft p-6 text-center font-semibold text-brand-red">{tr(loadingMessages[loadingIndex])}</div>}
      {sharedTripLoading && <div role="status" className="mt-8 rounded-2xl bg-brand-yellow-soft p-6 text-center font-semibold text-brand-red">{tr("Opening shared trip...")}</div>}
      {sharedTripError && <div role="alert" className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">{sharedTripError}</div>}
      {mutation.isError && <div role="alert" className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
        <p>{mutation.error instanceof ApiRequestError && mutation.error.code === "NO_FEASIBLE_ITINERARY" ?
          tr("No itinerary fits these constraints.") : mutation.error instanceof ApiRequestError &&
          mutation.error.code === "LOCATION_SERVICE_UNAVAILABLE" ?
          tr("Address lookup is unavailable. Enter coordinates, paste a map link, or pick on the map.") : mutation.error.message}</p>
        {mutation.error instanceof ApiRequestError && mutation.error.details.length > 0 &&
          <ul className="mt-3 list-disc pl-5 text-sm">{mutation.error.details.map((suggestion) =>
            <li key={suggestion}>{tr(suggestion)}</li>)}</ul>}
        {mutation.error instanceof ApiRequestError && mutation.error.code === "LOCATION_SERVICE_UNAVAILABLE" &&
          <button type="button" onClick={() => { setStep(0); setManualEntryOpen(true); }}
            className="mt-3 font-semibold text-brand-red underline">{tr("Enter coordinates or Google Maps link")}</button>}
      </div>}
      {modifying && <div role="status" className="mt-8 rounded-2xl bg-brand-yellow-soft p-5 text-center font-semibold text-brand-red">{tr("Recalculating timeline, route, and budget...")}</div>}
      {modificationError && <div role="alert" className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800">{modificationError.message}</div>}
      {shareError && <div role="alert" className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800">{shareError}</div>}
      {response && !mutation.isPending && response.options.length === 0 && <div className="mt-8 rounded-2xl border p-6">{tr("No itinerary options were returned. Try a wider radius or budget.")}</div>}
      {response && response.options.length > 0 && <div className="mt-12">
        <h2 className="text-2xl font-black">{tr("Your three Hanoi routes")}</h2>
        <p className="mt-1 text-brand-muted">{tr("Every plan respects your budget and daily hours.")}</p>
        {(response.holidays ?? []).length > 0 && <HolidayPanel holidays={response.holidays ?? []} language={language}
          mode={response.travelMode} tr={tr} onOpenStory={showStory} />}
        {response.seasonalHighlights.length > 0 && <div className="mt-6 rounded-2xl border border-[#e7d4ad] bg-[#fff8e9] p-5">
          <h3 className="text-lg font-black text-[#6b3c1c]">{tr("Seasonal experiences for your dates")}</h3>
              <p className="mt-1 text-sm text-[#73593e]">{tr("Explore these events when route, time, and budget allow.")}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">{response.seasonalHighlights.map((highlight) =>
            <article key={`${highlight.place.id}-${highlight.date}`} className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2"><h4 className="font-bold">{highlight.place.name}</h4>
                <span className="rounded-full bg-brand-yellow-soft px-2 py-1 text-xs font-bold text-brand-red">{highlight.date}</span></div>
              <p className="mt-1 text-sm text-brand-muted">{tr(highlight.place.category).replaceAll("_", " ")}</p>
              {highlight.place.annual && <p className="mt-1 text-xs text-brand-muted">{tr("Repeats around this date each year")}</p>}
              <div className="mt-2 flex flex-wrap gap-4"><DirectionsLink place={highlight.place} language={language} mode={response.travelMode} />
                {highlight.place.informationSource && <a href={highlight.place.informationSource} target="_blank" rel="noopener noreferrer"
                  className="mt-2 text-sm font-bold text-[#6b3c1c] underline">{tr("Event information")}</a>}</div>
            </article>)}</div>
        </div>}
        {response.stayOptions.length > 0 && <div className="mt-6 rounded-2xl border border-brand-line bg-brand-cream p-5">
          <h3 className="text-lg font-black text-brand-maroon">{tr("Suggested stays near your route")}</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{response.stayOptions.map((stay) =>
            <article key={stay.id} className="rounded-xl bg-white p-4 shadow-sm">
              <h4 className="font-bold">{stay.name}</h4>
              <p className="mt-1 text-sm capitalize text-brand-muted">{tr(stay.category).replaceAll("_", " ")}</p>
              <p className="mt-2 text-sm font-semibold text-brand-red">{tr("Estimated nightly rate")}: {money(stay.averageCost)}</p>
              {stay.annual && <p className="mt-1 text-xs text-brand-muted">{tr("Repeats around this date each year")}</p>}
              <DirectionsLink place={stay} language={language} mode={response.travelMode} />
            </article>)}
          </div>
        </div>}
        <div className="mt-5 grid gap-4 md:grid-cols-3">{response.options.map((option) => <OptionCard key={option.id} option={option} language={language} selected={selected === option.id} onSelect={() => { setSelected(option.id); setSelectedDay(1); setShareCopied(false); setShareUrl(null); }} />)}</div>
      </div>}
      {selectedOption && <>{!readOnly && ownerToken && <div className="mt-6 text-right"><button type="button" onClick={() => void shareTrip()} className="rounded-xl border border-brand-red px-4 py-2 font-semibold text-brand-red">{tr(shareCopied ? "Link copied" : "Copy share link")}</button>{shareUrl && !shareCopied && <input aria-label={tr("Share link")} readOnly value={shareUrl} onFocus={(event) => event.currentTarget.select()} className="mt-2 w-full rounded-lg border p-2 text-sm" />}</div>}<ItineraryDetail option={selectedOption} authToken={authToken} authUserName={authUser?.displayName ?? null} startLocation={response?.startLatitude !== undefined && response.startLongitude !== undefined ? { latitude: response.startLatitude, longitude: response.startLongitude } : undefined} travelMode={response?.travelMode ?? "walking"} language={language} dayNumber={selectedDay} onDayChange={setSelectedDay} onReplace={handleReplace} onOptimize={handleOptimize} onOpenStory={showStory} modifying={modifying} readOnly={readOnly} /></>}
    </section>
    {openStory && <StoryReader slug={openStory} language={language} travelMode={response?.travelMode ?? values.travelMode}
      onClose={closeStory} onOpen={showStory} onRead={markStoryRead} onPlanFrom={readOnly ? undefined : planFromPlace} />}
  </main>;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <div><label className="block"><span className="mb-2 block text-sm font-semibold">{label}</span>{children}</label>{error && <span role="alert" className="mt-1 block text-sm text-red-700">{error}</span>}</div>;
}

function OptionCard({ option, selected, onSelect, language }: { option: ItineraryOption; selected: boolean; onSelect: () => void; language: Language }) {
  const tr = (text: string) => translate(language, text);
  return <article className={`rounded-2xl border bg-white p-5 shadow-sm ${selected ? "border-brand-red ring-2 ring-brand-red/25" : "border-brand-line"}`}>
    <div className="flex items-start justify-between gap-2"><h3 className="text-xl font-bold">{tr(optionLabels[option.type])}</h3><span className="rounded-full bg-brand-yellow-soft px-3 py-1 text-sm font-bold text-brand-red">{option.matchScore}% {language === "vi" ? "phù hợp" : "match"}</span></div>
    <p className="mt-5 text-2xl font-black">{money(option.estimatedTotalCost)}</p>
    <p className="mt-1 text-xs text-brand-muted">{tr("Uses")} {Math.round(100 * option.budget.total / Math.max(1, option.budget.total + option.budget.remaining))}% {tr("of your budget")}</p>
    {option.budgetTargetMet === false && option.budgetTargetShare && <p role="note" className="mt-1 text-xs font-semibold text-amber-700">{tr("Could not use at least")} {Math.round(100 * option.budgetTargetShare)}% {tr("of the budget with places along this route. Try a wider radius or another travel mode.")}</p>}
    <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-brand-muted"><span>{option.totalPlaces} {language === "vi" ? "địa điểm" : "places"}</span><span>{option.estimatedTotalDistanceKm.toFixed(1)} km</span><span>{option.estimatedTotalTravelMinutes} {language === "vi" ? "phút di chuyển" : "min travel"}</span><span>{money(option.budget.remaining)} {language === "vi" ? "còn lại" : "left"}</span></div>
    <button type="button" onClick={onSelect} className="mt-5 w-full rounded-xl bg-brand-red px-4 py-3 font-semibold text-white">{tr("View plan")}</button>
  </article>;
}

function AuthControls({ language, user, onAuthenticated, onLogout }: {
  language: Language; user: AuthUser | null; onAuthenticated: (result: AuthResponse) => void; onLogout: () => void;
}) {
  const tr = (text: string) => translate(language, text);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [displayName, setDisplayName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: () => mode === "login" ? loginAccount(identifier.trim(), password) : registerAccount(displayName.trim(), identifier.trim(), password),
    onSuccess: (result) => { onAuthenticated(result); setOpen(false); setError(null); },
    onError: (reason: unknown) => setError(reason instanceof Error ? reason.message : tr("Authentication failed")),
  });
  if (user) return <div className="flex items-center gap-2 text-sm"><span className="hidden font-semibold text-brand-maroon sm:inline">{user.displayName}</span><button type="button" onClick={onLogout} className="font-semibold text-brand-red underline">{tr("Sign out")}</button></div>;
  return <div className="relative"><button type="button" onClick={() => setOpen(!open)} className="rounded-full border border-brand-red px-3 py-2 text-sm font-semibold text-brand-red">{tr("Sign in")}</button>{open && <div className="absolute right-0 top-11 z-30 w-72 rounded-2xl border bg-white p-4 shadow-xl"><div className="mb-3 flex gap-3 text-sm"><button type="button" onClick={() => setMode("login")} className={mode === "login" ? "font-bold text-brand-red" : "text-brand-muted"}>{tr("Sign in")}</button><button type="button" onClick={() => setMode("register")} className={mode === "register" ? "font-bold text-brand-red" : "text-brand-muted"}>{tr("Register")}</button></div>{mode === "register" && <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={tr("Display name")} className="mb-2 w-full rounded-lg border p-2 text-sm" /> }<input value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder={tr("Gmail or phone number")} className="mb-2 w-full rounded-lg border p-2 text-sm" /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={tr("Password (8+ characters)")} className="mb-2 w-full rounded-lg border p-2 text-sm" /><button type="button" disabled={mutation.isPending || identifier.length < 5 || password.length < 8 || (mode === "register" && displayName.trim().length < 2)} onClick={() => mutation.mutate()} className="w-full rounded-lg bg-brand-red px-3 py-2 text-sm font-bold text-white disabled:opacity-50">{tr(mode === "login" ? "Sign in" : "Create account")}</button>{error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}</div>}</div>;
}

function FactBadges({ place, language }: { place: Place; language: Language }) {
  const tr = (text: string) => translate(language, text);
  return <div className="mt-2 flex flex-wrap gap-2 text-xs">
    {place.highlightLevel === "must_see" && <span className="rounded-full bg-red-600 px-2 py-1 font-bold text-white">★ {tr("Can't miss")}</span>}
    {place.highlightLevel === "notable" && <span className="rounded-full bg-amber-200 px-2 py-1 font-semibold text-amber-950">✦ {tr("Worth a stop")}</span>}
    {place.bookingSource && <a href={place.bookingSource} target="_blank" rel="noopener noreferrer" className="rounded-full bg-brand-yellow-soft px-2 py-1 text-brand-red underline">{tr("Booking/ticket information")}</a>}
  </div>;
}

function PlaceFeedback({ place, language, authToken, authUserName }: { place: Place; language: Language; authToken: string | null; authUserName: string | null }) {
  const tr = (text: string) => translate(language, text);
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [addedReviews, setAddedReviews] = useState<{ id: string; authorName: string; rating: number; comment: string; createdAt: string }[]>([]);
  const reviewMutation = useMutation({
    mutationFn: () => submitPlaceReview(place.id, authToken ?? "", rating, comment.trim()),
    onSuccess: () => {
      setAddedReviews((reviews) => [...reviews, {
        id: `local-${Date.now()}`, authorName: authUserName ?? "", rating,
        comment: comment.trim(), createdAt: new Date().toISOString(),
      }]);
      setSubmitted(true); setOpen(false); setComment("");
    },
  });
  const comments = [...addedReviews, ...(place.comments ?? [])];
  const ratingCount = (place.ratingCount ?? 0) + addedReviews.length;
  const average = ratingCount > 0 ? ((place.ratingAverage ?? 0) * (place.ratingCount ?? 0) + addedReviews.reduce((sum, review) => sum + review.rating, 0)) / ratingCount : 0;
  return <div className="mt-3 rounded-xl border border-brand-line bg-brand-cream p-3 text-sm">
    <div className="flex flex-wrap items-center gap-2"><span className="font-bold text-[#b36b00]">★ {average ? average.toFixed(1) : "—"}</span><span className="text-brand-muted">({ratingCount} {tr("reviews")})</span><button type="button" onClick={() => setOpen(!open)} className="ml-auto font-semibold text-brand-red underline">{tr("Write a review")}</button></div>
    {comments.length > 0 ? <div className="mt-2 space-y-2">{comments.slice(0, 3).map((review) => <blockquote key={review.id} className="border-l-2 border-brand-yellow pl-3 text-brand-ink">“{review.comment}” <span className="text-xs text-brand-muted">— {review.authorName} · {"★".repeat(review.rating)}</span></blockquote>)}</div> : <p className="mt-2 text-xs text-brand-muted">{tr("No reviews yet")}</p>}
    {submitted && <p className="mt-2 text-xs font-semibold text-brand-red">{tr("Thanks for your review")}</p>}
    {open && (authToken ? <div className="mt-3 grid gap-2 sm:grid-cols-2"><p className="text-xs text-brand-muted sm:col-span-2">{tr("Posting as")} {authUserName}</p><select aria-label={tr("Rating")} value={rating} onChange={(event) => setRating(Number(event.target.value))} className="rounded-lg border p-2">{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{"★".repeat(value)}</option>)}</select><textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder={tr("Comment")} className="rounded-lg border p-2 sm:col-span-2" rows={2} /><button type="button" disabled={reviewMutation.isPending || comment.trim().length < 2} onClick={() => reviewMutation.mutate()} className="rounded-lg bg-brand-red px-3 py-2 font-bold text-white disabled:opacity-50 sm:col-span-2">{tr("Post review")}</button>{reviewMutation.isError && <p role="alert" className="text-xs text-red-700 sm:col-span-2">{tr("Could not post review")}</p>}</div> : <p className="mt-3 text-xs text-brand-muted">{tr("Sign in to rate and comment")}</p>)}
  </div>;
}

const HOLIDAY_KIND_LABELS: Record<Holiday["kind"], string> = {
  public_holiday: "Public holiday", traditional: "Traditional", festival: "Festival", observance: "Observance",
};

function HolidayPanel({ holidays, language, mode, tr, onOpenStory }: {
  holidays: Holiday[]; language: Language; mode: TripResponse["travelMode"]; tr: (text: string) => string;
  onOpenStory: (slug: string) => void;
}) {
  return <section aria-label={tr("Holidays during your trip")} className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5">
    <h3 className="text-lg font-black text-brand-red">{tr("Holidays during your trip")}</h3>
    <p className="mt-1 text-sm text-[#73593e]">{tr("Your dates include these Vietnamese holidays and festivals.")}</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">{holidays.map((holiday) =>
      <article key={`${holiday.key}-${holiday.startDate}`} className="rounded-xl bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2"><h4 className="font-bold">{holiday.name}</h4>
          <span className="rounded-full bg-brand-yellow-soft px-2 py-1 text-xs font-bold text-brand-red">
            {holiday.tripDates.length > 1 ? `${holiday.tripDates[0]} → ${holiday.tripDates[holiday.tripDates.length - 1]}` : holiday.tripDates[0] ?? holiday.startDate}
          </span></div>
        <p className="mt-1 text-xs font-bold uppercase tracking-wide text-brand-muted">{tr(HOLIDAY_KIND_LABELS[holiday.kind])}</p>
        <p className="mt-2 text-sm">{holiday.description}</p>
        <p className="mt-2 text-sm"><span className="font-bold">{tr("Suggestion")}: </span>{holiday.suggestion}</p>
        {holiday.isPublicHoliday && <p className="mt-2 text-xs text-brand-muted">{tr("Expect crowds and some closures; check opening hours.")}</p>}
        {holiday.relatedPlaces.length > 0 && <div className="mt-3">
          <p className="text-xs font-bold text-brand-muted">{tr("Where to go")}</p>
          <ul className="mt-1 space-y-1">{holiday.relatedPlaces.map((place) =>
            <li key={place.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>{place.name}</span><span className="flex flex-wrap items-center gap-3">{place.story && <button type="button"
                onClick={() => onOpenStory(place.story!.slug)} className="mt-2 text-sm font-bold text-[#6b3c1c] underline">📖 {tr("Read the story")}</button>}
                <DirectionsLink place={place} language={language} mode={mode} /></span></li>)}</ul>
        </div>}
      </article>)}</div>
  </section>;
}

function DirectionsLink({ place, language, mode }: {
  place: Place; language: Language; mode: TripResponse["travelMode"];
}) {
  return <a href={googleMapsDirectionsUrl(place, mode)} target="_blank" rel="noopener noreferrer"
    className="mt-2 inline-block text-sm font-bold text-brand-red underline">
    {translate(language, "Navigate with Google Maps")}
  </a>;
}

function ItineraryDetail({ option, authToken, authUserName, startLocation, travelMode, language, dayNumber, onDayChange, onReplace, onOptimize, onOpenStory, modifying, readOnly }: {
  option: ItineraryOption; travelMode: TripResponse["travelMode"];
  authToken: string | null; authUserName: string | null;
  startLocation?: { latitude: number; longitude: number };
  language: Language; dayNumber: number; onDayChange: (day: number) => void;
  onReplace: (itemId: string, reason: ReplaceReason) => void;
  onOptimize: (strategy: OptimizeStrategy) => void;
  onOpenStory: (slug: string) => void;
  modifying: boolean; readOnly: boolean;
}) {
  const tr = (text: string) => translate(language, text);
  const day = option.days.find((item) => item.dayNumber === dayNumber);
  const storyCount = day?.items.filter((item) => item.place.story).length ?? 0;
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [replacementItemId, setReplacementItemId] = useState<string | null>(null);
  const [reason, setReason] = useState<ReplaceReason>("TOO_FAR");
  useEffect(() => { setSelectedItemId(null); setReplacementItemId(null); }, [option.days, dayNumber]);
  return <section className="mt-10 rounded-3xl border border-brand-line bg-white p-5 md:p-8">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-bold uppercase tracking-widest text-brand-red">{tr(optionLabels[option.type])}</p><h2 className="text-2xl font-black">{tr("Your daily itinerary")}</h2></div><span className="rounded-full bg-brand-yellow-soft px-4 py-2 text-sm font-bold text-brand-red">{tr("Within budget")}</span></div>
    <div className="mt-6 flex gap-2 overflow-x-auto">{option.days.map((item) => <button key={item.dayNumber} type="button" onClick={() => onDayChange(item.dayNumber)} className={`shrink-0 rounded-full px-5 py-2 text-sm font-bold ${item.dayNumber === dayNumber ? "bg-brand-red text-white" : "bg-brand-sand"}`}>{tr("Day")} {item.dayNumber} <span className="ml-1 text-xs font-normal">· {item.date}</span></button>)}</div>
    {!readOnly && <div className="mt-5 flex flex-wrap gap-2" aria-label="Quick optimization actions">{([
      ["Reduce cost", "REDUCE_COST"], ["Reduce travel", "REDUCE_DISTANCE"],
      ["Prefer indoor", "PREFER_INDOOR"], ["More local", "MORE_LOCAL"],
      ["More food", "MORE_FOOD"], ["More check-in", "MORE_CHECKIN"],
      ["Regenerate day", "REGENERATE_DAY"],
    ] as const).map(([label, strategy]) => <button key={strategy} type="button" disabled={modifying} onClick={() => onOptimize(strategy)} className="rounded-full border border-brand-red/40 px-4 py-2 text-sm font-semibold text-brand-red disabled:opacity-50">{tr(label)}</button>)}</div>}
    <div className="mt-7 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]"><div>
      {day?.items.map((item) => <div key={item.id} className={`relative border-l-2 pb-7 pl-7 last:border-transparent last:pb-0 ${selectedItemId === item.id ? "border-brand-yellow" : "border-brand-yellow"}`}><span className="absolute -left-2 top-1 h-3 w-3 rounded-full bg-brand-red" /><p className="text-sm font-bold text-brand-red">{item.startTime} – {item.endTime}</p><h3 className="mt-1 text-lg font-bold"><button type="button" onClick={() => setSelectedItemId(item.id)} className="text-left hover:text-brand-red">{item.place.name}</button></h3><p className="mt-1 text-sm capitalize text-brand-muted">{tr(item.place.category).replaceAll("_", " ")} · {item.visitMinutes} {language === "vi" ? "phút tham quan" : "min visit"} · {item.travelMinutes} {language === "vi" ? "phút di chuyển" : "min travel"}</p><p className="mt-1 text-sm text-brand-muted">{item.travelKm.toFixed(1)} km {language === "vi" ? "từ điểm trước" : "from previous"}</p><p className="mt-2 flex flex-wrap items-center gap-2 text-sm"><span className="rounded-lg bg-brand-yellow-soft px-2 py-1 font-bold text-brand-red-deep">{tr("Estimated cost")}: {item.estimatedCost > 0 ? money(item.estimatedCost) : tr("Free")}</span>{item.place.entranceFee > 0 && <span className="rounded-lg bg-brand-sand px-2 py-1 text-brand-muted">{tr("Entrance")}: {money(item.place.entranceFee)} / {tr("per person")}</span>}{item.travelCost > 0 && <span className="rounded-lg bg-brand-sand px-2 py-1 text-brand-muted">{tr("Ride fare")}: {money(item.travelCost)}</span>}</p><div className="mt-2 flex flex-wrap gap-2">{item.reasons.map((reason) => <span key={reason} className="rounded-full bg-brand-yellow-soft px-2 py-1 text-xs text-brand-red">{tr(reason)}</span>)}</div>{item.place.story && <PlaceStoryCard story={item.place.story} language={language} onOpen={onOpenStory} />}<DirectionsLink place={item.place} language={language} mode={travelMode} /><FactBadges place={item.place} language={language} /><PlaceFeedback place={item.place} language={language} authToken={authToken} authUserName={authUserName} />{!readOnly && <div className="mt-3 flex gap-4"><button type="button" disabled={modifying} onClick={() => setReplacementItemId(replacementItemId === item.id ? null : item.id)} className="text-sm font-bold text-brand-red underline disabled:opacity-50">{tr("Replace place")}</button></div>}{!readOnly && replacementItemId === item.id && <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-brand-sand p-3"><label className="text-sm font-semibold" htmlFor={`reason-${item.id}`}>{tr("Reason")}</label><select id={`reason-${item.id}`} value={reason} onChange={(event) => setReason(event.target.value as ReplaceReason)} className="rounded-lg border p-2 text-sm"><option value="TOO_FAR">{tr("Too far")}</option><option value="TOO_EXPENSIVE">{tr("Too expensive")}</option><option value="NOT_INTERESTED">{tr("Not interested")}</option><option value="ALREADY_VISITED">{tr("Already visited")}</option><option value="PREFER_INDOOR">{tr("Prefer indoor")}</option><option value="PREFER_LOCAL">{tr("Prefer local")}</option></select><button type="button" disabled={modifying} onClick={() => onReplace(item.id, reason)} className="rounded-lg bg-brand-red px-3 py-2 text-sm font-bold text-white disabled:opacity-50">{tr("Find replacement")}</button></div>}</div>)}
    </div><div className="space-y-5"><div className="rounded-2xl bg-brand-sand p-5"><h3 className="font-bold">{tr("Day")} {dayNumber} {tr("route")}</h3><p className="mt-2 text-sm text-brand-muted">{day?.estimatedDistanceKm.toFixed(1)} km · {day?.estimatedTravelMinutes} {language === "vi" ? "phút di chuyển" : "min travel"}</p><p className="mt-1 text-sm font-bold text-brand-red-deep">{tr("Day cost")}: {money(day?.estimatedCost ?? 0)}</p>{storyCount > 0 && <p className="mt-1 text-sm text-[#6b3c1c]">📖 {storyCount} {tr("history & culture stories along today's route")}</p>}</div><ItineraryMap key={dayNumber} items={day?.items ?? []} startLocation={startLocation} selectedId={selectedItemId} onSelect={setSelectedItemId} language={language} /><div className="rounded-2xl bg-brand-maroon p-5 text-white"><h3 className="text-lg font-bold">{tr("Budget summary")}</h3><dl className="mt-4 space-y-2 text-sm">{([['Attractions', option.budget.attractions], ['Food & coffee', option.budget.food], ['Transport', option.budget.transport], ['Others', option.budget.others]] as const).map(([label, amount]) => <div key={label} className="flex justify-between"><dt>{tr(label)}</dt><dd>{money(amount)}</dd></div>)}<div className="flex justify-between border-t border-white/20 pt-3 font-bold"><dt>{tr("Estimated total")}</dt><dd>{money(option.budget.total)}</dd></div><div className="flex justify-between text-brand-yellow"><dt>{tr("Remaining")}</dt><dd>{money(option.budget.remaining)}</dd></div></dl></div></div></div>
  </section>;
}

export default function PlannerApp() {
  // One client per mounted app, so cached stories and trips never leak between renders.
  const [client] = useState(() => new QueryClient());
  return <QueryClientProvider client={client}><PlanningScreen /></QueryClientProvider>;
}

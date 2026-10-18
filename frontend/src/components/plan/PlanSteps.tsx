"use client";

import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Car, Crosshair, MapPin, Motorcycle, PersonSimpleWalk, Warning } from "@phosphor-icons/react";

import type { TripFormValues } from "@/schemas/trip";
import { usePrefs } from "@/lib/prefs";
import { nameLang } from "@/lib/lang";
import { formatMoney, sentence } from "@/lib/format";
import { START_COORDINATES } from "@/services/api";
import { isWithinHanoiServiceArea, parseManualLocation } from "@/services/locations";
import { Chip, Field, MoneyInput, Segmented, Stepper, describedBy } from "@/components/ui/Controls";
import { RunningNumber } from "@/components/ui/RunningNumber";
import { Notice } from "@/components/ui/States";
import { StreetPlate } from "@/components/ui/Signboard";

type Form = UseFormReturn<TripFormValues>;

export const INTERESTS = ["food", "history", "coffee", "local_culture", "museum", "park", "shopping",
  "festival", "hiking", "nature", "craft", "art"] as const;
const PRESETS: { key: keyof typeof START_COORDINATES; label: string }[] = [
  { key: "Hanoi Old Quarter", label: "Hanoi Old Quarter" },
  { key: "Hoan Kiem Lake", label: "Hoan Kiem Lake" },
  { key: "West Lake", label: "West Lake" },
  { key: "Temple of Literature", label: "Temple of Literature" },
];
const RADIUS_KM = { near: 5, balanced: 15, wide: 30, outskirts: 80 } as const;

function useErrorText(form: Form) {
  const { tr } = usePrefs();
  return (name: keyof TripFormValues) => {
    const message = form.formState.errors[name]?.message;
    return typeof message === "string" ? tr(message) : undefined;
  };
}

// ── Step 1: the trip ────────────────────────────────────────────────────
export function StepTrip({ form }: { form: Form }) {
  const { tr, language } = usePrefs();
  const error = useErrorText(form);
  const values = form.watch();
  const perPersonPerDay = values.budgetTotal > 0 && values.days > 0 && values.travelerCount > 0
    ? values.budgetTotal / values.days / values.travelerCount : 0;
  return <div className="space-y-8">
    <StreetPlate as="h2" size="lg">{tr("Your trip")}</StreetPlate>
    <div className="space-y-4">
      <Stepper id="days" label={tr("Days")} value={values.days} min={1} max={14}
        invalid={Boolean(error("days"))} describedById={error("days") ? "trip-size-error" : undefined}
        onChange={(value) => form.setValue("days", value, { shouldValidate: true })} />
      <Stepper id="travelerCount" label={tr("People")} value={values.travelerCount} min={1} max={20}
        invalid={Boolean(error("travelerCount"))} describedById={error("travelerCount") ? "trip-size-error" : undefined}
        onChange={(value) => form.setValue("travelerCount", value, { shouldValidate: true })} />
      {(error("days") || error("travelerCount")) && <p id="trip-size-error" role="alert" className="type-small text-sign-red-text">{error("days") ?? error("travelerCount")}</p>}
    </div>
    <Field htmlFor="budgetTotal" label={tr("Budget for the whole trip")} error={error("budgetTotal")}>
      <MoneyInput id="budgetTotal" language={language} value={values.budgetTotal}
        onChange={(value) => form.setValue("budgetTotal", value, { shouldValidate: form.formState.isSubmitted })}
        invalid={Boolean(error("budgetTotal"))} describedById={describedBy("budgetTotal", "x", error("budgetTotal"))} />
    </Field>
    {perPersonPerDay > 0 && <p id="budgetTotal-hint" className="-mt-6 type-small text-ink-muted">
      {tr("About")} <RunningNumber value={perPersonPerDay} format={(value) => formatMoney(Math.round(value / 1000) * 1000, language)} duration={0.3} /> {tr("per person per day")}
    </p>}
    <Field htmlFor="startDate" label={tr("Start date (optional)")} error={error("startDate")}
      hint={tr("With a start date, HanoiGO lists the holidays and events that fall on your trip.")}>
      <input id="startDate" type="date" {...form.register("startDate")} className="field tnum"
        aria-invalid={Boolean(error("startDate")) || undefined} aria-describedby={describedBy("startDate", "x", error("startDate"))} />
    </Field>
  </div>;
}

// ── Step 2: starting point ──────────────────────────────────────────────
export function StepStart({ form, locationError, onLocationError, onOpenMap }: {
  form: Form; locationError: string | null; onLocationError: (message: string | null) => void; onOpenMap: () => void;
}) {
  const { tr } = usePrefs();
  const error = useErrorText(form);
  const [locating, setLocating] = useState(false);
  const coordinates = form.watch("startLocationCoordinates");
  const name = form.watch("startLocationName");
  const message = locationError ?? error("startLocationName");

  function setPoint(label: string, point: { latitude: number; longitude: number }) {
    form.setValue("startLocationName", label, { shouldValidate: true });
    form.setValue("startLocationCoordinates", point, { shouldValidate: true });
    onLocationError(null);
  }
  function useDeviceLocation() {
    onLocationError(null);
    if (!window.isSecureContext || !navigator.geolocation) {
      onLocationError(tr("Device location is unavailable. Enter coordinates or a map link instead."));
      return;
    }
    // Location is asked for only on this tap, sent only with the trip request, never stored.
    setLocating(true);
    navigator.geolocation.getCurrentPosition((position) => {
      setLocating(false);
      const point = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      if (!isWithinHanoiServiceArea(point)) { onLocationError(tr("Your current location is outside the Hanoi service area.")); return; }
      setPoint(tr("Current location"), point);
    }, (failure) => {
      setLocating(false);
      onLocationError(tr(failure.code === 1 ? "Location permission was denied. Enter coordinates or a map link instead."
        : "Could not access device location. Enter coordinates or a map link instead."));
    }, { timeout: 8000, enableHighAccuracy: false });
  }
  return <div className="space-y-6">
    <StreetPlate as="h2" size="lg">{tr("Where do you start from?")}</StreetPlate>
    <Field htmlFor="startLocationName" label={tr("Starting point")} error={message ?? undefined}
      hint={tr("Hotel, address, coordinates or a Google Maps link. Addresses are looked up when you plan the trip.")}>
      <input id="startLocationName" type="text" autoComplete="street-address" className="field"
        {...form.register("startLocationName", {
          onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
            onLocationError(null);
            const parsed = parseManualLocation(event.target.value);
            // Coordinates and map links need no lookup; addresses are resolved on submit.
            form.setValue("startLocationCoordinates", parsed ?? undefined);
          },
          onBlur: (event: React.FocusEvent<HTMLInputElement>) => {
            const text = event.target.value.trim();
            const parsed = parseManualLocation(text);
            if (parsed) form.setValue("startLocationName", `${tr("Manual point")} ${parsed.latitude.toFixed(5)}, ${parsed.longitude.toFixed(5)}`, { shouldValidate: true });
            else if (/^https?:\/\//i.test(text) || /^-?\d{1,3}(\.\d+)?\s*,\s*-?\d{1,3}(\.\d+)?$/.test(text)) {
              onLocationError(tr("Enter Hanoi coordinates such as 21.034, 105.850 or a Google Maps link containing coordinates."));
            }
          },
        })}
        aria-invalid={Boolean(message) || undefined} aria-describedby={describedBy("startLocationName", "x", message ?? undefined)} />
    </Field>
    {coordinates && <p role="status" className="type-small -mt-3 text-moss">{tr("Point set")}: <span className="tnum">{coordinates.latitude.toFixed(5)}, {coordinates.longitude.toFixed(5)}</span></p>}
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={useDeviceLocation} disabled={locating}
        className="press inline-flex min-h-[44px] items-center gap-2 rounded-control border border-line-strong px-4 font-medium hover:bg-paper-sunken disabled:opacity-50">
        <Crosshair size={20} aria-hidden />{tr(locating ? "Finding device location..." : "Use my current location")}
      </button>
      <button type="button" onClick={onOpenMap}
        className="press inline-flex min-h-[44px] items-center gap-2 rounded-control border border-line-strong px-4 font-medium hover:bg-paper-sunken">
        <MapPin size={20} aria-hidden />{tr("Pick on map")}
      </button>
    </div>
    <fieldset>
      <legend className="mb-2 font-semibold">{tr("Ready-made starting points")}</legend>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => {
          const point = START_COORDINATES[preset.key];
          const label = tr(preset.label);
          return <Chip key={preset.key} selected={name === label && coordinates?.latitude === point.latitude}
            onToggle={() => setPoint(label, point)}>{label}</Chip>;
        })}
      </div>
    </fieldset>
  </div>;
}

// ── Step 3: getting around ──────────────────────────────────────────────
export function StepTravel({ form }: { form: Form }) {
  const { tr } = usePrefs();
  const error = useErrorText(form);
  const values = form.watch();
  const [more, setMore] = useState(false);
  const hoursOpen = more || Boolean(error("dailyStartTime") || error("dailyEndTime"));
  const walkingTooFar = values.travelMode === "walking" && RADIUS_KM[values.travelRadiusMode] > 10;
  return <div className="space-y-8">
    <StreetPlate as="h2" size="lg">{tr("How will you get around?")}</StreetPlate>
    <Segmented label={tr("Travel mode")} value={values.travelMode}
      onChange={(value) => form.setValue("travelMode", value)}
      options={[
        { value: "walking", label: <span className="flex items-center gap-2"><PersonSimpleWalk size={20} aria-hidden />{tr("Walking")}</span> },
        { value: "motorbike", label: <span className="flex items-center gap-2"><Motorcycle size={20} aria-hidden />{tr("Motorbike")}</span> },
        { value: "car", label: <span className="flex items-center gap-2"><Car size={20} aria-hidden />{tr("Car")}</span> },
      ]} />
    <div>
      <Segmented label={tr("How far will you go?")} size="lg" value={values.travelRadiusMode}
        onChange={(value) => form.setValue("travelRadiusMode", value)}
        options={(["near", "balanced", "wide"] as const).map((value) => ({
          value, label: `${RADIUS_KM[value]} km`,
          description: tr(value === "near" ? "Nearby" : value === "balanced" ? "Medium" : "Far"),
        }))} />
      <p className="type-small mt-2 text-ink-muted">{tr("Measured from your starting point")}</p>
      {walkingTooFar && <div className="mt-3"><Notice>
        {tr("Walking only searches within 10 km and covers at most 10 km a day. Choose motorbike or car to go further.")}
      </Notice></div>}
    </div>
    <div>
      <button type="button" aria-expanded={hoursOpen} onClick={() => setMore(!hoursOpen)}
        className="min-h-[44px] font-semibold text-sign-red-text underline-offset-4 hover:underline">
        {tr(hoursOpen ? "Fewer options" : "Daily hours and pace")}
      </button>
      {hoursOpen && <div className="mt-4 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field htmlFor="dailyStartTime" label={tr("Daily start")} error={error("dailyStartTime")}>
            <input id="dailyStartTime" type="time" {...form.register("dailyStartTime")} className="field tnum"
              aria-invalid={Boolean(error("dailyStartTime")) || undefined} aria-describedby={describedBy("dailyStartTime", undefined, error("dailyStartTime"))} />
          </Field>
          <Field htmlFor="dailyEndTime" label={tr("Daily end")} error={error("dailyEndTime")}>
            <input id="dailyEndTime" type="time" {...form.register("dailyEndTime")} className="field tnum"
              aria-invalid={Boolean(error("dailyEndTime")) || undefined} aria-describedby={describedBy("dailyEndTime", undefined, error("dailyEndTime"))} />
          </Field>
        </div>
        <Segmented label={tr("Pace")} value={values.pace} onChange={(value) => form.setValue("pace", value)}
          options={(["relaxed", "balanced", "active"] as const).map((value) => ({ value, label: tr(value) }))} />
      </div>}
    </div>
  </div>;
}

// ── Step 4: interests and summary ───────────────────────────────────────
export function StepInterests({ form, onEdit }: { form: Form; onEdit: (step: number) => void }) {
  const { tr, language } = usePrefs();
  const error = useErrorText(form);
  const values = form.watch();
  function toggle(interest: string) {
    const current = form.getValues("interests");
    form.setValue("interests", current.includes(interest) ? current.filter((item) => item !== interest) : [...current, interest],
      { shouldValidate: true });
  }
  const mode = tr(values.travelMode === "walking" ? "Walking" : values.travelMode === "motorbike" ? "Motorbike" : "Car");
  return <div className="space-y-8">
    <StreetPlate as="h2" size="lg">{tr("What do you enjoy?")}</StreetPlate>
    <fieldset id="interests-group" aria-describedby={error("interests") ? "interests-error" : undefined}>
      <legend className="sr-only">{tr("Interests")}</legend>
      <div className="flex flex-wrap gap-2">
        {INTERESTS.map((interest) => <Chip key={interest} selected={values.interests.includes(interest)} onToggle={() => toggle(interest)}>
          {sentence(tr(interest).replaceAll("_", " "))}</Chip>)}
      </div>
      {error("interests") && <p id="interests-error" role="alert" className="type-small mt-3 text-sign-red-text">
        <Warning size={20} className="mr-1 inline align-text-bottom" aria-hidden />{error("interests")}</p>}
    </fieldset>
    <section aria-labelledby="summary-title" className="border-t border-line pt-6">
      <h3 id="summary-title" className="type-h3">{tr("Summary")}</h3>
      <dl className="mt-3 divide-y divide-line">
        {[
          { label: tr("Trip"), value: `${values.days} ${tr(values.days === 1 ? "day" : "days")}, ${values.travelerCount} ${tr(values.travelerCount === 1 ? "person" : "people")}`, step: 1 },
          { label: tr("Budget"), value: formatMoney(values.budgetTotal || 0, language), step: 1 },
          { label: tr("Starting point"), value: <>{tr("From")} <span lang={nameLang(values.startLocationName, language)}>{values.startLocationName || "—"}</span>, {mode.toLocaleLowerCase(language)}, {RADIUS_KM[values.travelRadiusMode]} km</>, step: 2 },
        ].map((row) => <div key={row.label} className="flex items-center gap-3 py-2">
          <dt className="sr-only">{row.label}</dt>
          <dd className="flex flex-1 items-center gap-3">
            <span className="flex-1">{row.value}</span>
            <button type="button" onClick={() => onEdit(row.step)} className="min-h-[44px] px-2 font-semibold text-sign-red-text"
              aria-label={`${tr("Edit")}: ${row.label}`}>{tr("Edit")}</button>
          </dd>
        </div>)}
      </dl>
    </section>
  </div>;
}

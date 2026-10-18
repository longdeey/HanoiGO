"use client";

import { useId, useLayoutEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { Minus, Plus } from "@phosphor-icons/react";

import { formatAmount } from "@/lib/format";
import type { Language } from "@/i18n";

/** Label, control and error, wired with aria-describedby (spec §11). */
export function Field({ label, hint, error, children, htmlFor }: {
  label: string; hint?: string; error?: string; htmlFor: string; children: React.ReactNode;
}) {
  return <div>
    <label htmlFor={htmlFor} className="mb-2 block font-semibold">{label}</label>
    {children}
    {hint && !error && <p id={`${htmlFor}-hint`} className="type-small mt-2 text-ink-muted">{hint}</p>}
    {error && <m.p layout id={`${htmlFor}-error`} role="alert" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
      className="type-small mt-2 font-medium text-sign-red-text">{error}</m.p>}
  </div>;
}

export function describedBy(id: string, hint?: string, error?: string): string | undefined {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined;
}

/** Toggle chip; the tick draws itself when switched on (M05). */
export function Chip({ selected, onToggle, children, disabled }: {
  selected: boolean; onToggle: () => void; children: React.ReactNode; disabled?: boolean;
}) {
  const reduce = useReducedMotion();
  return <button type="button" aria-pressed={selected} onClick={onToggle} disabled={disabled}
    className={`press relative inline-flex min-h-[44px] items-center gap-2 overflow-hidden rounded-control border px-4 font-medium disabled:opacity-50 ${selected ? "border-sign-red text-sign-red-text" : "border-line-strong text-ink hover:bg-paper-sunken"}`}>
    <m.span aria-hidden className="absolute inset-0 origin-left bg-sign-red-soft" initial={false}
      animate={{ scaleX: selected ? 1 : 0 }} transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }} />
    <span className="relative inline-flex items-center gap-2">
      {selected && <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
        <m.path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }} />
      </svg>}
      {children}
    </span>
  </button>;
}

/** Single choice shown as buttons in a row (radio group semantics). */
export function Segmented<T extends string>({ label, value, options, onChange, size = "md", hideLabel = false }: {
  label: string; value: T; options: { value: T; label: React.ReactNode; description?: string }[];
  onChange: (value: T) => void; size?: "md" | "lg"; hideLabel?: boolean;
}) {
  const name = useId();
  return <fieldset>
    <legend className={hideLabel ? "sr-only" : "mb-2 font-semibold"}>{label}</legend>
    <div className={`flex flex-wrap gap-2 ${size === "lg" ? "flex-col sm:flex-row" : ""}`}>
      {options.map((option) => {
        const checked = option.value === value;
        // The radio itself is visually hidden, so its keyboard focus shows on the label.
        return <label key={option.value} className={`press relative flex cursor-pointer items-center gap-2 rounded-control border px-4 has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)] ${size === "lg" ? "min-h-[56px] flex-1" : "min-h-[44px]"} ${checked ? "border-2 border-sign-red bg-sign-red-soft text-sign-red-text" : "border-line-strong text-ink hover:bg-paper-sunken"}`}>
          <input type="radio" name={name} value={option.value} checked={checked} onChange={() => onChange(option.value)}
            className="sr-only" />
          <span className="flex flex-col">
            <span className="font-semibold">{option.label}</span>
            {option.description && <span className={`type-small ${checked ? "text-sign-red-text" : "text-ink-muted"}`}>{option.description}</span>}
          </span>
        </label>;
      })}
    </div>
  </fieldset>;
}

/** − value + with an editable number in the middle. */
export function Stepper({ id, label, value, min, max, onChange, unit, hideLabel = false, describedById, invalid }: {
  id: string; label: string; value: number; min: number; max: number; onChange: (value: number) => void;
  unit?: string; hideLabel?: boolean; describedById?: string; invalid?: boolean;
}) {
  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  return <div className="flex items-center justify-between gap-4">
    <label htmlFor={id} className={hideLabel ? "sr-only" : "font-semibold"}>{label}</label>
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => onChange(clamp(value - 1))} disabled={value <= min}
        aria-label={`${label}: −1`} className="press grid h-11 w-11 place-items-center rounded-control border border-line-strong disabled:opacity-40">
        <Minus size={20} aria-hidden />
      </button>
      <input id={id} type="number" inputMode="numeric" min={min} max={max} value={Number.isFinite(value) ? value : ""}
        onChange={(event) => { const next = Number(event.target.value); if (Number.isFinite(next)) onChange(next); }}
        onBlur={() => onChange(clamp(Number.isFinite(value) ? value : min))}
        aria-describedby={describedById} aria-invalid={invalid || undefined}
        className="tnum h-11 w-14 rounded-control bg-transparent text-center text-lg font-semibold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
      <button type="button" onClick={() => onChange(clamp(value + 1))} disabled={value >= max}
        aria-label={`${label}: +1`} className="press grid h-11 w-11 place-items-center rounded-control border border-line-strong disabled:opacity-40">
        <Plus size={20} aria-hidden />
      </button>
      {unit && <span className="ml-1 text-ink-muted">{unit}</span>}
    </div>
  </div>;
}

/** One digit past the schema's cap, so an overlong amount shows its error. */
const MONEY_MAX_DIGITS = 11;

/** VND amount typed as plain digits, shown grouped ("3.000.000"). */
export function MoneyInput({ id, value, onChange, language, invalid, describedById }: {
  id: string; value: number; onChange: (value: number) => void; language: Language;
  invalid?: boolean; describedById?: string;
}) {
  // Always grouped, focused or not: swapping the text on focus would drop a
  // select-all and append the new digits to the old amount.
  const display = Number.isFinite(value) && value > 0 ? formatAmount(value, language) : "";
  const input = useRef<HTMLInputElement>(null);
  const caretDigits = useRef<number | null>(null);
  // Keep the caret after the same digit once the separators move.
  useLayoutEffect(() => {
    const element = input.current;
    if (caretDigits.current === null || !element || document.activeElement !== element) return;
    let seen = 0;
    let position = 0;
    while (position < display.length && seen < caretDigits.current) {
      if (/\d/.test(display[position])) seen += 1;
      position += 1;
    }
    caretDigits.current = null;
    element.setSelectionRange(position, position);
  }, [display]);
  return <div className="relative">
    <input ref={input} id={id} inputMode="numeric" autoComplete="off" value={display}
      onChange={(event) => {
        const text = event.target.value;
        caretDigits.current = text.slice(0, event.target.selectionStart ?? text.length).replace(/\D/g, "").length;
        const digits = text.replace(/\D/g, "").slice(0, MONEY_MAX_DIGITS);
        onChange(digits ? Number(digits) : 0);
      }}
      aria-invalid={invalid || undefined} aria-describedby={describedById}
      className="field tnum pr-16 text-lg font-semibold" style={{ fontStretch: "112%" }} />
    <span className="pointer-events-none absolute inset-y-0 right-4 grid place-items-center text-ink-muted" aria-hidden>
      {language === "vi" ? "đ" : "VND"}
    </span>
  </div>;
}

/** 56 px radio row used in sheets (replace reasons, strategies). */
export function RadioRow({ name, value, checked, onChange, label, description }: {
  name: string; value: string; checked: boolean; onChange: (value: string) => void; label: string; description?: string;
}) {
  return <label className={`flex min-h-[56px] cursor-pointer items-center gap-3 rounded-control px-3 ${checked ? "bg-sign-red-soft" : "hover:bg-paper-sunken"}`}>
    <input type="radio" name={name} value={value} checked={checked} onChange={() => onChange(value)}
      className="h-5 w-5 shrink-0 accent-[var(--sign-red)]" />
    <span className="flex flex-col py-2">
      <span className="font-semibold">{label}</span>
      {description && <span className="type-small text-ink-muted">{description}</span>}
    </span>
  </label>;
}

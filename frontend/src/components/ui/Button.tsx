"use client";

import Link from "next/link";
import { CircleNotch } from "@phosphor-icons/react";

export type ButtonVariant = "primary" | "secondary" | "ink" | "text" | "danger" | "street" | "green" | "light";

const BASE = "press inline-flex items-center justify-center gap-2 rounded-control font-semibold disabled:cursor-not-allowed disabled:opacity-50";
const VARIANTS: Record<ButtonVariant, string> = {
  // The single red action of a view (spec §2.3, rule 1).
  primary: "min-h-[48px] px-6 bg-sign-red text-white hover:bg-sign-red-press active:bg-sign-red-press",
  secondary: "min-h-[44px] px-4 border border-line-strong bg-paper text-ink hover:bg-paper-sunken active:bg-paper-sunken",
  ink: "min-h-[44px] px-4 bg-ink text-paper active:bg-ink-muted",
  text: "min-h-[44px] px-2 text-sign-blue underline-offset-4 hover:underline active:bg-sign-blue-soft",
  // An action that cannot be undone (remove a trip, replace the share link).
  danger: "min-h-[44px] px-4 border border-sign-red-text bg-paper text-sign-red-text hover:bg-sign-red-soft active:bg-sign-red-soft",
  // The other two itinerary options keep their own colour (street blue, plate green).
  street: "min-h-[48px] px-6 bg-street-blue text-white hover:bg-street-blue-deep active:bg-street-blue-deep",
  green: "min-h-[48px] px-6 bg-plate-green text-white hover:brightness-95 active:brightness-90",
  // White with red letters, opposite a primary action (Back beside Continue).
  light: "min-h-[48px] px-6 border-2 border-hero-red bg-white text-hero-red hover:brightness-95 active:brightness-90",
};

export function buttonClass(variant: ButtonVariant = "secondary", extra = ""): string {
  return `${BASE} ${VARIANTS[variant]} ${extra}`.trim();
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  loading?: boolean;
  loadingLabel?: string;
  // React 19 passes ref as a prop; it reaches the <button> through ...rest.
  ref?: React.Ref<HTMLButtonElement>;
};

/** A loading button keeps its width: the label is hidden, a spinner shows. */
export function Button({ variant = "secondary", loading = false, loadingLabel, className = "", children, disabled, type = "button", ...rest }: ButtonProps) {
  return <button type={type} {...rest} disabled={disabled || loading} aria-busy={loading || undefined}
    className={buttonClass(variant, `relative ${className}`)}>
    <span className={`inline-flex items-center gap-2 ${loading ? "invisible" : ""}`}>{children}</span>
    {loading && <span className="absolute inset-0 grid place-items-center">
      <CircleNotch size={20} className="animate-spin motion-reduce:animate-none" aria-hidden />
      {loadingLabel && <span className="sr-only">{loadingLabel}</span>}
    </span>}
  </button>;
}

export function ButtonLink({ variant = "secondary", className = "", href, children, ...rest }:
  React.ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link href={href} {...rest} className={buttonClass(variant, className)}>{children}</Link>;
}

export function IconButton({ label, className = "", children, ...rest }:
  React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button type="button" aria-label={label} {...rest}
    className={`press grid h-11 w-11 shrink-0 place-items-center rounded-control text-ink hover:bg-paper-sunken disabled:opacity-50 ${className}`}>
    {children}
  </button>;
}

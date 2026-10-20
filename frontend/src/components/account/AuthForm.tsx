"use client";

import { useId, useState } from "react";
import { useMutation } from "@tanstack/react-query";

import type { AuthResponse } from "@/types/trip";
import { loginAccount, registerAccount } from "@/services/api";
import { usePrefs } from "@/lib/prefs";
import { Button } from "@/components/ui/Button";
import { Field, describedBy } from "@/components/ui/Controls";
import { apiErrorMessage } from "@/components/ui/States";

/** Sign in or register with an email address or a phone number (F24). */
export function AuthForm({ onDone }: { onDone?: (result: AuthResponse) => void }) {
  const { tr, signIn } = usePrefs();
  const id = useId();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [displayName, setDisplayName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const mutation = useMutation({
    mutationFn: () => mode === "login" ? loginAccount(identifier.trim(), password) : registerAccount(displayName.trim(), identifier.trim(), password),
    onSuccess: (result) => { signIn(result); onDone?.(result); },
  });
  const errors = {
    displayName: mode === "register" && displayName.trim().length < 2 ? tr("Enter a display name of at least 2 characters") : undefined,
    identifier: identifier.trim().length < 5 ? tr("Enter an email address or phone number") : undefined,
    password: password.length < 8 ? tr("Password must be at least 8 characters") : undefined,
  };
  const valid = !errors.displayName && !errors.identifier && !errors.password;
  function switchTo(next: "login" | "register") { setMode(next); mutation.reset(); setSubmitted(false); }
  const show = (key: keyof typeof errors) => (submitted ? errors[key] : undefined);
  return <form noValidate className="space-y-4" onSubmit={(event) => {
    event.preventDefault();
    setSubmitted(true);
    if (valid) mutation.mutate();
  }}>
    <div className="flex gap-1 rounded-control bg-paper-sunken p-1" role="tablist" aria-label={tr("Account")}>
      {(["login", "register"] as const).map((value) => <button key={value} type="button" role="tab" aria-selected={mode === value}
        id={`${id}-tab-${value}`} aria-controls={`${id}-panel`} tabIndex={mode === value ? 0 : -1}
        onKeyDown={(event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          const next = value === "login" ? "register" : "login";
          switchTo(next);
          document.getElementById(`${id}-tab-${next}`)?.focus();
        }}
        onClick={() => switchTo(value)}
        className={`press min-h-[44px] flex-1 rounded-control font-semibold ${mode === value ? "border border-line-strong bg-paper text-ink" : "text-ink-muted"}`}>
        {tr(value === "login" ? "Sign in" : "Register")}</button>)}
    </div>
    <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${mode}`} className="space-y-4">
    {mode === "register" && <Field htmlFor={`${id}-name`} label={tr("Display name")} hint={tr("Shown next to your reviews.")} error={show("displayName")}>
      <input id={`${id}-name`} value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="nickname" className="field"
        aria-invalid={Boolean(show("displayName")) || undefined} aria-describedby={describedBy(`${id}-name`, "x", show("displayName"))} />
    </Field>}
    <Field htmlFor={`${id}-identifier`} label={tr("Email or phone number")} error={show("identifier")}>
      <input id={`${id}-identifier`} value={identifier} onChange={(event) => setIdentifier(event.target.value)} autoComplete="username" className="field"
        aria-invalid={Boolean(show("identifier")) || undefined} aria-describedby={describedBy(`${id}-identifier`, undefined, show("identifier"))} />
    </Field>
    <Field htmlFor={`${id}-password`} label={tr("Password")} hint={tr("At least 8 characters.")} error={show("password")}>
      <input id={`${id}-password`} type="password" value={password} onChange={(event) => setPassword(event.target.value)}
        autoComplete={mode === "login" ? "current-password" : "new-password"} className="field"
        aria-invalid={Boolean(show("password")) || undefined} aria-describedby={describedBy(`${id}-password`, "x", show("password"))} />
    </Field>
    {mutation.isError && <p role="alert" className="type-small text-sign-red-text">{apiErrorMessage(mutation.error, tr)}</p>}
    <Button type="submit" variant="primary" className="w-full" loading={mutation.isPending}>{tr(mode === "login" ? "Sign in" : "Create account")}</Button>
    </div>
    <p className="type-small text-ink-muted">{tr("Your trips and reviews are saved to your account.")}</p>
  </form>;
}

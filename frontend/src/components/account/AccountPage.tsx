"use client";

import { useState } from "react";
import Link from "next/link";
import { CaretDown, UserCircle } from "@phosphor-icons/react";

import { usePrefs, type Theme } from "@/lib/prefs";
import type { Language } from "@/i18n";
import { usePageChrome } from "@/components/shell/chrome";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Controls";
import { useToast } from "@/components/ui/Toast";
import { AuthForm } from "./AuthForm";

const THEME_LABELS: Record<Theme, string> = { system: "Match device", light: "Light", dark: "Dark" };

export function AccountPage() {
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const { tr, auth, signOut, language, setLanguage, theme, setTheme } = usePrefs();
  const toast = useToast();
  usePageChrome({});
  return <div className="mx-auto max-w-xl px-4 pb-12 sm:px-6">
    <h1 className="type-h1 pt-4 lg:pt-8">{tr("Account")}</h1>
    <section className="mt-6" aria-labelledby="signin-title">
      {auth ? <div className="flex items-center gap-4 rounded-card border border-line p-4">
        <UserCircle size={40} className="shrink-0 text-ink-muted" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 id="signin-title" className="font-semibold">{auth.user.displayName}</h2>
          <p className="type-small text-ink-muted">{auth.user.email ?? auth.user.phone}</p>
        </div>
        <Button variant="secondary" onClick={() => { signOut(); toast.show(tr("Signed out on this browser.")); }}>{tr("Sign out")}</Button>
      </div> : <>
        <h2 id="signin-title" className="sr-only">{tr("Sign in")}</h2>
        <AuthForm onDone={() => toast.show(tr("Signed in."), { tone: "success" })} />
      </>}
    </section>
    <section className="mt-12 space-y-6 border-t border-line pt-6" aria-labelledby="settings-title">
      <h2 id="settings-title" className="type-h3">{tr("Settings")}</h2>
      <Segmented<Language> label={tr("Language")} value={language} onChange={setLanguage}
        options={[{ value: "vi", label: "Tiếng Việt" }, { value: "en", label: "English" }]} />
      <div>
        <button type="button" aria-expanded={appearanceOpen} aria-controls="appearance-setting" onClick={() => setAppearanceOpen(!appearanceOpen)}
          className="flex min-h-[44px] w-full items-center justify-between gap-3 text-left font-semibold">
          <span>{tr("Appearance")}: <span className="font-normal text-ink-muted">{tr(THEME_LABELS[theme])}</span></span>
          <CaretDown size={20} className={appearanceOpen ? "rotate-180" : ""} aria-hidden />
        </button>
        {appearanceOpen && <div id="appearance-setting" className="mt-2">
          <Segmented<Theme> label={tr("Appearance")} hideLabel value={theme} onChange={setTheme}
            options={[{ value: "system", label: tr("Match device") }, { value: "light", label: tr("Light") }, { value: "dark", label: tr("Dark") }]} />
        </div>}
      </div>
    </section>
    <nav className="mt-12 border-t border-line pt-4" aria-label={tr("More")}>
      <ul className="flex flex-wrap gap-x-6">
        <li><Link href="/credits" className="inline-flex min-h-[44px] items-center font-semibold text-sign-blue underline-offset-4 hover:underline">{tr("Photo and map data credits")}</Link></li>
        <li><Link href="/privacy" className="inline-flex min-h-[44px] items-center font-semibold text-sign-blue underline-offset-4 hover:underline">{tr("Privacy")}</Link></li>
      </ul>
    </nav>
  </div>;
}

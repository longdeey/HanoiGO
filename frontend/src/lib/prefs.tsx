"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { translate, type Language } from "@/i18n";
import { LANGUAGE_COOKIE, THEME_COOKIE, type Theme } from "@/lib/pref-cookies";
import { saveAuth, storedAuth } from "@/lib/storage";
import type { AuthResponse, AuthUser } from "@/types/trip";

export type { Theme };

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`;
}

type Prefs = {
  language: Language;
  setLanguage: (language: Language) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  tr: (text: string) => string;
  auth: { token: string; user: AuthUser } | null;
  signIn: (result: AuthResponse) => void;
  signOut: () => void;
};

const PrefsContext = createContext<Prefs | null>(null);

export function PrefsProvider({ initialLanguage, initialTheme, children }: {
  initialLanguage: Language; initialTheme: Theme; children: React.ReactNode;
}) {
  const [language, setLanguageState] = useState<Language>(initialLanguage);
  const [theme, setThemeState] = useState<Theme>(initialTheme);
  const [auth, setAuth] = useState<Prefs["auth"]>(null);
  useEffect(() => { setAuth(storedAuth()); }, []);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    setCookie(LANGUAGE_COOKIE, next);
    document.documentElement.lang = next;
  }, []);
  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    setCookie(THEME_COOKIE, next);
    if (next === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = next;
  }, []);
  const signIn = useCallback((result: AuthResponse) => {
    saveAuth(result.token, result.user);
    setAuth({ token: result.token, user: result.user });
  }, []);
  const signOut = useCallback(() => {
    // There is no sign-out endpoint: signing out clears this browser's session.
    saveAuth(null, null);
    setAuth(null);
  }, []);
  const tr = useCallback((text: string) => translate(language, text), [language]);
  const value = useMemo(() => ({ language, setLanguage, theme, setTheme, tr, auth, signIn, signOut }),
    [language, setLanguage, theme, setTheme, tr, auth, signIn, signOut]);
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): Prefs {
  const context = useContext(PrefsContext);
  if (!context) throw new Error("usePrefs must be used inside PrefsProvider");
  return context;
}

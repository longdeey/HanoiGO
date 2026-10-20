"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { translate, type Language } from "@/i18n";
import { LANGUAGE_COOKIE, THEME_COOKIE, type Theme } from "@/lib/pref-cookies";
import { useQueryClient } from "@tanstack/react-query";

import { claimTrips, logoutAccount } from "@/services/api";
import { deviceTrips, forgetAllTrips, saveAuth, storedAuth } from "@/lib/storage";
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
  /** False until this browser's saved session has been read (gates wait for it). */
  authReady: boolean;
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
  const [authReady, setAuthReady] = useState(false);
  const client = useQueryClient();
  useEffect(() => { setAuth(storedAuth()); setAuthReady(true); }, []);

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
    // Trips made on this device before signing in are saved to the account.
    const trips = deviceTrips();
    const refresh = () => void client.invalidateQueries({ queryKey: ["my-trips"] });
    if (trips.length > 0) void claimTrips(result.token, trips).then(refresh, refresh); else refresh();
  }, [client]);
  const signOut = useCallback(() => {
    // Trips belong to the account: none stays readable on this device once signed out.
    const token = auth?.token;
    saveAuth(null, null);
    setAuth(null);
    forgetAllTrips();
    client.removeQueries({ queryKey: ["my-trips"] });
    client.removeQueries({ queryKey: ["trip"] });
    if (token) void logoutAccount(token);
  }, [auth, client]);
  const tr = useCallback((text: string) => translate(language, text), [language]);
  const value = useMemo(() => ({ language, setLanguage, theme, setTheme, tr, auth, authReady, signIn, signOut }),
    [language, setLanguage, theme, setTheme, tr, auth, authReady, signIn, signOut]);
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): Prefs {
  const context = useContext(PrefsContext);
  if (!context) throw new Error("usePrefs must be used inside PrefsProvider");
  return context;
}

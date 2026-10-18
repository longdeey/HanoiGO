"use client";

import { useEffect, useRef, useState } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { LazyMotion, MotionConfig } from "motion/react";

import type { Language } from "@/i18n";
import { PrefsProvider, usePrefs, type Theme } from "@/lib/prefs";
import { ToastProvider, useToast } from "@/components/ui/Toast";

const loadMotionFeatures = () => import("@/lib/motion-features").then((module) => module.default);

export function Providers({ language, theme, children }: {
  language: Language; theme: Theme; children: React.ReactNode;
}) {
  // One client per mounted app, so cached data never leaks between renders.
  const [client] = useState(() => new QueryClient({
    defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
  }));
  return <QueryClientProvider client={client}>
    <LazyMotion features={loadMotionFeatures} strict>
      <MotionConfig reducedMotion="user">
        <PrefsProvider initialLanguage={language} initialTheme={theme}>
          <ToastProvider><ConnectionToasts />{children}</ToastProvider>
        </PrefsProvider>
      </MotionConfig>
    </LazyMotion>
  </QueryClientProvider>;
}

/**
 * Lost connection (spec §8.13): a toast with "Try again" that reloads the
 * data on screen. Fetch failures reach here as TypeError; API errors and
 * cancelled requests do not.
 */
function ConnectionToasts() {
  const client = useQueryClient();
  const toast = useToast();
  const { tr } = usePrefs();
  const last = useRef(0);
  useEffect(() => client.getQueryCache().subscribe((event) => {
    if (event.type !== "updated" || event.action.type !== "error" || !(event.action.error instanceof TypeError)) return;
    if (Date.now() - last.current < 10_000) return;
    last.current = Date.now();
    toast.show(tr("Cannot reach the server. Check your connection and try again."), {
      tone: "error", action: { label: tr("Try again"), onClick: () => void client.refetchQueries({ type: "active" }) },
    });
  }), [client, toast, tr]);
  return null;
}


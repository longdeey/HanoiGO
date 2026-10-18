"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useState } from "react";

/** What the current page wants from the shared bars. */
export type PageChrome = {
  /** Title shown next to the back button on child pages (phone). */
  title?: string;
  /** Shared-element id for the phone title (M12: the option name becomes it). */
  titleLayoutId?: string;
  /** Where the back button goes when the page was opened directly. */
  backHref?: string;
  /** Hide the bottom navigation (map picker, scrolling down in the reader). */
  hideBottomNav?: boolean;
};

type ChromeState = { chrome: PageChrome; setChrome: (chrome: PageChrome) => void };
const ChromeContext = createContext<ChromeState | null>(null);

export function ChromeProvider({ children }: { children: React.ReactNode }) {
  const [chrome, setChrome] = useState<PageChrome>({});
  return <ChromeContext.Provider value={{ chrome, setChrome }}>{children}</ChromeContext.Provider>;
}

export function useChromeState(): ChromeState {
  const context = useContext(ChromeContext);
  if (!context) throw new Error("useChromeState must be used inside ChromeProvider");
  return context;
}

// Before paint on the client, so the bars change in the same frame as the page.
const useBeforePaint = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Pages declare their title and back target; cleared when they unmount. */
export function usePageChrome({ title, backHref, hideBottomNav, titleLayoutId }: PageChrome): void {
  const { setChrome } = useChromeState();
  useBeforePaint(() => {
    setChrome({ title, backHref, hideBottomNav, titleLayoutId });
  }, [setChrome, title, backHref, hideBottomNav, titleLayoutId]);
  useEffect(() => () => setChrome({}), [setChrome]);
}

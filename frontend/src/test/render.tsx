import React from "react";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LazyMotion, MotionConfig, domMax } from "motion/react";

import type { Language } from "@/i18n";
import { PrefsProvider } from "@/lib/prefs";
import { ToastProvider } from "@/components/ui/Toast";
import { ChromeProvider } from "@/components/shell/chrome";
import type { ItineraryOption, Place, TripResponse } from "@/types/trip";

// Browser APIs jsdom does not implement.
if (typeof window !== "undefined") {
  window.scrollTo = (() => {}) as typeof window.scrollTo;
  Element.prototype.scrollIntoView = function scrollIntoView() {};
  Element.prototype.scrollTo = function scrollTo() {} as Element["scrollTo"];
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
    })) as typeof window.matchMedia;
  }
  if (!("IntersectionObserver" in window)) {
    (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = class {
      observe() {} unobserve() {} disconnect() {} takeRecords() { return []; }
    };
  }
  if (!("ResizeObserver" in window)) {
    (window as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {} unobserve() {} disconnect() {}
    };
  }
}

/** Render with every app provider (kept on rerender); motion runs reduced in tests. */
export function renderApp(ui: React.ReactElement, { language = "vi" as Language } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>
      <LazyMotion features={domMax} strict>
        <MotionConfig reducedMotion="always">
          <PrefsProvider initialLanguage={language} initialTheme="system">
            <ToastProvider><ChromeProvider>{children}</ChromeProvider></ToastProvider>
          </PrefsProvider>
        </MotionConfig>
      </LazyMotion>
    </QueryClientProvider>;
  }
  return { client, ...render(ui, { wrapper: Wrapper }) };
}

export function place(overrides: Partial<Place> = {}): Place {
  return {
    id: "place-1", slug: "temple-of-literature", name: "Văn Miếu", category: "history",
    latitude: 21.0293, longitude: 105.8355, averageCost: 0, entranceFee: 30_000, averageVisitMinutes: 90,
    indoor: false, outdoor: true, priceVerified: true, hoursVerified: true, priceSource: null, hoursSource: null,
    highlightLevel: "standard", availableFrom: null, availableUntil: null, informationSource: null, annual: false,
    ratingAverage: 0, ratingCount: 0, comments: [], bookingSource: null, story: null, ...overrides,
  };
}

export function option(type: ItineraryOption["type"], id: string, overrides: Partial<ItineraryOption> = {}): ItineraryOption {
  return {
    id, type, matchScore: 90, estimatedTotalCost: 2_850_000, estimatedTotalDistanceKm: 27.4,
    estimatedTotalTravelMinutes: 225, totalPlaces: 2,
    budget: { attractions: 600_000, food: 1_900_000, transport: 350_000, others: 0, total: 2_850_000, remaining: 150_000 },
    budgetTargetShare: type === "BUDGET_FRIENDLY" ? null : 0.95, budgetTargetMet: true,
    days: [{
      dayNumber: 1, date: "2026-10-18", theme: "", estimatedCost: 2_850_000, estimatedDistanceKm: 4.6, estimatedTravelMinutes: 22,
      items: [
        { id: `${id}-a`, sequence: 1, startTime: "08:12", endTime: "09:42", visitMinutes: 90, travelMinutes: 12, travelKm: 3.4,
          estimatedCost: 60_000, travelCost: 0, recommendationScore: 90, reasons: ["Matches your interests"], locked: false,
          place: place({ id: "place-1", highlightLevel: "must_see", story: { slug: "van-mieu-quoc-tu-giam", title: "Văn Miếu – Quốc Tử Giám", teaser: "Dựng năm 1070.", readingMinutes: 3 } }) },
        { id: `${id}-b`, sequence: 2, startTime: "09:52", endTime: "11:30", visitMinutes: 98, travelMinutes: 10, travelKm: 1.2,
          estimatedCost: 0, travelCost: 0, recommendationScore: 80, reasons: [], locked: false,
          place: place({ id: "place-2", slug: "one-pillar-pagoda", name: "Chùa Một Cột", averageVisitMinutes: 40, entranceFee: 0 }) },
      ],
    }],
    ...overrides,
  };
}

export function trip(overrides: Partial<TripResponse> = {}): TripResponse {
  return {
    tripId: "trip-1", language: "vi", travelMode: "walking", ownerToken: null,
    options: [option("BEST_MATCH", "best"), option("BUDGET_FRIENDLY", "budget", { estimatedTotalCost: 1_500_000 }), option("EXPLORE_MORE", "explore")],
    seasonalHighlights: [], holidays: [], stayOptions: [], startLatitude: 21.034, startLongitude: 105.85, ...overrides,
  };
}

"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// M02 is a navigation cue: entering content fades in and rises 12 px (plain
// CSS, see .page-enter in globals.css). The first document load paints at once,
// so server-rendered content is never hidden and LCP is not delayed; the
// template remounts on every later navigation, replaying the entrance.
let navigated = false;

export default function Template({ children }: { children: React.ReactNode }) {
  // The root template only remounts when the first URL segment changes, so the
  // wrapper is keyed by the path: /trips -> /trips/[id] -> its option also
  // enter. Query changes (plan steps, day, view) keep the page as it is.
  const pathname = usePathname();
  // Server and hydration render agree (false); only client navigations animate.
  const className = navigated ? "page-enter" : undefined;
  useEffect(() => { navigated = true; }, []);
  return <div key={pathname} className={className}>{children}</div>;
}

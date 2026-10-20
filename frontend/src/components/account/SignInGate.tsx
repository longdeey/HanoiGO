"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { usePrefs } from "@/lib/prefs";
import { Skeleton } from "@/components/ui/States";

/** Where to go after signing in: only a path on this site (never another site). */
export function safeNext(value: string | null): string | null {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : null;
}

/**
 * Shows its children to a signed-in user. Anyone else is sent to the Account
 * page to sign in or register, and comes back here afterwards.
 */
export function SignInGate({ children }: { children: React.ReactNode }) {
  const { auth, authReady } = usePrefs();
  const router = useRouter();
  const signedOut = authReady && !auth;
  useEffect(() => {
    if (!signedOut) return;
    const here = `${window.location.pathname}${window.location.search}`;
    router.replace(`/account?next=${encodeURIComponent(here)}`);
  }, [signedOut, router]);
  if (auth) return <>{children}</>;
  return <div className="mx-auto max-w-md px-4 pt-10" aria-busy="true"><Skeleton className="h-80" /></div>;
}

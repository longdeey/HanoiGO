"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as m from "motion/react-m";
import { BookOpenText, CalendarDots, CaretLeft, House, MapTrifold, Path, UserCircle } from "@phosphor-icons/react";

import { usePrefs } from "@/lib/prefs";
import { nameLang } from "@/lib/lang";
import { savedTripIds, tripIsToday, tripSummary } from "@/lib/storage";
import { todayInHanoi } from "@/lib/format";
import { spring } from "@/lib/motion";
import { ChromeProvider, useChromeState } from "./chrome";

type Destination = "home" | "stories" | "plan" | "festivals" | "trips";
const DESTINATIONS: { key: Destination; href: string; label: string; Icon: typeof House }[] = [
  { key: "home", href: "/", label: "Home", Icon: House },
  { key: "stories", href: "/stories", label: "Stories", Icon: BookOpenText },
  { key: "plan", href: "/plan", label: "Plan", Icon: Path },
  { key: "festivals", href: "/festivals", label: "Festivals", Icon: CalendarDots },
  { key: "trips", href: "/trips", label: "Trips", Icon: MapTrifold },
];
const ROOT_PATHS = new Set(["/", "/stories", "/festivals", "/trips", "/account", "/credits", "/privacy"]);

function activeDestination(pathname: string, from: string | null): Destination | null {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/stories")) return "stories";
  if (pathname.startsWith("/plan")) return "plan";
  if (pathname.startsWith("/festivals")) return "festivals";
  if (pathname.startsWith("/trips")) return "trips";
  if (pathname.startsWith("/places")) return (from as Destination | null) ?? null;
  return null;
}

// Set once the user has navigated inside the app, so "back" can use history.
let navigatedInApp = false;

export function AppShell({ children }: { children: React.ReactNode }) {
  return <ChromeProvider><Shell>{children}</Shell></ChromeProvider>;
}

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { tr } = usePrefs();
  const first = useRef(true);
  const [from, setFrom] = useState<string | null>(null);
  useEffect(() => {
    if (first.current) first.current = false; else navigatedInApp = true;
    setFrom(new URLSearchParams(window.location.search).get("from"));
  }, [pathname]);
  const planning = pathname.startsWith("/plan");
  const active = activeDestination(pathname, from);
  // M28: a language switch cross-fades the page text (CSS, off with reduced motion).
  const { language } = usePrefs();
  const main = useRef<HTMLElement>(null);
  const shownLanguage = useRef(language);
  useEffect(() => {
    if (shownLanguage.current === language) return;
    shownLanguage.current = language;
    const element = main.current;
    if (!element) return;
    element.classList.remove("lang-switch");
    void element.offsetWidth; // restart the animation on repeated switches
    element.classList.add("lang-switch");
  }, [language]);
  return <>
    <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-2 focus:z-[70] focus:rounded-control focus:bg-ink focus:px-4 focus:py-3 focus:text-paper">
      {tr("Skip to main content")}
    </a>
    {!planning && <TopBar pathname={pathname} active={active} />}
    <main ref={main} id="main" tabIndex={-1} onAnimationEnd={(event) => event.currentTarget.classList.remove("lang-switch")} className={planning ? "" : "pb-[calc(var(--bottomnav-h)+24px)] lg:pb-16"}>{children}</main>
    {!planning && <BottomNav active={active} />}
  </>;
}

function LanguageButton() {
  const { language, setLanguage } = usePrefs();
  const next = language === "vi" ? "en" : "vi";
  return <button type="button" onClick={() => setLanguage(next)}
    aria-label={language === "vi" ? "Đổi ngôn ngữ sang English" : "Switch language to Tiếng Việt"}
    className="press grid h-11 w-11 place-items-center rounded-control text-sm font-semibold text-white hover:bg-white/15">
    {language.toUpperCase()}
  </button>;
}

function AccountLink() {
  const { tr, auth } = usePrefs();
  return <Link href="/account" aria-label={auth ? `${tr("Account")}: ${auth.user.displayName}` : tr("Account")}
    className="press grid h-11 w-11 place-items-center rounded-full text-white hover:bg-white/15">
    <UserCircle size={24} aria-hidden />
  </Link>;
}

/** The HanoiGO logo on its own cream paper, a badge on the red bar; it names the home link. */
function Logo() {
  return <Image src="/images/logo-nav.png" alt="HanoiGO" width={800} height={248} priority sizes="160px"
    className="h-10 w-auto rounded-control shadow-float lg:h-12" />;
}

function TopBar({ pathname, active }: { pathname: string; active: Destination | null }) {
  const { tr, language } = usePrefs();
  const router = useRouter();
  const { chrome } = useChromeState();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const isRoot = ROOT_PATHS.has(pathname);
  const goBack = () => {
    if (navigatedInApp && window.history.length > 1) router.back();
    else router.push(chrome.backHref ?? "/");
  };
  // Red is the brand colour: the bar is always red; it lifts once the page scrolls.
  return <header className={`on-red sticky top-0 z-40 bg-hero-red text-white transition-shadow duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none ${scrolled ? "shadow-float" : ""}`}>
    <div className="mx-auto flex h-14 max-w-page items-center gap-2 px-4 sm:px-6 lg:h-16 lg:px-10">
      {isRoot ? <Link href="/" className="shrink-0 lg:mr-8"><Logo /></Link> :
        <>
          <button type="button" onClick={goBack} aria-label={tr("Back")}
            className="press -ml-2 grid h-11 w-11 place-items-center rounded-control text-white hover:bg-white/15 lg:hidden">
            <CaretLeft size={24} aria-hidden />
          </button>
          <m.span layoutId={chrome.titleLayoutId} transition={spring.sheet} lang={nameLang(chrome.title, language)} className="type-h3 truncate lg:hidden">{chrome.title ?? ""}</m.span>
          <Link href="/" className="hidden shrink-0 lg:mr-8 lg:block"><Logo /></Link>
        </>}
      <DesktopNav active={active} />
      <div className="ml-auto flex items-center gap-1">
        <Link href="/plan" className="press mr-2 hidden min-h-[44px] items-center rounded-control bg-white px-4 font-semibold text-hero-red hover:bg-white/90 lg:inline-flex">
          {tr("Plan my trip")}
        </Link>
        <LanguageButton />
        <AccountLink />
      </div>
    </div>
  </header>;
}

function DesktopNav({ active }: { active: Destination | null }) {
  const { tr } = usePrefs();
  return <nav aria-label={tr("Main navigation")} className="hidden h-full items-stretch gap-6 lg:flex">
    {DESTINATIONS.filter((item) => item.key !== "home" && item.key !== "plan").map((item) =>
      <Link key={item.key} href={item.href} aria-current={active === item.key ? "page" : undefined}
        className={`relative flex items-center text-white ${active === item.key ? "font-semibold" : "hover:underline hover:underline-offset-4"}`}>
        {tr(item.label)}
        {active === item.key && <m.span layoutId="desktop-tab-marker" transition={spring.snappy}
          className="absolute inset-x-0 bottom-0 h-1 rounded-t-sm bg-white" aria-hidden />}
      </Link>)}
  </nav>;
}

function BottomNav({ active }: { active: Destination | null }) {
  const { tr } = usePrefs();
  const { chrome } = useChromeState();
  const [tripToday, setTripToday] = useState(false);
  useEffect(() => {
    const today = todayInHanoi();
    setTripToday(savedTripIds().some((id) => {
      const summary = tripSummary(id);
      return summary ? tripIsToday(summary, today) : false;
    }));
  }, [active]);
  const hidden = Boolean(chrome.hideBottomNav);
  return <nav aria-label={tr("Main navigation")}
    className={`fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper pb-[env(safe-area-inset-bottom)] shadow-float transition-transform duration-300 lg:hidden ${hidden ? "translate-y-full" : "translate-y-0"}`}
    aria-hidden={hidden || undefined}>
    <ul className="mx-auto grid h-16 max-w-xl grid-cols-5">
      {DESTINATIONS.map(({ key, href, label, Icon }) => {
        const current = active === key;
        return <li key={key} className="relative">
          <Link href={href} aria-current={current ? "page" : undefined} tabIndex={hidden ? -1 : undefined}
            onClick={(event) => {
              // Tapping the open tab scrolls back to the top.
              if (current) { event.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }
            }}
            className={`flex h-full min-h-[56px] flex-col items-center justify-center gap-1 text-[12px] leading-4 ${current ? "font-semibold text-sign-red-text" : "font-medium text-ink-muted"}`}>
            {current && key !== "plan" && <m.span layoutId="bottom-tab-marker" transition={spring.snappy}
              className="absolute top-0 h-[3px] w-6 rounded-b-sm bg-sign-red" aria-hidden />}
            {key === "plan" ? <span className="grid h-9 w-12 place-items-center rounded-control bg-sign-red text-white">
              <Icon size={24} weight={current ? "fill" : "regular"} aria-hidden />
            </span> : <span className="relative">
              <Icon size={24} weight={current ? "fill" : "regular"} aria-hidden />
              {key === "trips" && tripToday && <span className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-sign-red" aria-hidden />}
            </span>}
            {/* One line in a fifth of a 360 px screen: Archivo narrows rather than wraps. */}
            <span className="whitespace-nowrap [font-stretch:85%]">{tr(label)}</span>
            {key === "trips" && tripToday && <span className="sr-only">{tr("A trip is happening today")}</span>}
          </Link>
        </li>;
      })}
    </ul>
  </nav>;
}

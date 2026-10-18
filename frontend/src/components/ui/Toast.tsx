"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { CheckCircle, Info, Warning, X } from "@phosphor-icons/react";

import { usePrefs } from "@/lib/prefs";

type Tone = "info" | "success" | "error";
type ToastItem = { id: number; message: string; tone: Tone; action?: { label: string; onClick: () => void } };
type ToastApi = { show: (message: string, options?: { tone?: Tone; action?: ToastItem["action"] }) => void };

const ToastContext = createContext<ToastApi | null>(null);
const TOAST_MS = 5000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const dismiss = useCallback((id: number) => setItems((current) => current.filter((item) => item.id !== id)), []);
  const show = useCallback<ToastApi["show"]>((message, options) => {
    const id = nextId.current++;
    setItems((current) => [...current.slice(-2), { id, message, tone: options?.tone ?? "info", action: options?.action }]);
  }, []);
  return <ToastContext.Provider value={{ show }}>
    {children}
    {/* One shared polite live region, last in <body> (spec §8.1). */}
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-4"
      style={{ bottom: "calc(var(--bottomnav-h) + 16px)" }}>
      <AnimatePresence initial={false}>
        {items.map((item) => <ToastCard key={item.id} item={item} onDismiss={() => dismiss(item.id)} />)}
      </AnimatePresence>
    </div>
  </ToastContext.Provider>;
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const { tr } = usePrefs();
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(onDismiss, TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [paused, onDismiss]);
  const Icon = item.tone === "success" ? CheckCircle : item.tone === "error" ? Warning : Info;
  const tone = item.tone === "success" ? "text-moss" : item.tone === "error" ? "text-sign-red-text" : "text-sign-blue";
  return <m.div layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8, transition: { duration: 0.2, ease: [0.3, 0, 0.8, 0.15] } }}
    transition={{ duration: 0.3, ease: [0.05, 0.7, 0.1, 1] }}
    onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
    onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
    className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-card border border-line bg-paper p-4 shadow-float">
    <Icon size={20} className={`mt-1 shrink-0 ${tone}`} aria-hidden />
    <p className="type-small flex-1 text-ink">{item.message}</p>
    {item.action && <button type="button" onClick={() => { item.action?.onClick(); onDismiss(); }}
      className="type-small min-h-[44px] -my-3 px-2 font-semibold text-sign-blue">{item.action.label}</button>}
    <button type="button" onClick={onDismiss} aria-label={tr("Close")} className="-m-3 grid h-11 w-11 shrink-0 place-items-center text-ink-muted">
      <X size={20} aria-hidden />
    </button>
  </m.div>;
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}

"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, useIsPresent, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { X } from "@phosphor-icons/react";

import { usePrefs } from "@/lib/prefs";
import { spring } from "@/lib/motion";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// One sheet can open as another leaves (stop → replace), so the page scroll
// lock is counted rather than saved and restored by each sheet.
let scrollLocks = 0;
let savedOverflow = "";
function lockScroll() {
  if (scrollLocks++ === 0) { savedOverflow = document.body.style.overflow; document.body.style.overflow = "hidden"; }
  return () => { if (--scrollLocks === 0) document.body.style.overflow = savedOverflow; };
}

/**
 * Modal sheet (phone: slides up from the bottom; desktop: centred panel).
 * Rendered in a portal so page transforms never break `position: fixed`.
 * Keeps focus inside, closes on Escape, backdrop tap or a downward drag.
 */
export function Sheet({ open, onClose, title, children, footer, size = "md" }: {
  open: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode;
  footer?: React.ReactNode; size?: "md" | "lg";
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(<AnimatePresence>
    {open && <SheetPanel key="sheet" onClose={onClose} title={title} footer={footer} size={size}>{children}</SheetPanel>}
  </AnimatePresence>, document.body);
}

function SheetPanel({ onClose, title, children, footer, size }: {
  onClose: () => void; title: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; size: "md" | "lg";
}) {
  const { tr } = usePrefs();
  const reduce = useReducedMotion();
  // False while the exit animation plays: the sheet is no longer the dialog.
  const present = useIsPresent();
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  const titleId = useRef(`sheet-${Math.random().toString(36).slice(2)}`).current;

  useEffect(() => {
    if (!present) return;
    opener.current = document.activeElement;
    const unlockScroll = lockScroll();
    const element = panel.current;
    const first = panel.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel.current)?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab" || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((item) => item.offsetParent !== null);
      if (items.length === 0) return;
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (event.shiftKey && document.activeElement === firstItem) { event.preventDefault(); lastItem.focus(); }
      else if (!event.shiftKey && document.activeElement === lastItem) { event.preventDefault(); firstItem.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      unlockScroll();
      // Runs as the exit starts. Hand focus back only if it is still ours,
      // never away from a sheet that has just opened.
      const active = document.activeElement;
      const ours = !active || active === document.body || element?.contains(active);
      if (ours && opener.current instanceof HTMLElement) opener.current.focus();
    };
  }, [onClose, present]);

  return <div inert={!present} aria-hidden={!present || undefined}
    className={`fixed inset-0 z-50 flex items-end justify-center lg:items-center lg:p-6 ${present ? "" : "pointer-events-none"}`}>
    <m.div className="absolute inset-0 bg-[rgb(28_30_38/0.45)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0 }} transition={{ duration: 0.15 }} onClick={onClose} aria-hidden />
    <m.div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
      initial={reduce ? { opacity: 0 } : { y: "100%" }} animate={reduce ? { opacity: 1 } : { y: 0 }}
      exit={reduce ? { opacity: 0 } : { y: "100%", transition: { duration: 0.2, ease: [0.3, 0, 0.8, 0.15] } }}
      transition={reduce ? { duration: 0.15 } : spring.sheet}
      drag={reduce ? false : "y"} dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }}
      onDragEnd={(_event, info) => { if (info.offset.y > 120 || info.velocity.y > 600) onClose(); }}
      className={`relative flex max-h-[92vh] w-full flex-col rounded-t-sheet bg-paper shadow-sheet outline-none lg:rounded-sheet ${size === "lg" ? "lg:max-w-2xl" : "lg:max-w-lg"}`}>
      <div className="flex justify-center pt-3 lg:hidden" aria-hidden><span className="h-1 w-10 rounded-full bg-line-strong" /></div>
      <div className="flex items-start gap-3 px-4 pb-2 pt-3 lg:pt-6">
        <h2 id={titleId} className="type-h3 flex-1">{title}</h2>
        <button type="button" onClick={onClose} aria-label={tr("Close")}
          className="press -mr-2 -mt-2 grid h-11 w-11 place-items-center rounded-control text-ink hover:bg-paper-sunken">
          <X size={24} aria-hidden />
        </button>
      </div>
      <div className="scroll-py-4 overflow-y-auto overscroll-contain px-4 pb-6" onPointerDownCapture={(event) => event.stopPropagation()}>{children}</div>
      {footer && <div className="border-t border-line px-4 py-4 pb-[calc(16px+env(safe-area-inset-bottom))]">{footer}</div>}
    </m.div>
  </div>;
}

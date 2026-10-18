"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { DotsThree } from "@phosphor-icons/react";

export type MenuItem = { label: string; onSelect: () => void; icon?: React.ReactNode };

/** The ⋯ menu: secondary actions that do not earn a button of their own. */
export function Menu({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onPointer = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); root.current?.querySelector<HTMLButtonElement>("button")?.focus(); }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const buttons = [...(list.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.key === "ArrowDown" ? (index + 1) % buttons.length : (index - 1 + buttons.length) % buttons.length;
        buttons[next]?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onPointer); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return <div ref={root} className="relative">
    <button type="button" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}
      className="press grid h-11 w-11 place-items-center rounded-control text-ink hover:bg-paper-sunken">
      <DotsThree size={24} aria-hidden />
    </button>
    <AnimatePresence>
      {open && <m.ul ref={list} role="menu" aria-label={label} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, transition: { duration: 0.1 } }} transition={{ duration: 0.15 }}
        className="absolute right-0 top-12 z-30 min-w-56 rounded-card border border-line bg-paper py-1 shadow-float">
        {items.map((item) => <li key={item.label} role="none">
          <button type="button" role="menuitem" onClick={() => { setOpen(false); item.onSelect(); }}
            className="flex min-h-[48px] w-full items-center gap-3 px-4 text-left hover:bg-paper-sunken focus:bg-paper-sunken focus-visible:-outline-offset-[3px]">
            {item.icon}{item.label}
          </button>
        </li>)}
      </m.ul>}
    </AnimatePresence>
  </div>;
}

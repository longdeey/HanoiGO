"use client";

import * as m from "motion/react-m";

import type { ItineraryOption } from "@/types/trip";
import { usePrefs } from "@/lib/prefs";
import { formatMoney } from "@/lib/format";
import { budgetShare, dayColor } from "@/lib/trip";

/**
 * Budget used as a bar plus a percentage in words (colour is never the only
 * signal): moss within budget, red over it. `grow` plays the M11 fill;
 * `showTarget` marks the option's budget target (F10); `showRemaining` adds
 * the money left (kept from the old option cards, F34).
 */
export function BudgetMeter({ option, grow = false, compact = false, showTarget = false, showRemaining = false }: {
  option: ItineraryOption; grow?: boolean; compact?: boolean; showTarget?: boolean; showRemaining?: boolean;
}) {
  const { tr, language } = usePrefs();
  const share = budgetShare(option);
  const percent = Math.round(share * 100);
  const target = showTarget && option.budgetTargetShare ? option.budgetTargetShare : null;
  const remaining = option.budget.remaining;
  return <div className={compact ? "" : "mt-2"}>
    <div className="flex items-center gap-3">
      <div className={`relative flex-1 ${compact ? "h-1.5" : "h-2"}`} aria-hidden>
        <div className="absolute inset-0 overflow-hidden rounded-full bg-paper-sunken">
          <m.div className={`absolute inset-y-0 left-0 w-full origin-left rounded-full ${share > 1 ? "bg-sign-red" : "bg-moss"}`}
            initial={grow ? { scaleX: 0 } : false} animate={{ scaleX: Math.min(1, share) }}
            transition={{ duration: 0.5, ease: [0.05, 0.7, 0.1, 1], delay: grow ? 0.16 : 0 }} />
        </div>
        {target && <span className="absolute -inset-y-1 w-0.5 rounded-full bg-ink" style={{ left: `${Math.min(100, target * 100)}%` }} />}
      </div>
      <span className="type-small tnum shrink-0 text-ink-muted">{percent}% {tr("of budget")}</span>
    </div>
    {target && <p className="sr-only">{tr("Target")}: {Math.round(target * 100)}% {tr("of budget")}{option.budgetTargetMet === false ? `, ${tr("not reached")}` : ""}</p>}
    {showRemaining && <p className={`type-small tnum mt-1 ${remaining >= 0 ? "text-moss" : "text-sign-red-text"}`}>{tr("Remaining")} {formatMoney(remaining, language)}</p>}
  </div>;
}

/** One dot per stop, one row per day, in the day's line colour. */
export function MiniRoute({ option, maxDays = 5 }: { option: ItineraryOption; maxDays?: number }) {
  const { tr } = usePrefs();
  const days = option.days.slice(0, maxDays);
  return <ul className="space-y-2" aria-label={tr("Stops per day")}>
    {days.map((day) => <li key={day.dayNumber} className="flex items-center gap-3">
      <svg width={Math.max(24, day.items.length * 16)} height="12" className="shrink-0" aria-hidden>
        <line x1="6" y1="6" x2={Math.max(6, (day.items.length - 1) * 16 + 6)} y2="6" stroke={dayColor(day.dayNumber)} strokeWidth="3" strokeLinecap="round" />
        {day.items.map((item, index) => <circle key={item.id} cx={index * 16 + 6} cy="6" r="4.5"
          fill={item.place.highlightLevel === "must_see" ? "var(--sign-red)" : "var(--paper)"} stroke={dayColor(day.dayNumber)} strokeWidth="2.5" />)}
      </svg>
      <span className="type-small text-ink-muted">{tr("Day")} {day.dayNumber}<span className="sr-only">: {day.items.length} {tr("places")}</span></span>
    </li>)}
    {option.days.length > maxDays && <li className="type-small text-ink-muted">+{option.days.length - maxDays} {tr("more days")}</li>}
  </ul>;
}

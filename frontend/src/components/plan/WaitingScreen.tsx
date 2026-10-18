"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";

import { usePrefs } from "@/lib/prefs";

// What the planner actually does; never a progress percentage.
const CAPTIONS = [
  "Matching opening hours with your days",
  "Fitting each day to your budget",
  "Putting nearby places next to each other",
  "Choosing meals along the way",
  "Comparing three ways to spend your days",
];

// White line drawings of Hanoi landmarks, each in a 56 × 64 box standing on y = 62.
const LANDMARKS: { name: { vi: string; en: string }; art: React.ReactNode }[] = [
  { name: { vi: "Tháp Rùa", en: "Turtle Tower" }, art: <>
    <path d="M8 62 Q28 55 48 62" />
    <rect x="15" y="41" width="26" height="17" />
    <path d="M24 58 V51 a4 4 0 0 1 8 0 V58 M17.5 50 v-4 a2.5 2.5 0 0 1 5 0 v4 M33.5 50 v-4 a2.5 2.5 0 0 1 5 0 v4" />
    <path d="M11 41 Q13 39 15 40 H41 Q43 39 45 41" />
    <rect x="18" y="30" width="20" height="11" />
    <path d="M25.5 38 v-3.5 a2.5 2.5 0 0 1 5 0 V38" />
    <path d="M14 30 Q16 28 18 29 H38 Q40 28 42 30" />
    <rect x="21" y="20" width="14" height="10" />
    <path d="M17 20 Q20 17 22 18 L25 14 H31 L34 18 Q36 17 39 20 Z M28 14 V9" className="fill-current" />
  </> },
  { name: { vi: "Chùa Một Cột", en: "One Pillar Pagoda" }, art: <>
    <path d="M4 62 H52 M10 58 q4 -2 8 0 t8 0 M32 58 q4 -2 8 0 t8 0" />
    <rect x="25" y="38" width="6" height="20" />
    <path d="M18 34 L25 40 M38 34 L31 40" />
    <rect x="16" y="25" width="24" height="9" />
    <path d="M22 25 V34 M28 25 V34 M34 25 V34" />
    <path d="M7 22 Q11 25 15 23 L21 14 H35 L41 23 Q45 25 49 22 L45 25 H11 Z M28 14 V8" className="fill-current" />
  </> },
  { name: { vi: "Văn Miếu", en: "Temple of Literature" }, art: <>
    <path d="M6 62 H50" />
    <path d="M10 62 V45 H16 V62 M20 62 V45 H26 V62 M30 62 V45 H36 V62 M40 62 V45 H46 V62" />
    <path d="M5 45 Q8 42 11 43 H45 Q48 42 51 45" />
    <rect x="16" y="28" width="24" height="15" />
    <circle cx="28" cy="35.5" r="4.5" />
    <path d="M28 31 V40 M23.5 35.5 H32.5 M24.8 32.3 L31.2 38.7 M31.2 32.3 L24.8 38.7" />
    <path d="M9 27 Q12 29 16 27 L21 19 H35 L40 27 Q44 29 47 27 L44 29 H12 Z M28 19 V13" className="fill-current" />
  </> },
  { name: { vi: "Cột Cờ", en: "Flag Tower" }, art: <>
    <rect x="7" y="55" width="42" height="7" />
    <rect x="13" y="48" width="30" height="7" />
    <rect x="19" y="41" width="18" height="7" />
    <path d="M23.5 41 L24.5 19 H31.5 L32.5 41 Z" />
    <path d="M26 28 h4 M26 34 h4" />
    <rect x="22" y="15" width="12" height="4" />
    <path d="M28 15 V3" />
    <path d="M28 3 H39 L36 6.5 L39 10 H28 Z" className="fill-current" />
  </> },
  { name: { vi: "Cầu Long Biên", en: "Long Bien Bridge" }, art: <>
    <path d="M2 48 H54" />
    <path d="M2 48 Q15 28 28 48 Q41 28 54 48" />
    <path d="M8.5 48 L12 37.5 L15 48 L18 37.5 L21.5 48 M34.5 48 L38 37.5 L41 48 L44 37.5 L47.5 48" />
    <path d="M26 48 V62 H30 V48 M2 48 V62 M54 48 V62" />
    <path d="M6 58 q4 -2 8 0 t8 0 M34 58 q4 -2 8 0 t8 0" />
  </> },
];
const SLOT = 72;
const ROAD_Y = 100;
const xOf = (index: number) => 36 + index * SLOT;

/**
 * M10, in red and white: a road runs through Hanoi landmarks while the trip is
 * planned; each one lights up in turn with its name, in step with the caption
 * underneath. With reduced motion the landmark does not lift.
 */
export function WaitingScreen({ onCancel }: { onCancel: () => void }) {
  const { tr, language } = usePrefs();
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % CAPTIONS.length), 1600);
    return () => window.clearInterval(timer);
  }, []);
  const spring = { type: "spring", stiffness: 260, damping: 24 } as const;
  const name = LANDMARKS[index].name[language];
  return <div role="status" className="on-red flex min-h-screen flex-col items-center justify-center bg-hero-red px-6 text-center text-white">
    <svg className="w-[360px] max-w-full sm:w-[520px]" viewBox="0 0 360 132" aria-hidden>
      {/* the road: dashed ahead, solid where the planner has been */}
      <line x1={xOf(0)} y1={ROAD_Y} x2={xOf(4)} y2={ROAD_Y} stroke="rgb(255 255 255 / 0.45)" strokeWidth="3" strokeDasharray="2 7" strokeLinecap="round" />
      <m.line x1={xOf(0)} y1={ROAD_Y} y2={ROAD_Y} stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round"
        initial={false} animate={{ x2: xOf(index) }} transition={reduce ? { duration: 0 } : { duration: 0.5, ease: [0.2, 0, 0, 1] }} />
      {LANDMARKS.map((landmark, station) => {
        const active = station === index;
        const visited = station < index;
        return <g key={landmark.name.en}>
          <m.g initial={false} animate={{ opacity: active ? 1 : visited ? 0.8 : 0.45, y: active && !reduce ? -6 : 0 }} transition={spring}>
            <g transform={`translate(${xOf(station) - 28} 30)`} fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" color="#FFFFFF">
              {landmark.art}
            </g>
          </m.g>
          <circle cx={xOf(station)} cy={ROAD_Y} r={active ? 7 : 5} fill={active || visited ? "#FFFFFF" : "var(--hero-red)"} stroke="#FFFFFF" strokeWidth="3" />
        </g>;
      })}
      {/* the lit landmark's name on a white tag under the road */}
      <m.g initial={false} animate={{ x: xOf(index) }} transition={reduce ? { duration: 0 } : { duration: 0.5, ease: [0.2, 0, 0, 1] }}>
        <rect x={-36} y={ROAD_Y + 13} width={72} height={18} rx={4} fill="#FFFFFF" />
        <text x={0} y={ROAD_Y + 25.5} textAnchor="middle" fontSize={name.length > 13 ? 8.5 : 10} fontWeight={700} fill="var(--hero-red)"
          style={{ fontFamily: "var(--font-archivo), Arial, sans-serif" }}>{name}</text>
      </m.g>
    </svg>
    <h1 className="type-h2 mt-8">{tr("Planning your trip")}</h1>
    <div className="mt-2 h-14 max-w-xs">
      <AnimatePresence mode="wait">
        <m.p key={index} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={reduce ? undefined : { opacity: 0 }} transition={{ duration: 0.15 }}>
          {tr(CAPTIONS[index])}</m.p>
      </AnimatePresence>
    </div>
    <button type="button" onClick={onCancel}
      className="press mt-6 inline-flex min-h-[48px] items-center rounded-control bg-white px-6 font-semibold text-hero-red hover:bg-white/90">
      {tr("Cancel")}</button>
  </div>;
}

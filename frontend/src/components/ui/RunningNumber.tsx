"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "motion/react";

/**
 * A number that runs to its new value (M07, M11, M17). The animated digits are
 * hidden from screen readers; the final value is announced once.
 */
export function RunningNumber({ value, format, duration = 0.5, className = "", announce = false, from }: {
  value: number; format: (value: number) => string; duration?: number; className?: string; announce?: boolean;
  /** Start here on first show instead of at the value (M11: costs run up from 0). */
  from?: number;
}) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(from ?? value);
  const previous = useRef(from ?? value);
  useEffect(() => {
    if (reduce || previous.current === value) {
      setShown(value);
      previous.current = value;
      return;
    }
    const controls = animate(previous.current, value, {
      duration, ease: [0, 0, 0, 1], onUpdate: (latest) => setShown(latest),
    });
    previous.current = value;
    return () => controls.stop();
  }, [value, reduce, duration]);
  return <span className={`tnum ${className}`}>
    <span aria-hidden>{format(shown)}</span>
    <span className="sr-only" aria-live={announce ? "polite" : undefined}>{format(value)}</span>
  </span>;
}

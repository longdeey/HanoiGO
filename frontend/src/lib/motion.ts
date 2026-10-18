// Motion tokens (spec §7.2). Durations mirror the CSS variables in globals.css.
export const duration = {
  fade: 0.15, tap: 0.1, small: 0.2, medium: 0.3, large: 0.5, route: 0.8, moment: 1,
} as const;

export const ease = {
  standard: [0.2, 0, 0, 1],
  enter: [0.05, 0.7, 0.1, 1],
  exit: [0.3, 0, 0.8, 0.15],
  settle: [0, 0, 0, 1],
} as const;

// Starting values; tune on real devices.
export const spring = {
  snappy: { type: "spring", stiffness: 500, damping: 40 }, // tab marker, chips
  sheet: { type: "spring", stiffness: 400, damping: 38 }, // sheets, expanding cards
  gentle: { type: "spring", stiffness: 260, damping: 30 }, // reordering stops
} as const;

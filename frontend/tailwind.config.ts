import type { Config } from "tailwindcss";

// "Biển hiệu phố" tokens. Every colour is a CSS variable defined in
// globals.css (light and dark), named exactly as in the redesign spec §6.9.
const token = (name: string) => `var(--${name})`;
const colorTokens = [
  "paper", "paper-sunken", "ink", "ink-muted", "line", "line-strong",
  "sign-red", "sign-red-press", "sign-red-soft", "sign-red-text",
  "sign-blue", "sign-blue-soft", "wall-yellow", "wall-yellow-soft", "warn-ink",
  "moss", "moss-soft", "day-1", "day-2", "day-3", "day-4", "day-5",
  "cat-attraction", "cat-food", "cat-transport", "cat-other",
  "hero-red", "hero-red-deep", "street-blue", "street-blue-deep", "newsprint", "clipping", "plate-green", "plate-ink",
] as const;

export default {
  content: ["./src/**/*.{ts,tsx}"],
  // §9: hover states only on devices that can hover, so they never stick after a tap.
  future: { hoverOnlyWhenSupported: true },
  theme: {
    extend: {
      colors: Object.fromEntries(colorTokens.map((name) => [name, token(name)])),
      fontFamily: {
        sign: ["var(--font-phudu)", "Arial Narrow", "sans-serif"],
        sans: ["var(--font-archivo)", "Arial", "sans-serif"],
      },
      borderRadius: {
        tag: "2px", sign: "4px", control: "8px", card: "12px", sheet: "20px",
      },
      boxShadow: {
        float: "0 2px 8px rgb(28 30 38 / 0.16)",
        sheet: "0 -8px 24px rgb(28 30 38 / 0.18)",
      },
      screens: { wide: "1440px" },
      maxWidth: { page: "1280px", read: "68ch" },
    },
  },
  plugins: [],
} satisfies Config;

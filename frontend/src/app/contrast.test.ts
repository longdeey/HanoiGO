import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Spec §14: a test reads the tokens and checks every pair listed in §6.1.
const css = readFileSync(join(__dirname, "globals.css"), "utf8");

function tokens(block: string): Record<string, string> {
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9A-Fa-f]{6})/g)].map((match) => [match[1], match[2]]));
}
const light = tokens(css.slice(css.indexOf(":root {"), css.indexOf("@media (prefers-color-scheme: dark)")));
const darkBlock = css.slice(css.indexOf(':root[data-theme="dark"] {'));
const dark = { ...light, ...tokens(darkBlock.slice(0, darkBlock.indexOf("}"))) };

function luminance(hex: string): number {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}
function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

describe("colour contrast (WCAG 2.2 AA)", () => {
  const text = 4.5;
  const large = 3;
  it.each([
    ["ink on paper", "ink", "paper", text],
    ["muted ink on paper", "ink-muted", "paper", text],
    ["ink on sunken paper", "ink", "paper-sunken", text],
    ["control border on paper", "line-strong", "paper", large],
    ["red text on paper", "sign-red-text", "paper", text],
    ["red text on soft red", "sign-red-text", "sign-red-soft", text],
    ["blue on paper", "sign-blue", "paper", text],
    ["blue on soft blue", "sign-blue", "sign-blue-soft", text],
    ["warning ink on soft yellow", "warn-ink", "wall-yellow-soft", text],
    ["moss on paper", "moss", "paper", text],
    ["moss on soft moss", "moss", "moss-soft", text],
    ["day 1 line on paper", "day-1", "paper", large],
    ["day 2 line on paper", "day-2", "paper", large],
    ["day 3 line on paper", "day-3", "paper", large],
    ["day 4 line on paper", "day-4", "paper", large],
    ["day 5 line on paper", "day-5", "paper", large],
  ])("%s, light and dark", (_name, foreground, background, minimum) => {
    expect(contrast(light[foreground as string], light[background as string])).toBeGreaterThanOrEqual(minimum as number);
    expect(contrast(dark[foreground as string], dark[background as string])).toBeGreaterThanOrEqual(minimum as number);
  });

  it("keeps white text on the red button readable in both themes", () => {
    expect(contrast("#FFFFFF", light["sign-red"])).toBeGreaterThanOrEqual(text);
    expect(contrast("#FFFFFF", dark["sign-red"])).toBeGreaterThanOrEqual(text);
    expect(contrast("#1C1E26", light["wall-yellow"])).toBeGreaterThanOrEqual(text);
  });

  it("keeps white text on the pressed red button readable", () => {
    expect(contrast("#FFFFFF", light["sign-red-press"])).toBeGreaterThanOrEqual(text);
    expect(contrast("#FFFFFF", dark["sign-red-press"])).toBeGreaterThanOrEqual(text);
  });

  it("keeps day lines visible on the grey map and the transport colour on paper", () => {
    for (const day of ["day-1", "day-2", "day-3", "day-4", "day-5"]) {
      expect(contrast(light[day], "#E6E6E3")).toBeGreaterThanOrEqual(large);
    }
    expect(contrast(light["cat-transport"], light.paper)).toBeGreaterThanOrEqual(large);
    expect(contrast(dark["cat-transport"], dark.paper)).toBeGreaterThanOrEqual(large);
  });

  it("documents why red text and muted text are not used on yellow (spec §6.1)", () => {
    expect(contrast(light["sign-red-text"], light["wall-yellow"])).toBeLessThan(text);
    expect(contrast(light["ink-muted"], light["wall-yellow"])).toBeLessThan(text);
  });

  it("keeps white letters readable on the red bar and the street-name signs", () => {
    for (const theme of [light, dark]) {
      expect(contrast("#FFFFFF", theme["hero-red"])).toBeGreaterThanOrEqual(text);
      expect(contrast("#FFFFFF", theme["street-blue"])).toBeGreaterThanOrEqual(text);
    }
    expect(contrast(light["clipping-ink"], light.clipping)).toBeGreaterThanOrEqual(text);
  });

  it("keeps the Trips group labels readable in both themes", () => {
    for (const theme of [light, dark]) {
      expect(contrast("#FFFFFF", theme["plate-green"])).toBeGreaterThanOrEqual(text);
      expect(contrast(theme["plate-ink"], theme["wall-yellow"])).toBeGreaterThanOrEqual(text);
      expect(contrast(theme.moss, theme.paper)).toBeGreaterThanOrEqual(large);
    }
  });

  it("forbids yellow text on white (spec §6.1)", () => {
    expect(contrast(light["wall-yellow"], light.paper)).toBeLessThan(large);
  });
});

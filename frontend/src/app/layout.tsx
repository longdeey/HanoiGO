import type { Metadata, Viewport } from "next";
import { Archivo, Phudu } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";

import { Providers } from "./providers";
import { AppShell } from "@/components/shell/AppShell";
import { SIGN_PAINT_SCRIPT } from "@/components/ui/Signboard";
import { LANGUAGE_COOKIE, THEME_COOKIE, type Theme } from "@/lib/pref-cookies";
import type { Language } from "@/i18n";

// Phudu: inspired by Vietnam's old hand-painted signs; display sizes only.
const phudu = Phudu({ subsets: ["latin", "vietnamese"], weight: ["700", "800"], variable: "--font-phudu", display: "swap" });
// Archivo: the whole interface; the width axis gives wide money and narrow times.
const archivo = Archivo({ subsets: ["latin", "vietnamese"], axes: ["wdth"], variable: "--font-archivo", display: "swap" });

export const metadata: Metadata = {
  title: { default: "HanoiGO", template: "%s – HanoiGO" },
  description: "Plan your Hanoi trip around your days, budget and interests.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const store = await cookies();
  const language: Language = store.get(LANGUAGE_COOKIE)?.value === "en" ? "en" : "vi";
  const themeValue = store.get(THEME_COOKIE)?.value;
  const theme: Theme = themeValue === "light" || themeValue === "dark" ? themeValue : "system";
  return <html lang={language} data-theme={theme === "system" ? undefined : theme} className={`${phudu.variable} ${archivo.variable}`} suppressHydrationWarning>
    <head><script dangerouslySetInnerHTML={{ __html: SIGN_PAINT_SCRIPT }} /></head>
    <body>
      <Providers language={language} theme={theme}>
        <AppShell>{children}</AppShell>
      </Providers>
    </body>
  </html>;
}

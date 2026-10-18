// Plain module (no "use client"): the root layout reads these on the server.
// Constants exported from a client module reach server code as client
// references, not strings, so cookies().get() would never match.
export type Theme = "system" | "light" | "dark";
export const LANGUAGE_COOKIE = "hanoigo-language";
export const THEME_COOKIE = "hanoigo-theme";

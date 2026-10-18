import type { NextConfig } from "next";

// Old single-page URLs (spec §4.7). Query values pass through to the
// destination, so share tokens keep their parameter name (`share`).
const query = (key: string) => ({ type: "query" as const, key, value: `(?<${key}>.+)` });

const nextConfig: NextConfig = {
  // The dev badge sits bottom-left, on top of the first bottom-nav item.
  devIndicators: false,
  async redirects() {
    return [
      { source: "/", has: [query("trip"), query("option")], destination: "/trips/:trip/:option", permanent: true },
      { source: "/", has: [query("trip")], destination: "/trips/:trip", permanent: true },
      { source: "/", has: [query("story")], destination: "/stories/:story", permanent: true },
    ];
  },
};
export default nextConfig;

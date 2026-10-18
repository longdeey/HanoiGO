// OpenStreetMap France's humanitarian tiles are reachable in the demo
// environment where the default openstreetmap.org tile host is blocked.
// A deployment can point this one tile adapter at its licensed map provider.
export const mapTileUrl = process.env.NEXT_PUBLIC_MAP_TILE_URL ??
  "https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png";

/** Tile host to preconnect to while the map code loads; null if the URL is unusual. */
export const mapTileOrigin = (() => {
  try { return new URL(mapTileUrl.replace("{s}", "a")).origin; } catch { return null; }
})();

export const mapAttribution = process.env.NEXT_PUBLIC_MAP_ATTRIBUTION ??
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, tiles <a href="https://www.openstreetmap.fr/">OSM France</a>';

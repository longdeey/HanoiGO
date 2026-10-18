export type Coordinates = { latitude: number; longitude: number };

// Matches the MVP backend's broad Hanoi service area. Typed addresses are
// checked more strictly by the geocoding provider when it is available.
const HANOI_SERVICE_BOUNDS = {
  south: 20.45, north: 21.55, west: 105.18, east: 106.25,
} as const;

export function isWithinHanoiServiceArea({ latitude, longitude }: Coordinates): boolean {
  return Number.isFinite(latitude) && Number.isFinite(longitude) &&
    latitude >= HANOI_SERVICE_BOUNDS.south && latitude <= HANOI_SERVICE_BOUNDS.north &&
    longitude >= HANOI_SERVICE_BOUNDS.west && longitude <= HANOI_SERVICE_BOUNDS.east;
}

export function mapPinName({ latitude, longitude }: Coordinates): string {
  return `Map pin ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

export function manualPinName({ latitude, longitude }: Coordinates): string {
  return `Manual point ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

const COORDINATE_PAIR = /^\s*([+-]?\d{1,2}(?:\.\d+)?)\s*[,;]\s*([+-]?\d{1,3}(?:\.\d+)?)\s*$/;
const MAP_AT_COORDINATES = /@([+-]?\d{1,2}(?:\.\d+)?),([+-]?\d{1,3}(?:\.\d+)?)(?:[,/]|$)/;
const MAP_DATA_COORDINATES = /!3d([+-]?\d{1,2}(?:\.\d+)?)!4d([+-]?\d{1,3}(?:\.\d+)?)/;

function coordinatesFromPair(value: string): Coordinates | null {
  const match = COORDINATE_PAIR.exec(value);
  if (!match) return null;
  const coordinates = { latitude: Number(match[1]), longitude: Number(match[2]) };
  return isWithinHanoiServiceArea(coordinates) ? coordinates : null;
}

export function parseManualLocation(value: string): Coordinates | null {
  const direct = coordinatesFromPair(value);
  if (direct) return direct;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (!/^https?:$/.test(url.protocol)) return null;
  for (const key of ["q", "query", "ll"]) {
    const parameter = url.searchParams.get(key);
    if (parameter) {
      const fromParameter = coordinatesFromPair(parameter);
      if (fromParameter) return fromParameter;
    }
  }
  const embedded = MAP_AT_COORDINATES.exec(url.href) ?? MAP_DATA_COORDINATES.exec(url.href);
  if (!embedded) return null;
  const coordinates = { latitude: Number(embedded[1]), longitude: Number(embedded[2]) };
  return isWithinHanoiServiceArea(coordinates) ? coordinates : null;
}

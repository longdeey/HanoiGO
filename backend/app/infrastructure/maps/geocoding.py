"""User-submitted Hanoi address lookup with bounded Nominatim usage."""

from collections import OrderedDict
from dataclasses import dataclass
from threading import Lock
from time import monotonic, sleep
from typing import Protocol

import httpx

from app.domain.planner.config import HANOI_LAT_MAX, HANOI_LAT_MIN, HANOI_LON_MAX, HANOI_LON_MIN


@dataclass(frozen=True)
class ResolvedLocation:
    name: str
    latitude: float
    longitude: float


class GeocodingUnavailable(Exception):
    pass


class LocationNotFound(Exception):
    pass


class GeocodingProvider(Protocol):
    def resolve(self, query: str) -> ResolvedLocation | None: ...


class NominatimGeocoder:
    TIMEOUT_SECONDS = 3.5
    CACHE_SIZE = 256

    def __init__(
        self, base_url: str, user_agent: str, transport: httpx.BaseTransport | None = None,
        *, request_interval_seconds: float = 1.1,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.user_agent = user_agent
        self.transport = transport
        self.request_interval_seconds = request_interval_seconds
        self._cache: OrderedDict[str, ResolvedLocation | None] = OrderedDict()
        self._lock = Lock()
        self._last_request = 0.0

    def resolve(self, query: str) -> ResolvedLocation | None:
        key = " ".join(query.strip().casefold().split())
        with self._lock:
            if key in self._cache:
                self._cache.move_to_end(key)
                return self._cache[key]
            wait_seconds = self.request_interval_seconds - (monotonic() - self._last_request)
            if wait_seconds > 0:
                sleep(wait_seconds)
            self._last_request = monotonic()
            try:
                with httpx.Client(timeout=self.TIMEOUT_SECONDS, transport=self.transport) as client:
                    response = client.get(
                        f"{self.base_url}/search",
                        params={"q": query.strip(), "format": "jsonv2", "countrycodes": "vn",
                                "addressdetails": 1,
                                "viewbox": f"{HANOI_LON_MIN},{HANOI_LAT_MAX},{HANOI_LON_MAX},{HANOI_LAT_MIN}",
                                "bounded": 1, "limit": 1},
                        headers={"User-Agent": self.user_agent},
                    )
                    response.raise_for_status()
                rows = response.json()
                if not isinstance(rows, list):
                    raise TypeError("Unexpected geocoding response")
                result = None
                if rows:
                    latitude, longitude = float(rows[0]["lat"]), float(rows[0]["lon"])
                    display_name = str(rows[0]["display_name"])
                    address = rows[0].get("address", {})
                    admin_text = " ".join(str(part) for part in (
                        address.get("city", ""), address.get("state", ""),
                        address.get("province", ""), display_name,
                    )).casefold()
                    if (HANOI_LAT_MIN <= latitude <= HANOI_LAT_MAX
                            and HANOI_LON_MIN <= longitude <= HANOI_LON_MAX
                            and any(name in admin_text for name in ("hà nội", "ha noi", "hanoi"))):
                        result = ResolvedLocation(display_name, latitude, longitude)
            except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
                raise GeocodingUnavailable(
                    "Location lookup is unavailable. Try again, use device location, or pick a point on the map."
                ) from exc
            self._cache[key] = result
            if len(self._cache) > self.CACHE_SIZE:
                self._cache.popitem(last=False)
            return result

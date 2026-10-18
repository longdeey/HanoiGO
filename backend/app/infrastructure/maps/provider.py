"""Road geometry adapter. The itinerary remains usable without this provider."""

import logging
from dataclasses import dataclass
from typing import Protocol

import httpx

logger = logging.getLogger(__name__)

Coordinate = tuple[float, float]  # latitude, longitude


@dataclass(frozen=True)
class RoadRoute:
    coordinates: tuple[Coordinate, ...]
    distance_km: float | None
    duration_minutes: int | None
    source: str
    warning: str | None = None


class MapProvider(Protocol):
    def road_geometry(self, points: tuple[Coordinate, ...]) -> RoadRoute: ...


class OSRMMapProvider:
    TIMEOUT_SECONDS = 2.5
    MAX_ATTEMPTS = 2

    def __init__(self, base_url: str, transport: httpx.BaseTransport | None = None) -> None:
        self.base_url = base_url.rstrip("/")
        self.transport = transport

    def road_geometry(self, points: tuple[Coordinate, ...]) -> RoadRoute:
        if len(points) < 2:
            return RoadRoute(points, 0.0, 0, "direct")
        path = ";".join(f"{longitude:.6f},{latitude:.6f}" for latitude, longitude in points)
        url = f"{self.base_url}/route/v1/driving/{path}"
        for attempt in range(self.MAX_ATTEMPTS):
            try:
                with httpx.Client(timeout=self.TIMEOUT_SECONDS, transport=self.transport) as client:
                    response = client.get(url, params={"overview": "full", "geometries": "geojson"})
                    response.raise_for_status()
                payload = response.json()
                if payload.get("code") != "Ok":
                    raise ValueError("Road route unavailable")
                route = payload["routes"][0]
                coordinates = tuple(
                    (float(latitude), float(longitude))
                    for longitude, latitude in route["geometry"]["coordinates"]
                )
                if len(coordinates) < 2 or float(route["distance"]) < 0 or float(route["duration"]) < 0:
                    raise ValueError("Invalid road route")
                return RoadRoute(
                    coordinates=coordinates,
                    distance_km=round(float(route["distance"]) / 1000, 3),
                    duration_minutes=round(float(route["duration"]) / 60),
                    source="osrm",
                )
            except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError) as exc:
                logger.warning("Map provider attempt %s failed: %s", attempt + 1, type(exc).__name__)
        return RoadRoute(points, None, None, "direct", "Road routing unavailable; showing direct line")

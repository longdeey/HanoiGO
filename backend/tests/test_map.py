import httpx
from fastapi.testclient import TestClient

from app.api.routes.trips import get_map_provider
from app.infrastructure.maps.provider import OSRMMapProvider, RoadRoute
from app.main import app

POINTS = ((21.0287, 105.8522), (21.034, 105.85))


def test_osrm_adapter_parses_road_geometry_and_metrics() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert "/route/v1/driving/105.852200,21.028700;105.850000,21.034000" in str(request.url)
        return httpx.Response(200, json={
            "code": "Ok", "routes": [{
                "distance": 1200.0, "duration": 420.0,
                "geometry": {"coordinates": [
                    [105.8522, 21.0287], [105.851, 21.031], [105.85, 21.034],
                ]},
            }],
        })

    provider = OSRMMapProvider("https://example.test", httpx.MockTransport(handler))
    route = provider.road_geometry(POINTS)
    assert route.source == "osrm"
    assert route.distance_km == 1.2
    assert route.duration_minutes == 7
    assert len(route.coordinates) == 3


def test_osrm_failure_returns_direct_geometry_after_bounded_attempts() -> None:
    attempts = 0

    def handler(_request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        return httpx.Response(503)

    provider = OSRMMapProvider("https://example.test", httpx.MockTransport(handler))
    route = provider.road_geometry(POINTS)
    assert attempts == provider.MAX_ATTEMPTS
    assert route.source == "direct"
    assert route.coordinates == POINTS
    assert route.warning


def test_map_api_has_structured_fallback_and_validates_coordinates() -> None:
    class DirectProvider:
        def road_geometry(self, points: tuple[tuple[float, float], ...]) -> RoadRoute:
            return RoadRoute(points, None, None, "direct", "No road service")

    app.dependency_overrides[get_map_provider] = DirectProvider
    try:
        client = TestClient(app)
        request = {"points": [
            {"latitude": latitude, "longitude": longitude} for latitude, longitude in POINTS
        ]}
        response = client.post("/api/v1/routes/geometry", json=request)
        assert response.status_code == 200
        assert response.json()["source"] == "direct"
        assert len(response.json()["coordinates"]) == 2
        invalid = client.post("/api/v1/routes/geometry", json={"points": [
            {"latitude": 91, "longitude": 105.8},
        ]})
        assert invalid.status_code == 422
        assert invalid.json()["error"]["code"] == "INVALID_REQUEST"
    finally:
        app.dependency_overrides.pop(get_map_provider, None)

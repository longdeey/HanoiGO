import httpx
from fastapi.testclient import TestClient

from app.api.routes.trips import get_geocoder
from app.main import app


def test_nominatim_resolves_hanoi_address_and_caches_result() -> None:
    from app.infrastructure.maps.geocoding import NominatimGeocoder

    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        assert request.url.path == "/search"
        assert request.url.params["q"] == "123 Nguyễn Trãi, Hà Nội"
        assert request.url.params["bounded"] == "1"
        assert request.url.params["countrycodes"] == "vn"
        assert "HanoiGO" in request.headers["User-Agent"]
        return httpx.Response(200, json=[{
            "display_name": "Nguyễn Trãi, Thanh Xuân, Hà Nội", "lat": "21.001", "lon": "105.817",
        }])

    geocoder = NominatimGeocoder(
        "https://example.test", "HanoiGO-Test/1.0", httpx.MockTransport(handler),
        request_interval_seconds=0,
    )
    first = geocoder.resolve("123 Nguyễn Trãi, Hà Nội")
    second = geocoder.resolve("123 Nguyễn Trãi, Hà Nội")
    assert first == second
    assert first is not None
    assert (first.latitude, first.longitude) == (21.001, 105.817)
    assert calls == 1


def test_geocoder_rejects_outside_hanoi_and_handles_provider_failure() -> None:
    from app.infrastructure.maps.geocoding import GeocodingUnavailable, NominatimGeocoder

    outside = NominatimGeocoder(
        "https://example.test", "HanoiGO-Test/1.0",
        httpx.MockTransport(lambda _request: httpx.Response(200, json=[{
            "display_name": "Đà Nẵng", "lat": "16.067", "lon": "108.22",
        }])), request_interval_seconds=0,
    )
    assert outside.resolve("Đà Nẵng") is None
    nearby_province = NominatimGeocoder(
        "https://example.test", "HanoiGO-Test/1.0",
        httpx.MockTransport(lambda _request: httpx.Response(200, json=[{
            "display_name": "Bắc Ninh, Việt Nam", "lat": "21.18", "lon": "105.95",
        }])), request_interval_seconds=0,
    )
    assert nearby_province.resolve("Bắc Ninh") is None
    unavailable = NominatimGeocoder(
        "https://example.test", "HanoiGO-Test/1.0",
        httpx.MockTransport(lambda _request: httpx.Response(503)), request_interval_seconds=0,
    )
    try:
        unavailable.resolve("Hà Nội")
    except GeocodingUnavailable:
        pass
    else:
        raise AssertionError("Geocoding failure must be explicit")


def test_location_lookup_api_returns_structured_location_and_errors() -> None:
    from app.infrastructure.maps.geocoding import ResolvedLocation

    class StubGeocoder:
        def resolve(self, query: str) -> ResolvedLocation | None:
            if query == "123 Nguyễn Trãi":
                return ResolvedLocation("123 Nguyễn Trãi, Hà Nội", 21.001, 105.817)
            return None

    app.dependency_overrides[get_geocoder] = StubGeocoder
    try:
        client = TestClient(app)
        resolved = client.get("/api/v1/locations/resolve", params={"query": "123 Nguyễn Trãi"})
        assert resolved.status_code == 200
        assert resolved.json()["latitude"] == 21.001
        missing = client.get("/api/v1/locations/resolve", params={"query": "unknown place"})
        assert missing.status_code == 404
        assert missing.json()["error"]["code"] == "LOCATION_NOT_FOUND"
        invalid = client.get("/api/v1/locations/resolve", params={"query": "a"})
        assert invalid.status_code == 422
    finally:
        app.dependency_overrides.pop(get_geocoder, None)

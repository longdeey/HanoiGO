from fastapi.testclient import TestClient

from app.api.routes.trips import get_settings
from app.core.config import Settings
from app.main import app


def test_fixed_window_limit_resets_after_one_minute() -> None:
    from app.application.rate_limit import FixedWindowLimiter

    limiter = FixedWindowLimiter()
    assert limiter.check("visitor", limit=2, window_seconds=60, now=100.0) == 0
    assert limiter.check("visitor", limit=2, window_seconds=60, now=110.0) == 0
    assert limiter.check("visitor", limit=2, window_seconds=60, now=120.0) == 40
    assert limiter.check("other", limit=2, window_seconds=60, now=120.0) == 0
    assert limiter.check("visitor", limit=2, window_seconds=60, now=160.0) == 0


def test_generate_rate_limit_uses_consistent_error_contract() -> None:
    from app.api.routes.trips import generate_limiter

    generate_limiter.clear()
    app.dependency_overrides[get_settings] = lambda: Settings(
        app_env="production", generate_rate_limit_per_minute=1,
    )
    try:
        client = TestClient(app)
        # Validation errors still consume capacity; otherwise attackers can send
        # cheap malformed requests without a bound.
        first = client.post("/api/v1/trips/generate", json={})
        second = client.post("/api/v1/trips/generate", json={})
        assert first.status_code == 422
        assert second.status_code == 429
        assert second.json()["error"]["code"] == "RATE_LIMITED"
        assert int(second.headers["Retry-After"]) > 0
    finally:
        app.dependency_overrides.pop(get_settings, None)
        generate_limiter.clear()


def test_development_does_not_rate_limit_generation() -> None:
    from app.api.routes.trips import generate_limiter

    generate_limiter.clear()
    app.dependency_overrides[get_settings] = lambda: Settings(
        app_env="development", generate_rate_limit_per_minute=1,
    )
    try:
        client = TestClient(app)
        assert client.post("/api/v1/trips/generate", json={}).status_code == 422
        assert client.post("/api/v1/trips/generate", json={}).status_code == 422
    finally:
        app.dependency_overrides.pop(get_settings, None)
        generate_limiter.clear()

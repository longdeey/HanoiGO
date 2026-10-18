from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

DEMO_REQUEST = {
    "language": "en", "startDate": "2026-09-15", "days": 3,
    "travelerCount": 2, "budgetTotal": 3_000_000,
    "startLocation": {"name": "Hanoi Old Quarter", "latitude": 21.034, "longitude": 105.85},
    "interests": ["food", "history", "coffee", "local_culture"],
    "travelMode": "walking_grab", "travelRadiusMode": "balanced",
    "pace": "balanced", "experiencePreferences": ["local"],
    "dailyStartTime": "08:00", "dailyEndTime": "21:00",
}


def test_generate_get_and_place_detail_api_contract() -> None:
    response = client.post("/api/v1/trips/generate", json=DEMO_REQUEST)
    assert response.status_code == 200, response.text
    data = response.json()
    assert len(data["options"]) == 3
    assert [option["type"] for option in data["options"]] == [
        "BEST_MATCH", "BUDGET_FRIENDLY", "EXPLORE_MORE",
    ]
    assert all(option["budget"]["remaining"] >= 0 for option in data["options"])
    assert [option["budgetTargetShare"] for option in data["options"]] == [0.95, None, 0.9]
    for option in data["options"]:
        if option["budgetTargetShare"] is not None and option["budgetTargetMet"]:
            assert option["budget"]["total"] >= option["budgetTargetShare"] * DEMO_REQUEST["budgetTotal"]
    first_item = data["options"][0]["days"][0]["items"][0]
    assert first_item["place"]["name"]
    assert first_item["endTime"] > first_item["startTime"]
    trip_id = data["tripId"]
    assert data["ownerToken"]
    fetched = client.get(
        f"/api/v1/trips/{trip_id}", headers={"Authorization": f"Bearer {data['ownerToken']}"},
    )
    assert fetched.status_code == 200
    assert fetched.json() == {**data, "ownerToken": None}
    place_id = first_item["place"]["id"]
    assert client.get(f"/api/v1/places/{place_id}").json()["id"] == place_id


def test_business_and_validation_errors_have_consistent_schema() -> None:
    bad = client.post("/api/v1/trips/generate", json={**DEMO_REQUEST, "budgetTotal": 0})
    assert bad.status_code == 422
    assert bad.json()["error"]["code"] == "INVALID_REQUEST"
    infeasible = client.post("/api/v1/trips/generate", json={
        **DEMO_REQUEST, "budgetTotal": 1, "travelRadiusMode": "near",
        "startLocation": {"name": "Western Hanoi", "latitude": 21.03, "longitude": 105.45},
    })
    assert infeasible.status_code == 422
    assert infeasible.json()["error"]["code"] == "NO_FEASIBLE_ITINERARY"
    missing = client.get("/api/v1/trips/missing")
    assert missing.status_code == 404
    assert missing.json() == {
        "success": False,
        "error": {"code": "NOT_FOUND", "message": "Trip not found", "details": None},
    }


def test_owner_and_share_tokens_limit_trip_access() -> None:
    generated = client.post("/api/v1/trips/generate", json=DEMO_REQUEST).json()
    trip_id = generated["tripId"]
    owner = {"Authorization": f"Bearer {generated['ownerToken']}"}
    assert client.get(f"/api/v1/trips/{trip_id}").json()["error"]["code"] == "TRIP_ACCESS_DENIED"
    shared = client.post(f"/api/v1/trips/{trip_id}/share", headers=owner)
    assert shared.status_code == 200, shared.text
    share = {"Authorization": f"Bearer {shared.json()['shareToken']}"}
    assert client.get(f"/api/v1/trips/{trip_id}", headers=share).status_code == 200
    option = generated["options"][0]
    denied = client.post(
        f"/api/v1/trips/{trip_id}/itineraries/{option['id']}/optimize",
        json={"strategy": "REDUCE_COST"}, headers=share,
    )
    assert denied.status_code == 403
    assert denied.json()["error"]["code"] == "TRIP_ACCESS_DENIED"
    rotated = client.post(f"/api/v1/trips/{trip_id}/share", headers=owner)
    assert rotated.status_code == 200
    assert client.get(f"/api/v1/trips/{trip_id}", headers=share).status_code == 403


def test_browser_preflight_allows_authorization_header() -> None:
    response = client.options(
        "/api/v1/trips/example",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization",
        },
    )
    assert response.status_code == 200
    assert "authorization" in response.headers["access-control-allow-headers"].lower()

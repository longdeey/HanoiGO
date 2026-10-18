from fastapi.testclient import TestClient
from test_trip_api import DEMO_REQUEST

from app.main import app

client = TestClient(app)


def owner_headers(trip: dict[str, object]) -> dict[str, str]:
    return {"Authorization": f"Bearer {trip['ownerToken']}"}


def test_replace_then_reduce_cost_recalculates_and_keeps_constraints() -> None:
    generated = client.post("/api/v1/trips/generate", json=DEMO_REQUEST)
    assert generated.status_code == 200, generated.text
    before = generated.json()
    trip_id = before["tripId"]
    initial = before["options"][0]
    itinerary_id = initial["id"]
    old_item = initial["days"][0]["items"][0]
    replaced = client.post(
        f"/api/v1/trips/{trip_id}/itineraries/{itinerary_id}/items/{old_item['id']}/replace",
        json={"reason": "TOO_EXPENSIVE"}, headers=owner_headers(before),
    )
    assert replaced.status_code == 200, replaced.text
    after = replaced.json()["options"][0]
    assert after["id"] == itinerary_id
    assert old_item["place"]["id"] not in {
        item["place"]["id"] for day in after["days"] for item in day["items"]
    }
    assert after["days"][0]["items"] != initial["days"][0]["items"]
    assert after["days"][0]["estimatedDistanceKm"] != initial["days"][0]["estimatedDistanceKm"]
    assert after["budget"]["total"] == sum(day["estimatedCost"] for day in after["days"])
    assert after["estimatedTotalDistanceKm"] == round(sum(
        day["estimatedDistanceKm"] for day in after["days"]
    ), 3)
    assert after["budget"]["remaining"] >= 0
    optimized = client.post(
        f"/api/v1/trips/{trip_id}/itineraries/{itinerary_id}/optimize",
        json={"strategy": "REDUCE_COST"}, headers=owner_headers(before),
    )
    assert optimized.status_code == 200, optimized.text
    cheaper = optimized.json()["options"][0]
    assert cheaper["estimatedTotalCost"] <= after["estimatedTotalCost"]
    assert cheaper["budget"]["remaining"] >= 0
    assert all(day["items"] for day in cheaper["days"])


def test_modify_errors_use_contract() -> None:
    response = client.post(
        "/api/v1/trips/missing/itineraries/missing/optimize",
        json={"strategy": "REDUCE_COST"},
    )
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"


def test_lock_place_survives_fetch_and_blocks_replacement() -> None:
    generated = client.post("/api/v1/trips/generate", json=DEMO_REQUEST).json()
    trip_id = generated["tripId"]
    option = generated["options"][0]
    item = option["days"][0]["items"][0]
    route = f"/api/v1/trips/{trip_id}/itineraries/{option['id']}/items/{item['id']}"
    locked = client.post(f"{route}/lock", json={"locked": True}, headers=owner_headers(generated))
    assert locked.status_code == 200, locked.text
    assert locked.json()["options"][0]["days"][0]["items"][0]["locked"] is True
    fetched = client.get(f"/api/v1/trips/{trip_id}", headers=owner_headers(generated))
    assert fetched.json()["options"][0]["days"][0]["items"][0]["locked"] is True
    recalculated = client.post(
        f"/api/v1/trips/{trip_id}/itineraries/{option['id']}/optimize",
        json={"strategy": "REGENERATE_DAY", "dayNumber": 2}, headers=owner_headers(generated),
    )
    assert recalculated.status_code == 200, recalculated.text
    assert recalculated.json()["options"][0]["days"][0]["items"][0]["locked"] is True
    rejected = client.post(f"{route}/replace", json={"reason": "TOO_FAR"}, headers=owner_headers(generated))
    assert rejected.status_code == 409
    assert rejected.json()["error"]["code"] == "PLACE_LOCKED"
    unlocked = client.post(f"{route}/lock", json={"locked": False}, headers=owner_headers(generated))
    assert unlocked.status_code == 200
    assert unlocked.json()["options"][0]["days"][0]["items"][0]["locked"] is False


def test_regenerate_selected_day_preserves_other_days() -> None:
    generated = client.post("/api/v1/trips/generate", json=DEMO_REQUEST).json()
    trip_id = generated["tripId"]
    before = generated["options"][0]
    response = client.post(
        f"/api/v1/trips/{trip_id}/itineraries/{before['id']}/optimize",
        json={"strategy": "REGENERATE_DAY", "dayNumber": 2}, headers=owner_headers(generated),
    )
    assert response.status_code == 200, response.text
    after = response.json()["options"][0]
    assert after["days"][0] == before["days"][0]
    assert after["days"][2] == before["days"][2]
    assert after["days"][1]["items"] != before["days"][1]["items"]

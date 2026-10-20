from uuid import uuid4

from fastapi.testclient import TestClient
from test_trip_api import DEMO_REQUEST

from app.main import app

client = TestClient(app)


def register() -> dict[str, str]:
    """A fresh account, signed in: the Authorization header for it."""
    response = client.post("/api/v1/auth/register", json={
        "displayName": "Lan", "identifier": f"lan-{uuid4().hex[:10]}@example.com", "password": "secret-pass",
    })
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['token']}"}


def login_again(headers: dict[str, str]) -> dict[str, str]:
    me = client.get("/api/v1/auth/me", headers=headers).json()["user"]
    response = client.post("/api/v1/auth/login", json={"identifier": me["email"], "password": "secret-pass"})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['token']}"}


def test_a_signed_in_planner_finds_the_trip_on_another_device() -> None:
    phone = register()
    trip = client.post("/api/v1/trips/generate", json=DEMO_REQUEST, headers=phone).json()
    laptop = login_again(phone)
    # Signing in on a second device keeps the first one signed in.
    assert client.get("/api/v1/auth/me", headers=phone).status_code == 200
    listed = client.get("/api/v1/me/trips", headers=laptop)
    assert listed.status_code == 200
    assert [item["tripId"] for item in listed.json()] == [trip["tripId"]]
    assert listed.json()[0]["days"] == 3 and listed.json()[0]["startName"] == "Hanoi Old Quarter"
    # The account token opens and edits the trip without the device's owner token.
    assert client.get(f"/api/v1/trips/{trip['tripId']}", headers=laptop).status_code == 200
    assert client.post(f"/api/v1/trips/{trip['tripId']}/share", headers=laptop).status_code == 200
    # Another account cannot.
    stranger = register()
    assert client.get(f"/api/v1/trips/{trip['tripId']}", headers=stranger).status_code == 403
    assert client.get("/api/v1/me/trips", headers=stranger).json() == []


def test_trips_made_before_signing_in_are_saved_with_their_owner_token() -> None:
    anonymous = client.post("/api/v1/trips/generate", json=DEMO_REQUEST).json()
    account = register()
    wrong = client.post("/api/v1/me/trips/claim", headers=account,
                        json={"trips": [{"tripId": anonymous["tripId"], "ownerToken": "not-the-token"}]})
    assert wrong.json() == {"claimed": []}
    claimed = client.post("/api/v1/me/trips/claim", headers=account,
                          json={"trips": [{"tripId": anonymous["tripId"], "ownerToken": anonymous["ownerToken"]}]})
    assert claimed.json() == {"claimed": [anonymous["tripId"]]}
    assert [item["tripId"] for item in client.get("/api/v1/me/trips", headers=account).json()] == [anonymous["tripId"]]
    # Once saved to an account, no other account can take it.
    other = register()
    again = client.post("/api/v1/me/trips/claim", headers=other,
                        json={"trips": [{"tripId": anonymous["tripId"], "ownerToken": anonymous["ownerToken"]}]})
    assert again.json() == {"claimed": []}


def test_removing_a_trip_and_signing_out() -> None:
    account = register()
    trip = client.post("/api/v1/trips/generate", json=DEMO_REQUEST, headers=account).json()
    assert client.delete(f"/api/v1/me/trips/{trip['tripId']}", headers=register()).status_code == 404
    assert client.delete(f"/api/v1/me/trips/{trip['tripId']}", headers=account).status_code == 204
    assert client.get("/api/v1/me/trips", headers=account).json() == []
    assert client.post("/api/v1/auth/logout", headers=account).status_code == 204
    assert client.get("/api/v1/auth/me", headers=account).status_code == 401
    assert client.get("/api/v1/me/trips", headers=account).status_code == 401

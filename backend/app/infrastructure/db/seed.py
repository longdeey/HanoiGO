"""Idempotent seed of the curated Hanoi places in data/curated_places.json.

Every curated place lives in that one file: coordinates, prices, hours,
editorial highlight, seasonal windows, sources and demo reviews. Rows are
upserted by slug, so editing the file and re-running the seed updates the
database. OpenStreetMap rows are handled separately by osm_import.
"""

import json
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

from geoalchemy2.elements import WKTElement
from sqlalchemy import select

from app.infrastructure.db.models import Place, PlaceReview, new_id, now_utc
from app.infrastructure.db.session import SessionLocal

CURATED_PATH = Path(__file__).resolve().parents[3] / "data" / "curated_places.json"


def load_curated(path: Path = CURATED_PATH) -> dict[str, Any]:
    """Return the curated document with every opening_hours preset resolved."""
    document = json.loads(path.read_text(encoding="utf-8"))
    presets = document["opening_hour_presets"]
    for place in document["places"]:
        if isinstance(place["opening_hours"], str):
            place["opening_hours"] = presets[place["opening_hours"]]
    return document


def _apply(place: Place, data: dict[str, Any]) -> None:
    annual = data.get("annual")
    price_verified = data.get("price_verified", False)
    hours_verified = data.get("hours_verified", False)
    place.name_en = data["name_en"]
    place.name_vi = data["name_vi"]
    place.latitude = data["latitude"]
    place.longitude = data["longitude"]
    place.location = WKTElement(f"POINT({data['longitude']} {data['latitude']})", srid=4326)
    place.category = data["category"]
    place.tags = data["tags"]
    place.description_en = data.get("description_en", f"Explore {data['name_en']} in Hanoi.")
    place.description_vi = data.get("description_vi", f"Khám phá {data['name_vi']} tại Hà Nội.")
    place.average_cost = data["average_cost"]
    place.entrance_fee = data["entrance_fee"]
    place.average_visit_minutes = data["average_visit_minutes"]
    place.indoor = data["indoor"]
    place.outdoor = data["outdoor"]
    place.local_score = data["local_score"]
    place.experience_type = "local" if data["local_score"] >= 85 else "popular"
    place.crowd_level = data.get("crowd_level", "medium")
    place.opening_hours = data["opening_hours"]
    place.special_closed_dates = data.get("special_closed_dates", [])
    place.available_from = date.fromisoformat(data["available_from"]) if "available_from" in data else None
    place.available_until = date.fromisoformat(data["available_until"]) if "available_until" in data else None
    place.annual_month = annual["month"] if annual else None
    place.annual_day = annual["day"] if annual else None
    place.annual_duration_days = annual["duration_days"] if annual else 1
    place.annual_calendar = annual.get("calendar", "solar") if annual else "solar"
    place.highlight_level = data.get("highlight_level", "standard")
    place.best_time_slots = data.get("best_time_slots", ["morning", "afternoon"])
    place.suitable_for = data.get("suitable_for", ["solo", "couple", "friends", "family"])
    place.price_verified = price_verified
    place.hours_verified = hours_verified
    place.verified = price_verified and hours_verified
    place.price_source = data.get("price_source")
    place.hours_source = data.get("hours_source")
    place.booking_source = data.get("booking_source")
    place.source = data["source"]
    place.is_active = True
    if place.verified and place.verified_at is None:
        place.verified_at = datetime.now(UTC)


def seed_places(path: Path = CURATED_PATH) -> int:
    document = load_curated(path)
    file_sources = {"demo_seed"} | {
        data[key] for data in document["places"]
        for key in ("source", "price_source", "hours_source") if data.get(key)
    }
    inserted = 0
    with SessionLocal.begin() as session:
        existing = {place.slug: place for place in session.scalars(select(Place))}
        for data in document["places"]:
            place = existing.get(data["slug"])
            if place is None:
                place = Place(slug=data["slug"])
                session.add(place)
                existing[data["slug"]] = place
                inserted += 1
            elif place.verified and place.source not in file_sources:
                # Preserve records that a developer has manually verified.
                continue
            _apply(place, data)
        # A curated row removed from the file is retired, not deleted, so saved
        # itineraries keep their references. OpenStreetMap rows belong to osm_import.
        wanted = {data["slug"] for data in document["places"]}
        for slug, place in existing.items():
            if slug not in wanted and "-osm-" not in slug and place.is_active:
                place.is_active = False
        session.flush()
        existing_reviews = {
            (review.place_id, review.author_name, review.comment)
            for review in session.scalars(select(PlaceReview))
        }
        for data in document["places"]:
            place = existing[data["slug"]]
            for review in data.get("reviews", []):
                if (place.id, review["author"], review["comment"]) in existing_reviews:
                    continue
                session.add(PlaceReview(
                    id=new_id(), place_id=place.id, author_name=review["author"],
                    rating=review["rating"], comment=review["comment"], created_at=now_utc(),
                ))
    return inserted


if __name__ == "__main__":
    print(f"Seeded {seed_places()} places")

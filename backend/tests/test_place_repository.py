from sqlalchemy import func, select

from app.infrastructure.db.models import Place
from app.infrastructure.db.seed import seed_places
from app.infrastructure.db.session import SessionLocal
from app.infrastructure.repositories.places import PlaceRepository


def test_seed_is_idempotent_and_repository_reads_varied_places() -> None:
    assert seed_places() == 0
    with SessionLocal() as session:
        repository = PlaceRepository(session)
        places = repository.list_active()
        assert len(places) >= 20
        assert {"history", "museum", "food", "coffee", "park", "local_experience"} <= {
            place.category for place in places
        }
        old_quarter = repository.get_by_slug("old-quarter-walk")
        assert old_quarter is not None
        assert repository.get(old_quarter.id) is old_quarter
        assert old_quarter.opening_hours["0"]


def test_place_coordinates_are_postgis_geography() -> None:
    with SessionLocal() as session:
        statement = select(func.ST_Distance(Place.location, Place.location)).where(
            Place.slug == "hoan-kiem-lake"
        )
        assert session.scalar(statement) == 0

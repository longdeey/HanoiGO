from sqlalchemy import select

from app.domain.planner.budgeting import place_cost
from app.domain.planner.types import candidate_from_place
from app.infrastructure.db.models import Place
from app.infrastructure.db.seed import load_curated, seed_places
from app.infrastructure.db.session import SessionLocal


def test_source_backed_seed_updates_existing_places_without_double_charging_tickets() -> None:
    assert seed_places() == 0
    ticket_only = [
        data["slug"] for data in load_curated()["places"]
        if data.get("price_verified") and data["average_cost"] == 0 and data["entrance_fee"] > 0
    ]
    assert len(ticket_only) == 10
    with SessionLocal() as session:
        places = {place.slug: place for place in session.scalars(select(Place))}
        for slug in ticket_only:
            place = places[slug]
            assert place.average_cost == 0
            assert place_cost(candidate_from_place(place), 2).total == 2 * place.entrance_fee
        ngoc_son = places["ngoc-son-temple"]
        assert ngoc_son.entrance_fee == 50_000
        assert ngoc_son.price_verified and not ngoc_son.hours_verified
        for slug in ("temple-of-literature", "hoa-lo-prison", "vietnam-fine-arts-museum", "ethnology-museum"):
            assert places[slug].verified
            assert places[slug].price_source and places[slug].hours_source
        assert places["hoa-lo-prison"].opening_hours["0"] == [["08:00", "17:00"]]
        assert places["temple-of-literature"].opening_hours["0"] == [["08:00", "17:00"]]
        assert places["vietnam-fine-arts-museum"].opening_hours["0"] == []
        assert places["vietnam-fine-arts-museum"].opening_hours["1"] == [["08:30", "17:00"]]
        women = places["vietnamese-womens-museum"]
        assert women.hours_verified and not women.price_verified
        assert women.opening_hours["0"] == [["08:00", "17:00"]]
        assert len(places) >= 60
        ctaste = places["ctaste-hang-thung"]
        maison = places["maison-vie"]
        assert ctaste.average_cost == 900_000
        assert maison.average_cost == 1_600_000
        assert ctaste.hours_verified and maison.hours_verified
        assert not ctaste.price_verified and not maison.price_verified
        assert ctaste.opening_hours["0"] == [["11:00", "22:00"]]
        assert maison.opening_hours["0"] == [["11:00", "14:00"], ["17:30", "22:00"]]
        assert ctaste.price_source and maison.price_source


def test_curated_file_is_consistent() -> None:
    document = load_curated()
    slugs = [data["slug"] for data in document["places"]]
    assert len(slugs) == len(set(slugs)) >= 150
    for data in document["places"]:
        assert isinstance(data["opening_hours"], dict)
        if data.get("price_verified"):
            assert data.get("price_source")
        if data.get("hours_verified"):
            assert data.get("hours_source")
        assert data.get("highlight_level", "standard") in {"standard", "notable", "must_see"}
        for review in data.get("reviews", []):
            assert 1 <= review["rating"] <= 5

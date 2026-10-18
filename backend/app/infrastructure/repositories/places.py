from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.infrastructure.db.models import Place


class PlaceRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def list_active(self) -> list[Place]:
        # Reviews feed the layer-2 FeedbackScore; load them in one query.
        statement = (
            select(Place).where(Place.is_active.is_(True))
            .options(selectinload(Place.reviews)).order_by(Place.slug)
        )
        return list(self.session.scalars(statement))

    def get(self, place_id: str) -> Place | None:
        return self.session.get(Place, place_id)

    def get_by_slug(self, slug: str) -> Place | None:
        return self.session.scalar(select(Place).where(Place.slug == slug))

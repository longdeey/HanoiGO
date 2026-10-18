"""Small capability-token access model for saved trips."""

import hashlib
import secrets

from sqlalchemy.orm import Session

from app.infrastructure.db.models import TripRequest


class TripAccessDenied(Exception):
    pass


def new_token() -> str:
    return secrets.token_urlsafe(32)


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def access_token(authorization: str | None) -> str | None:
    if authorization is None or not authorization.startswith("Bearer "):
        return None
    token = authorization[7:]
    return token if token else None


def authorize_trip(
    session: Session, trip_id: str, authorization: str | None, *, owner: bool,
) -> TripRequest | None:
    trip = session.get(TripRequest, trip_id)
    if trip is None:
        return None
    token = access_token(authorization)
    if token is None:
        raise TripAccessDenied("A trip access token is required")
    digest = token_digest(token)
    owner_ok = trip.owner_token_hash is not None and secrets.compare_digest(
        digest, trip.owner_token_hash
    )
    share_ok = not owner and trip.share_token_hash is not None and secrets.compare_digest(
        digest, trip.share_token_hash
    )
    if not owner_ok and not share_ok:
        raise TripAccessDenied("This token cannot access the trip")
    return trip


def rotate_share_token(session: Session, trip: TripRequest) -> str:
    token = new_token()
    trip.share_token_hash = token_digest(token)
    session.commit()
    return token

"""Small opaque-token account service for the MVP."""

import hashlib
import hmac
import re
import secrets

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.application.access import token_digest
from app.infrastructure.db.models import User, new_id

EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
PHONE_PATTERN = re.compile(r"^\+?[0-9][0-9\s().-]{7,19}$")


class AuthError(Exception):
    pass


def _password_hash(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 180_000)
    return f"pbkdf2_sha256$180000${salt.hex()}${digest.hex()}"


def _password_matches(password: str, encoded: str) -> bool:
    try:
        algorithm, rounds, salt_hex, digest_hex = encoded.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), bytes.fromhex(salt_hex), int(rounds),
        )
        return hmac.compare_digest(digest.hex(), digest_hex)
    except (ValueError, TypeError):
        return False


def _identifier(identifier: str) -> tuple[str | None, str | None]:
    value = identifier.strip()
    if EMAIL_PATTERN.fullmatch(value):
        return value.lower(), None
    normalized_phone = re.sub(r"[\s().-]", "", value)
    if PHONE_PATTERN.fullmatch(value) and len(normalized_phone) >= 8:
        return None, normalized_phone
    raise AuthError("Enter a valid email address or phone number")


def _user_response(user: User) -> dict[str, str | None]:
    return {"id": user.id, "displayName": user.display_name, "email": user.email, "phone": user.phone}


def register(session: Session, display_name: str, identifier: str, password: str) -> tuple[str, User]:
    email, phone = _identifier(identifier)
    identifiers = [User.email == email] if email is not None else [User.phone == phone]
    duplicate = session.scalar(select(User).where(or_(*identifiers)))
    if duplicate is not None:
        raise AuthError("An account with that email or phone already exists")
    user = User(
        id=new_id(), display_name=display_name.strip(), email=email, phone=phone,
        password_hash=_password_hash(password),
    )
    token = secrets.token_urlsafe(32)
    user.auth_token_hash = token_digest(token)
    session.add(user)
    session.commit()
    return token, user


def login(session: Session, identifier: str, password: str) -> tuple[str, User]:
    email, phone = _identifier(identifier)
    identifiers = [User.email == email] if email is not None else [User.phone == phone]
    user = session.scalar(select(User).where(or_(*identifiers)))
    if user is None or not _password_matches(password, user.password_hash):
        raise AuthError("Invalid email/phone or password")
    token = secrets.token_urlsafe(32)
    user.auth_token_hash = token_digest(token)
    session.commit()
    return token, user


def current_user(session: Session, authorization: str | None) -> User | None:
    if authorization is None or not authorization.startswith("Bearer "):
        return None
    digest = token_digest(authorization[7:])
    return session.scalar(select(User).where(User.auth_token_hash == digest))


def public_user(user: User) -> dict[str, str | None]:
    return _user_response(user)

import os
from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import get_settings

# On Vercel each function instance may be frozen between requests, so it opens
# a connection per request (through the database's own pooler) instead of
# keeping a pool whose connections the database may already have dropped.
_serverless = bool(os.environ.get("VERCEL"))
engine = create_engine(get_settings().database_url, pool_pre_ping=True,
                       **({"poolclass": NullPool} if _serverless else {}))
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def get_session() -> Iterator[Session]:
    with SessionLocal() as session:
        yield session

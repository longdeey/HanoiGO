#!/usr/bin/env bash
# Production start (Render): prepare the database, load the places, then serve.
# Every step is safe to repeat: migrations are versioned and both imports upsert by slug.
set -euo pipefail

# Hosting platforms give postgres:// or postgresql:// URLs; SQLAlchemy with psycopg 3 needs postgresql+psycopg://.
export DATABASE_URL="${DATABASE_URL/#postgres:\/\//postgresql+psycopg://}"
export DATABASE_URL="${DATABASE_URL/#postgresql:\/\//postgresql+psycopg://}"

# Places store their location as a PostGIS geography; a fresh managed database needs the extension first.
python -c "
import os, sqlalchemy
engine = sqlalchemy.create_engine(os.environ['DATABASE_URL'])
with engine.begin() as connection:
    connection.exec_driver_sql('CREATE EXTENSION IF NOT EXISTS postgis')
"
python -m alembic upgrade head
python -m app.infrastructure.db.seed
python -m app.infrastructure.db.osm_import

# Behind the platform's proxy, trust X-Forwarded-For so the rate limit counts each visitor, not the proxy.
exec python -m uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --proxy-headers --forwarded-allow-ips="*"

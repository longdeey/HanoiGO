from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://hanoigo:hanoigo@localhost:5432/hanoigo"
    app_env: str = "development"
    cors_origins: str = "http://localhost:3000"
    route_api_url: str = "https://router.project-osrm.org"
    geocoding_api_url: str = "https://nominatim.openstreetmap.org"
    geocoding_user_agent: str = "HanoiGO-Demo/1.0 (local itinerary planner)"
    generate_rate_limit_per_minute: int = Field(default=10, ge=1, le=1000)

    model_config = SettingsConfigDict(env_file="../.env", extra="ignore")

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()

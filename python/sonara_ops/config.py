from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class OpsSettings(BaseSettings):
    supabase_db_url: str | None = Field(default=None, alias="SUPABASE_DB_URL")
    supabase_service_role_key: str | None = Field(default=None, alias="SUPABASE_SERVICE_ROLE_KEY")
    next_public_supabase_url: str | None = Field(default=None, alias="NEXT_PUBLIC_SUPABASE_URL")
    stripe_secret_key: str | None = Field(default=None, alias="STRIPE_SECRET_KEY")

    model_config = SettingsConfigDict(
        env_file=(Path(__file__).resolve().parents[1] / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def has_database_url(self) -> bool:
        return bool(self.supabase_db_url)

    @property
    def has_stripe_secret(self) -> bool:
        return bool(self.stripe_secret_key)


@lru_cache(maxsize=1)
def get_settings() -> OpsSettings:
    return OpsSettings()


def redact(value: str | None) -> str:
    if not value:
        return "missing"
    if len(value) <= 8:
        return "configured"
    return f"{value[:3]}...{value[-3:]}"

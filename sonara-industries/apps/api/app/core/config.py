from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    environment: str = "development"
    database_url: str = "postgresql+psycopg://sonara:change_me@localhost:5432/sonara_industries"
    redis_url: str = "redis://localhost:6379/0"
    jwt_secret: str = "dev-only-change-me"
    cors_origins: str = "http://localhost:3000"
    stripe_secret_key: str | None = None
    stripe_webhook_secret: str | None = None
    next_public_app_url: str = "http://localhost:3000"
    supabase_service_role_key: str | None = None
    next_public_supabase_url: str | None = None
    next_public_supabase_anon_key: str | None = None
    sentry_dsn: str | None = None
    otel_exporter_otlp_endpoint: str | None = None
    nws_user_agent: str = "SONARA Industries AlertOS demo contact@example.com"
    data_gov_api_key: str | None = None
    public_demo_mode: bool = True
    stripe_price_soundos_starter: str | None = None
    stripe_price_soundos_pro: str | None = None
    stripe_price_soundos_studio: str | None = None
    stripe_price_tableos_starter: str | None = None
    stripe_price_tableos_pro: str | None = None
    stripe_price_tableos_multi_location: str | None = None
    stripe_price_alertos_starter: str | None = None
    stripe_price_alertos_org: str | None = None
    stripe_price_alertos_city: str | None = None

    @property
    def cors_allowlist(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

settings = Settings()

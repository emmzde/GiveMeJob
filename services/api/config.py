from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_env: str = "development"
    app_version: str = "0.1.0"
    log_level: str = "INFO"
    sentry_dsn: str | None = None
    sentry_traces_sample_rate: float = Field(default=0.0, ge=0.0, le=1.0)
    database_url: str = "postgresql+psycopg://postgres:givemejob@localhost:5432/givemejob"
    redis_url: str = "redis://localhost:6379/0"
    source_user_agent: str = "GiveMeJobBot/0.1 (+https://github.com/emmzde/GiveMeJob)"
    adzuna_app_id: str | None = None
    adzuna_app_key: str | None = None
    jooble_api_key: str | None = None
    embedding_model: str = "intfloat/multilingual-e5-large"
    embedding_cache_dir: str | None = None
    mvp_market: str = "remote-first-global-plus-cis"
    mvp_vertical: str = "it-digital"
    mvp_interface_locale: str = "ru"
    mvp_index_languages: str = "multilingual"
    skill_canonical_language: str = "en"
    skill_taxonomy: str = "ESCO"
    project_visibility: str = "private"


@lru_cache
def get_settings() -> Settings:
    return Settings()

"""Application settings, loaded from environment / .env (SRS-NFR-04).

Secrets (DATABASE_URL, OPENAI_API_KEY) are read from the environment only and
never hard-coded, so nothing sensitive lives in source control.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str
    app_name: str = "AAAI Backend"
    environment: str = "development"

    # Session signing (SRS-NFR-04). Override SECRET_KEY in .env for real use.
    secret_key: str = "dev-insecure-change-me"
    session_ttl_seconds: int = 3600

    # Consent (SRS-FR-01): version stamped onto each consent record.
    consent_version: str = "v1"

    # Magic-link auth (SRS-FR-04 / NFR-04).
    magic_link_ttl_seconds: int = 900  # 15-minute link expiry
    frontend_base_url: str = "http://localhost:5173"  # link target the email points to
    email_enabled: bool = False  # False (dev): links are logged, not emailed

    # "Interview Physics" — fixed product constants (SRS-2.5), not user settings.
    base_round_seconds: int = 300  # 5:00 base round (FR-05)
    follow_up_seconds: int = 150  # 2:30 follow-up (FR-09)
    processing_pause_seconds: int = 15  # 15s async processing pause (FR-17)

    # Audio upload (SRS-FR-06).
    max_upload_bytes: int = 20 * 1024 * 1024  # hard 20 MB ceiling
    media_dir: str = "media"  # where uploaded audio is stored (path-only in DB)

    # Reserved for later slices — not exercised yet.
    openai_api_key: str = ""
    openai_monthly_budget_usd: float = 10.00


settings = Settings()

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

    # SMTP (used only when email_enabled=True). Fill these from the provider.
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "AAAI <no-reply@aaai.local>"
    smtp_use_tls: bool = True  # STARTTLS (port 587); set False for a plain local server
    smtp_use_ssl: bool = False  # implicit SSL (port 465)

    # Optional: a real inbox for demo logins (kept in .env, never committed).
    # The seed provisions it as a recruiter and "<name>+candidate@..." as a candidate.
    seed_real_email: str = ""

    # CORS — origins allowed to call the API (the Vite dev server).
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    # "Interview Physics" — fixed product constants (SRS-2.5), not user settings.
    base_round_seconds: int = 300  # 5:00 base round (FR-05)
    follow_up_seconds: int = 150  # 2:30 follow-up (FR-09)
    processing_pause_seconds: int = 15  # 15s async processing pause (FR-17)

    # Audio upload (SRS-FR-06).
    max_upload_bytes: int = 20 * 1024 * 1024  # hard 20 MB ceiling
    media_dir: str = "media"  # where uploaded audio is stored (path-only in DB)

    # AI pipeline (FR-07 transcription, FR-08 follow-up, FR-03/10 scoring).
    openai_api_key: str = ""
    openai_monthly_budget_usd: float = 10.00
    # "auto" = OpenAI if OPENAI_API_KEY is set, else Groq if GROQ_API_KEY is set, else a
    # clearly-labelled simulated provider. "openai" / "groq" / "fake" force one.
    ai_provider: str = "auto"
    openai_transcribe_model: str = "whisper-1"  # SRS FR-07
    openai_chat_model: str = "gpt-4o-mini"  # SRS FR-03 / FR-08
    # Groq (free tier, OpenAI-compatible) - a dev/demo alternative to the SRS models.
    groq_api_key: str = ""
    groq_base_url: str = "https://api.groq.com/openai/v1"
    groq_transcribe_model: str = "whisper-large-v3-turbo"
    groq_chat_model: str = "llama-3.3-70b-versatile"
    ai_timeout_seconds: float = 60.0  # per OpenAI call; runs in the background (FR-17)


settings = Settings()

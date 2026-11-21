from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """All configuration comes from environment variables / backend/.env."""

    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")

    app_name: str = "ThriftLoop API"
    database_url: str = f"sqlite:///{(BACKEND_DIR / 'thriftloop.db').as_posix()}"
    upload_dir: Path = BACKEND_DIR / "uploads"
    # Verification selfies / ID photos. Never served publicly; only admins can fetch them.
    private_upload_dir: Path = BACKEND_DIR / "private_uploads"

    # Comma separated emails that are always admins. Set this in backend/.env, never in code.
    admin_emails: str = ""

    # AI shopping assistant. Without a key, a built-in rule-based parser understands requests instead.
    anthropic_api_key: str = ""
    assistant_model: str = "claude-opus-5-5"
    rate_limit_assistant_per_minute: int = 20

    # Rate limiting (requests per minute)
    rate_limit_enabled: bool = True
    rate_limit_per_minute: int = 120
    rate_limit_auth_per_minute: int = 10
    rate_limit_upload_per_minute: int = 20

    # JWT
    jwt_secret_key: str = "change-me-in-backend-env"
    # Fill an empty database with the demo sellers/listings on startup (handy for a fresh deploy).
    seed_demo_data: bool = False
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7

    # Email verification. When false, new accounts are activated immediately (no code is sent).
    require_email_verification: bool = False
    otp_expire_minutes: int = 5
    otp_resend_cooldown_seconds: int = 60
    otp_max_attempts: int = 5
    # Comma separated list. Empty string allows any domain.
    allowed_email_domains: str = "gmail.com"

    # Gmail SMTP (credentials only ever live here, on the backend)
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""  # Gmail App Password
    smtp_from_name: str = "ThriftLoop"
    # When true (or when SMTP creds are missing) codes are printed to the server console instead.
    email_dev_mode: bool = False

    cors_origins: str = "*"

    @property
    def allowed_domains(self) -> list[str]:
        return [d.strip().lower() for d in self.allowed_email_domains.split(",") if d.strip()]

    @property
    def admin_email_set(self) -> set[str]:
        return {e.strip().lower() for e in self.admin_emails.split(",") if e.strip()}

    @property
    def smtp_configured(self) -> bool:
        return bool(self.smtp_username and self.smtp_password)


# Sentinel meaning "not configured" - never used as a signing key.
PLACEHOLDER_SECRET = "change-me-in-backend-env"  # nosec B105


def _persistent_secret() -> str:
    """No JWT secret configured (e.g. a fresh cloud deploy): generate one once and keep it on the
    data volume, so logins survive restarts and nobody ever has to paste a secret anywhere."""
    import os
    import secrets

    path = Path(os.environ.get("SECRET_FILE", BACKEND_DIR / ".jwt_secret"))
    if path.exists():
        return path.read_text(encoding="utf-8").strip()
    path.parent.mkdir(parents=True, exist_ok=True)
    value = secrets.token_urlsafe(48)
    path.write_text(value, encoding="utf-8")
    return value


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    if not s.jwt_secret_key or s.jwt_secret_key == PLACEHOLDER_SECRET:
        s.jwt_secret_key = _persistent_secret()
    return s


settings = get_settings()

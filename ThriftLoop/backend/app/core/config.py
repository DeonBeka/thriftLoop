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

    # Rate limiting (requests per minute)
    rate_limit_enabled: bool = True
    rate_limit_per_minute: int = 120
    rate_limit_auth_per_minute: int = 10
    rate_limit_upload_per_minute: int = 20

    # JWT
    jwt_secret_key: str = "change-me-in-backend-env"
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


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

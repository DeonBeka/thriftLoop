from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user
from app.core.security import (
    create_access_token,
    generate_otp,
    hash_otp,
    hash_password,
    verify_otp,
    verify_password,
)
from app.database import get_db
from app.models import User
from app.schemas import (
    LoginRequest,
    RegisterRequest,
    RegisterResponse,
    ResendCodeRequest,
    TokenResponse,
    VerifyEmailRequest,
)
from app.schemas.user import CurrentUserOut
from app.services.email import EmailDeliveryError, send_verification_email
from app.services.serializers import current_user_out

router = APIRouter(prefix="/auth", tags=["auth"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: datetime | None) -> datetime | None:
    # SQLite hands datetimes back without tzinfo; everything is stored in UTC.
    if value is not None and value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _cooldown_remaining(user: User) -> int:
    sent = _as_utc(user.last_verification_sent_at)
    if sent is None:
        return 0
    elapsed = (_now() - sent).total_seconds()
    return max(0, int(settings.otp_resend_cooldown_seconds - elapsed + 0.999))


def _issue_code(db: Session, user: User) -> None:
    """Create a fresh OTP, store only its hash, and email it. Rolls back on delivery failure."""
    code = generate_otp()
    user.verification_code_hash = hash_otp(user.email, code)
    user.verification_expires_at = _now() + timedelta(minutes=settings.otp_expire_minutes)
    user.verification_attempts = 0
    user.last_verification_sent_at = _now()
    try:
        send_verification_email(user.email, user.username, code)
    except EmailDeliveryError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc))
    db.commit()


def _register_response(user: User) -> RegisterResponse:
    return RegisterResponse(
        message=f"We sent a 6-digit code to {user.email}.",
        email=user.email,
        expires_in_seconds=settings.otp_expire_minutes * 60,
        resend_available_in_seconds=_cooldown_remaining(user),
    )


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> RegisterResponse:
    domain = payload.email.rsplit("@", 1)[-1]
    if settings.allowed_domains and domain not in settings.allowed_domains:
        allowed = ", ".join(f"@{d}" for d in settings.allowed_domains)
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Please use a {allowed} address.")

    existing = db.scalar(select(User).where(User.email == payload.email))
    if existing is not None and existing.is_verified:
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists. Try signing in.")

    username_owner = db.scalar(select(User).where(User.username.ilike(payload.username)))
    if username_owner is not None and username_owner is not existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "That username is taken.")

    if existing is None:
        user = User(
            username=payload.username,
            email=payload.email,
            hashed_password=hash_password(payload.password),
            is_verified=False,
        )
        db.add(user)
        db.flush()
    else:
        # Unverified sign-up being retried: refresh details, but respect the resend cooldown.
        user = existing
        user.username = payload.username
        user.hashed_password = hash_password(payload.password)
        if _cooldown_remaining(user) > 0:
            db.commit()
            return _register_response(user)

    _issue_code(db, user)
    return _register_response(user)


@router.post("/verify-email", response_model=TokenResponse)
def verify_email(payload: VerifyEmailRequest, db: Session = Depends(get_db)) -> TokenResponse:
    email = payload.email.lower()
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "We couldn't find a sign-up for this email.")
    if user.is_verified:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This email is already verified. Please sign in.")
    if not user.verification_code_hash:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No active code. Please request a new one.")

    expires = _as_utc(user.verification_expires_at)
    if expires is None or expires < _now():
        user.verification_code_hash = None
        db.commit()
        raise HTTPException(status.HTTP_410_GONE, "This code has expired. Request a new one.")

    if user.verification_attempts >= settings.otp_max_attempts:
        user.verification_code_hash = None
        db.commit()
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many incorrect attempts. Request a new code.")

    if not verify_otp(user.email, payload.code, user.verification_code_hash):
        user.verification_attempts += 1
        remaining = settings.otp_max_attempts - user.verification_attempts
        if remaining <= 0:
            user.verification_code_hash = None
            db.commit()
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many incorrect attempts. Request a new code.")
        db.commit()
        noun = "attempt" if remaining == 1 else "attempts"
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Incorrect code. {remaining} {noun} left.")

    # Success: activate and burn the code so it can't be reused.
    user.is_verified = True
    user.verification_code_hash = None
    user.verification_expires_at = None
    user.verification_attempts = 0
    db.commit()
    return TokenResponse(access_token=create_access_token(user.id), user=current_user_out(db, user))


@router.post("/resend-code", response_model=RegisterResponse)
def resend_code(payload: ResendCodeRequest, db: Session = Depends(get_db)) -> RegisterResponse:
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "We couldn't find a sign-up for this email.")
    if user.is_verified:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This email is already verified. Please sign in.")
    wait = _cooldown_remaining(user)
    if wait > 0:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            f"Please wait {wait} seconds before requesting another code.",
            headers={"Retry-After": str(wait)},
        )
    _issue_code(db, user)
    return _register_response(user)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password.")
    if not user.is_verified:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Please verify your email before signing in.")
    return TokenResponse(access_token=create_access_token(user.id), user=current_user_out(db, user))


@router.get("/me", response_model=CurrentUserOut)
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> CurrentUserOut:
    return current_user_out(db, user)

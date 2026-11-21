import re

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from app.schemas.user import CurrentUserOut

USERNAME_RE = re.compile(r"^[a-zA-Z0-9._]{3,30}$")


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=30)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)  # bcrypt's input limit
    confirm_password: str

    @field_validator("username")
    @classmethod
    def valid_username(cls, value: str) -> str:
        value = value.strip()
        if not USERNAME_RE.match(value):
            raise ValueError("Username can only use letters, numbers, dots and underscores (3–30 characters).")
        return value

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()

    @model_validator(mode="after")
    def passwords_match(self) -> "RegisterRequest":
        if self.password != self.confirm_password:
            raise ValueError("Passwords don't match.")
        return self


class RegisterResponse(BaseModel):
    message: str
    email: str
    expires_in_seconds: int
    resend_available_in_seconds: int


class VerifyEmailRequest(BaseModel):
    email: EmailStr
    code: str = Field(pattern=r"^\d{6}$")


class ResendCodeRequest(BaseModel):
    email: EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: CurrentUserOut


class MessageResponse(BaseModel):
    message: str

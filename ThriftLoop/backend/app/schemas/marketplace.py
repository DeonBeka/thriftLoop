from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.user import UserSummary


class SellerApplicationOut(BaseModel):
    id: int
    status: str
    full_name: str
    phone: str
    city: str
    note: str | None = None
    admin_note: str | None = None
    has_id_document: bool = False
    id_document_type: str | None = None  # "id_card" / "drivers_license" / "passport"
    id_document_label: str | None = None  # human label, e.g. "Driver's licence"
    created_at: datetime
    reviewed_at: datetime | None = None
    user: UserSummary
    user_email: str | None = None  # admin views only


class ReviewRequest(BaseModel):
    note: str | None = Field(default=None, max_length=500)


class RoleUpdate(BaseModel):
    role: Literal["viewer", "seller"]  # admin can never be granted through the API


class OrderCreate(BaseModel):
    product_id: int
    delivery_name: str = Field(min_length=2, max_length=100)
    phone: str = Field(min_length=6, max_length=30)
    address_text: str = Field(min_length=5, max_length=500)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    note: str | None = Field(default=None, max_length=500)
    accept_terms: bool = False

    @field_validator("delivery_name", "phone", "address_text")
    @classmethod
    def strip(cls, value: str) -> str:
        return value.strip()


class BasketCheckout(BaseModel):
    """Order every item in the basket at once (one order per item, same delivery details)."""

    product_ids: list[int] = Field(min_length=1, max_length=20)
    delivery_name: str = Field(min_length=2, max_length=100)
    phone: str = Field(min_length=6, max_length=30)
    address_text: str = Field(min_length=5, max_length=500)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    note: str | None = Field(default=None, max_length=500)
    accept_terms: bool = False

    @field_validator("delivery_name", "phone", "address_text")
    @classmethod
    def strip(cls, value: str) -> str:
        return value.strip()

    @field_validator("product_ids")
    @classmethod
    def unique(cls, value: list[int]) -> list[int]:
        return list(dict.fromkeys(value))


class OrderStatusUpdate(BaseModel):
    status: Literal["confirmed", "delivered", "cancelled"]


class OrderOut(BaseModel):
    id: int
    product_id: int | None
    product_title: str
    product_image: str | None
    price: float
    payment_method: str
    payment_status: str = "due"  # due (cash on delivery) / paid / refunded
    delivery_name: str
    phone: str
    address_text: str
    latitude: float | None
    longitude: float | None
    note: str | None
    status: str
    created_at: datetime
    updated_at: datetime
    buyer: UserSummary
    seller: UserSummary


class AdminStats(BaseModel):
    users: int
    sellers: int
    pending_applications: int
    active_listings: int
    open_orders: int

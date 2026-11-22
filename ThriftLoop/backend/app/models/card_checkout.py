from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.user import utcnow

CARD_CHECKOUT_STATUSES = ("pending", "paid", "cancelled", "refunded")


class CardCheckout(Base):
    """A basket being paid by card on Stripe's hosted page (test mode).

    Holds the delivery details until Stripe confirms payment; only then are the orders created.
    """

    __tablename__ = "card_checkouts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    product_ids: Mapped[str] = mapped_column(Text)  # JSON list
    delivery: Mapped[str] = mapped_column(Text)  # JSON: name, phone, address, lat/lng, note
    amount_cents: Mapped[int] = mapped_column(Integer)
    stripe_session_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    app_return_url: Mapped[str] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    order_ids: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON list, once paid
    message: Mapped[str | None] = mapped_column(Text, nullable=True)  # explanation shown to the buyer
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.user import utcnow

# Paid "boosts": a listing appears in the Home slideshow and the daily spotlight for a number of days.
PROMOTION_PLANS: dict[str, dict] = {
    "boost_3": {"days": 3, "price": 1.99, "label": "3 days"},
    "boost_7": {"days": 7, "price": 3.99, "label": "7 days"},
    "boost_14": {"days": 14, "price": 6.99, "label": "14 days"},
}
PROMOTION_STATUSES = ("pending", "active", "cancelled")  # "expired" = active with ends_at in the past


class Promotion(Base):
    """A seller paying ThriftLoop to feature one of their listings on the Home page."""

    __tablename__ = "promotions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True)
    seller_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    plan: Mapped[str] = mapped_column(String(20))
    price: Mapped[float] = mapped_column(Float)  # what the seller paid ThriftLoop (0 for demo ads)
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    stripe_session_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    stripe_payment_intent: Mapped[str | None] = mapped_column(String(100), nullable=True)
    app_return_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    product = relationship("Product")

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.user import utcnow

APPLICATION_STATUSES = ("pending", "approved", "rejected")
# Official photo IDs accepted for seller verification.
ID_DOCUMENT_TYPES = {"id_card": "ID card", "drivers_license": "Driver's licence", "passport": "Passport"}


class SellerApplication(Base):
    """A viewer's request to become a seller: identity details plus a live selfie for face check."""

    __tablename__ = "seller_applications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    full_name: Mapped[str] = mapped_column(String(100))
    phone: Mapped[str] = mapped_column(String(30))
    city: Mapped[str] = mapped_column(String(80))
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    selfie_path: Mapped[str] = mapped_column(String(500))  # in private_uploads, never public
    id_document_path: Mapped[str | None] = mapped_column(String(500), nullable=True)  # required for new applications
    id_document_type: Mapped[str | None] = mapped_column(String(20), nullable=True)  # key of ID_DOCUMENT_TYPES
    seller_terms_accepted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    admin_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user = relationship("User", back_populates="seller_applications", foreign_keys=[user_id])
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_id])

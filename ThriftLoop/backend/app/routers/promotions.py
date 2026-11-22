"""Paid promotions ("boosts"): sellers pay to feature a listing in the Home slideshow and daily spotlight.

Payment uses Stripe Checkout in test mode, verified server-side before the boost goes live.
"""

from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.deps import get_current_user, get_optional_user
from app.database import get_db
from app.models import Product, Promotion, User
from app.models.promotion import PROMOTION_PLANS
from app.schemas import ProductOut
from app.services.payments import (
    PaymentError,
    app_redirect_url,
    card_payments_enabled,
    create_hosted_session,
    safe_return_url,
    session_payment,
    to_cents,
)
from app.services.serializers import products_out

router = APIRouter(prefix="/promotions", tags=["promotions"])


class PlanOut(BaseModel):
    id: str
    days: int
    price: float
    label: str


class PromotionOut(BaseModel):
    id: int
    product_id: int
    plan: str
    price: float
    status: str  # pending / active / expired / cancelled
    starts_at: datetime | None
    ends_at: datetime | None


class FeaturedOut(BaseModel):
    promotion_id: int
    ends_at: datetime | None
    product: ProductOut


class BoostRequest(BaseModel):
    product_id: int
    plan: str
    return_url: str = Field(max_length=500)


class BoostStarted(BaseModel):
    promotion_id: int
    url: str


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: datetime | None) -> datetime | None:
    return dt.replace(tzinfo=timezone.utc) if dt is not None and dt.tzinfo is None else dt


def _state(p: Promotion) -> str:
    if p.status == "active" and p.ends_at is not None and _aware(p.ends_at) <= _now():
        return "expired"
    return p.status


def _out(p: Promotion) -> PromotionOut:
    return PromotionOut(id=p.id, product_id=p.product_id, plan=p.plan, price=p.price, status=_state(p),
                        starts_at=p.starts_at, ends_at=p.ends_at)


def _active_until(db: Session, product_id: int) -> datetime | None:
    """When the listing's current boost ends (a new boost starts after it, so days add up)."""
    ends = db.scalars(select(Promotion.ends_at).where(
        Promotion.product_id == product_id, Promotion.status == "active", Promotion.ends_at > _now())).all()
    return max((_aware(e) for e in ends), default=None)


@router.get("/plans", response_model=list[PlanOut])
def plans() -> list[PlanOut]:
    return [PlanOut(id=k, **v) for k, v in PROMOTION_PLANS.items()]


@router.get("/featured", response_model=list[FeaturedOut])
def featured(db: Session = Depends(get_db), viewer: User | None = Depends(get_optional_user),
             limit: Annotated[int, Query(ge=1, le=20)] = 8) -> list[FeaturedOut]:
    """Listings with a live boost, for the Home slideshow and spotlight pop-up. Only items still for sale."""
    rows = db.scalars(
        select(Promotion)
        .join(Product, Product.id == Promotion.product_id)
        .where(Promotion.status == "active", Promotion.ends_at > _now(), Product.status == "active")
        .order_by(Promotion.starts_at.desc())
        .options(selectinload(Promotion.product).selectinload(Product.images),
                 selectinload(Promotion.product).selectinload(Product.seller))
    ).all()
    seen, picked = set(), []
    for p in rows:  # one slide per listing even if it was boosted twice
        if p.product_id not in seen:
            seen.add(p.product_id)
            picked.append(p)
        if len(picked) >= limit:
            break
    products = products_out(db, [p.product for p in picked], viewer)
    return [FeaturedOut(promotion_id=p.id, ends_at=p.ends_at, product=prod) for p, prod in zip(picked, products, strict=True)]


@router.get("/mine", response_model=list[PromotionOut])
def mine(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[PromotionOut]:
    rows = db.scalars(select(Promotion).where(Promotion.seller_id == user.id, Promotion.status != "pending")
                      .order_by(Promotion.created_at.desc())).all()
    return [_out(p) for p in rows]


@router.post("/checkout", response_model=BoostStarted, status_code=status.HTTP_201_CREATED)
def start_boost(body: BoostRequest, request: Request, db: Session = Depends(get_db),
                user: User = Depends(get_current_user)) -> BoostStarted:
    plan = PROMOTION_PLANS.get(body.plan)
    if plan is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Choose a promotion plan.")
    product = db.get(Product, body.product_id)
    if product is None or product.seller_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "You can only promote your own listings.")
    if product.status != "active":
        raise HTTPException(status.HTTP_409_CONFLICT, "Only listings that are for sale can be promoted.")
    if not card_payments_enabled():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Card payments aren't set up yet, so promotions are unavailable.")
    if not safe_return_url(body.return_url):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Invalid return address.")

    promo = Promotion(product_id=product.id, seller_id=user.id, plan=body.plan, price=plan["price"],
                      status="pending", app_return_url=body.return_url)
    db.add(promo)
    db.flush()
    back = f"{str(request.base_url).rstrip('/')}/promotions/return?promotion_id={promo.id}"
    try:
        promo.stripe_session_id, url = create_hosted_session(
            [(f"Promote “{product.title}” for {plan['label']}", to_cents(plan["price"]))],
            back, f"promotion-{promo.id}", {"promotion_id": str(promo.id), "user_id": str(user.id)},
        )
    except PaymentError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from None
    db.commit()
    return BoostStarted(promotion_id=promo.id, url=url)


def _activate(db: Session, promo: Promotion) -> None:
    """Turn a paid promotion on (once). Starts now, or right after an existing boost, so paid days are never lost."""
    if promo.status != "pending" or not promo.stripe_session_id:
        return
    paid, intent = session_payment(promo.stripe_session_id)
    if not paid:
        return
    start = max(_now(), _active_until(db, promo.product_id) or _now())
    promo.starts_at = start
    promo.ends_at = start + timedelta(days=PROMOTION_PLANS[promo.plan]["days"])
    promo.stripe_payment_intent = intent
    promo.status = "active"
    db.commit()


@router.get("/return", include_in_schema=False)
def stripe_return(promotion_id: int, db: Session = Depends(get_db),
                  session_id: Annotated[str | None, Query()] = None,
                  cancelled: Annotated[bool, Query()] = False) -> RedirectResponse:
    promo = db.get(Promotion, promotion_id)
    if promo is None or not promo.app_return_url:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown promotion.")
    if session_id is not None and session_id != promo.stripe_session_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Session mismatch.")
    if cancelled and promo.status == "pending":
        promo.status = "cancelled"
        db.commit()
    else:
        try:
            _activate(db, promo)
        except PaymentError:
            pass  # the app re-checks when it gets control back
    return RedirectResponse(app_redirect_url(promo.app_return_url, {"promotion_id": promo.id, "status": _state(promo)}),
                            status_code=status.HTTP_303_SEE_OTHER)


@router.get("/{promotion_id}", response_model=PromotionOut)
def get_promotion(promotion_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> PromotionOut:
    promo = db.get(Promotion, promotion_id)
    if promo is None or promo.seller_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Promotion not found.")
    try:
        _activate(db, promo)
    except PaymentError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from None
    return _out(promo)

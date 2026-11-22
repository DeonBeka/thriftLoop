"""Card checkout via Stripe (test mode). See app/services/payments.py for the flow."""

import json
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models import CardCheckout, Order, Product, User
from app.routers.orders import check_buyable, create_order
from app.schemas.marketplace import BasketCheckout, OrderOut
from app.services.payments import (
    PaymentError,
    app_redirect,
    card_payments_enabled,
    create_session,
    load_ids,
    refund,
    safe_return_url,
    session_payment,
    to_cents,
)
from app.services.pricing import fees_per_item
from app.services.serializers import order_out

router = APIRouter(prefix="/payments", tags=["payments"])


class PaymentsInfo(BaseModel):
    card_enabled: bool
    test_mode: bool = True
    test_card: str = "4242 4242 4242 4242"


class CardCheckoutRequest(BasketCheckout):
    return_url: str = Field(max_length=500, description="Where the app wants to come back to after paying")


class CardCheckoutStarted(BaseModel):
    checkout_id: int
    url: str


class CardCheckoutState(BaseModel):
    checkout_id: int
    status: str  # pending / paid / cancelled / refunded
    message: str | None = None
    orders: list[OrderOut] = []


@router.get("/info", response_model=PaymentsInfo)
def info() -> PaymentsInfo:
    return PaymentsInfo(card_enabled=card_payments_enabled())


@router.post("/card-checkout", response_model=CardCheckoutStarted, status_code=status.HTTP_201_CREATED)
def start_card_checkout(body: CardCheckoutRequest, request: Request, db: Session = Depends(get_db),
                        user: User = Depends(get_current_user)) -> CardCheckoutStarted:
    if not card_payments_enabled():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Card payments aren't set up yet. Choose cash on delivery.")
    if not body.accept_terms:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Please accept the terms to pay by card.")
    if not safe_return_url(body.return_url):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Invalid return address.")
    products = [check_buyable(db.get(Product, pid), user) for pid in body.product_ids]
    fees = fees_per_item([p.seller_id for p in products], body.city)

    delivery = body.model_dump(include={"delivery_name", "phone", "address_text", "city", "latitude", "longitude", "note"})
    checkout = CardCheckout(
        user_id=user.id,
        product_ids=json.dumps([p.id for p in products]),
        delivery=json.dumps(delivery),
        amount_cents=sum(to_cents(p.price) for p in products) + sum(to_cents(f) for f in fees),
        app_return_url=body.return_url,
        status="pending",
    )
    db.add(checkout)
    db.flush()
    try:
        # The browser comes back to this same API address (whatever host the phone used to reach us).
        lines = [(p.title, to_cents(p.price)) for p in products]
        lines += [(f"Delivery to {body.city} (@{p.seller.username})", to_cents(f)) for p, f in zip(products, fees, strict=True) if f]
        url = create_session(checkout, lines, str(request.base_url))
    except PaymentError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from None
    db.commit()
    return CardCheckoutStarted(checkout_id=checkout.id, url=url)


def _finish(db: Session, checkout: CardCheckout) -> None:
    """If Stripe says the session is paid, create the orders (once). Safe to call repeatedly."""
    if checkout.status != "pending" or not checkout.stripe_session_id:
        return
    paid, intent = session_payment(checkout.stripe_session_id)
    if not paid:
        return
    user = db.get(User, checkout.user_id)
    saved = json.loads(checkout.delivery)
    saved.setdefault("city", "Prishtina")  # card checkouts started before delivery pricing existed
    delivery = BasketCheckout(product_ids=load_ids(checkout.product_ids), accept_terms=True, **saved)
    try:
        products = [check_buyable(db.get(Product, pid), user) for pid in delivery.product_ids]
    except HTTPException as exc:
        # Someone else bought an item while this buyer was paying: give the money back, order nothing.
        db.rollback()
        if intent:
            refund(intent)
        checkout.status = "refunded"
        checkout.message = f"{exc.detail} Your card payment was refunded in full and nothing was ordered."
        db.commit()
        return
    fees = fees_per_item([p.seller_id for p in products], delivery.city)
    orders = [create_order(db, p, user, delivery, delivery=fee, payment_intent=intent)
              for p, fee in zip(products, fees, strict=True)]
    checkout.status = "paid"
    checkout.order_ids = json.dumps([o.id for o in orders])
    db.commit()


@router.get("/return", include_in_schema=False)
def stripe_return(
    checkout_id: int,
    db: Session = Depends(get_db),
    session_id: Annotated[str | None, Query()] = None,
    cancelled: Annotated[bool, Query()] = False,
) -> RedirectResponse:
    """Stripe sends the browser here after the card page; we verify, then hand back to the app."""
    checkout = db.get(CardCheckout, checkout_id)
    if checkout is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown checkout.")
    if session_id is not None and session_id != checkout.stripe_session_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Session mismatch.")
    if cancelled and checkout.status == "pending":
        checkout.status = "cancelled"
        checkout.message = "Payment cancelled. Nothing was charged."
        db.commit()
    else:
        try:
            _finish(db, checkout)
        except PaymentError:
            pass  # the app re-checks the status when it gets control back
    return RedirectResponse(app_redirect(checkout), status_code=status.HTTP_303_SEE_OTHER)


@router.get("/card-checkout/{checkout_id}", response_model=CardCheckoutState)
def card_checkout_state(checkout_id: int, db: Session = Depends(get_db),
                        user: User = Depends(get_current_user)) -> CardCheckoutState:
    checkout = db.get(CardCheckout, checkout_id)
    if checkout is None or checkout.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Checkout not found.")
    try:
        _finish(db, checkout)  # in case the browser was closed before Stripe redirected back
    except PaymentError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from None
    orders = [db.get(Order, oid) for oid in load_ids(checkout.order_ids)]
    return CardCheckoutState(
        checkout_id=checkout.id,
        status=checkout.status,
        message=checkout.message,
        orders=[order_out(o) for o in orders if o is not None],
    )

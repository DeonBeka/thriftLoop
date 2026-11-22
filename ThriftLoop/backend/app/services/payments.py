"""Card payments with Stripe in TEST mode (a demo: no real money ever moves).

Flow:
  1. The app asks for a card checkout. We check the items, save the delivery details in a CardCheckout
     and create a Stripe Checkout Session (Stripe's hosted, PCI-compliant card page).
  2. The buyer pays on that page. Stripe sends the browser back to /payments/return on this API.
  3. We ask Stripe directly whether the session is paid (never trusting the redirect alone), then create
     the orders all-or-nothing. If an item sold to someone else meanwhile, the payment is refunded.

Only `sk_test_` keys are accepted, so a live key can't accidentally charge real cards.
"""

from __future__ import annotations

import json
import logging
from urllib.parse import urlencode, urlparse

import stripe
from stripe import StripeClient

from app.core.config import settings
from app.models import CardCheckout, Order

logger = logging.getLogger("thriftloop.payments")

CURRENCY = "eur"
MIN_AMOUNT_CENTS = 50  # Stripe's minimum charge in EUR


class PaymentError(Exception):
    """A payment problem with a message that's safe to show the buyer."""


def card_payments_enabled() -> bool:
    return settings.stripe_secret_key.startswith("sk_test_")


def _client() -> StripeClient:
    if not card_payments_enabled():
        raise PaymentError("Card payments aren't set up on this server.")
    return StripeClient(settings.stripe_secret_key)


def to_cents(price: float) -> int:
    return round(price * 100)


def safe_return_url(url: str) -> bool:
    """Where the app wants to land after paying: the Expo Go / app scheme, or the local web preview only."""
    parsed = urlparse(url)
    if parsed.scheme in ("exp", "exps", "thriftloop"):
        return True
    return parsed.scheme in ("http", "https") and parsed.hostname in ("localhost", "127.0.0.1")


def app_redirect(checkout: CardCheckout) -> str:
    sep = "&" if "?" in checkout.app_return_url else "?"
    return f"{checkout.app_return_url}{sep}{urlencode({'checkout_id': checkout.id, 'status': checkout.status})}"


def create_hosted_session(line_items: list[tuple[str, int]], back_url: str, reference: str,
                          metadata: dict[str, str]) -> tuple[str, str]:
    """Create a Stripe Checkout Session. Stripe sends the browser to `back_url` (+ session_id or cancelled=1).

    Returns (session_id, hosted_page_url).
    """
    if sum(cents for _, cents in line_items) < MIN_AMOUNT_CENTS:
        raise PaymentError("Card payments need a total of at least €0.50.")
    sep = "&" if "?" in back_url else "?"
    try:
        session = _client().v1.checkout.sessions.create(params={
            "mode": "payment",
            "line_items": [
                {"quantity": 1, "price_data": {"currency": CURRENCY, "unit_amount": cents, "product_data": {"name": title[:250]}}}
                for title, cents in line_items
            ],
            "success_url": back_url + sep + "session_id={CHECKOUT_SESSION_ID}",
            "cancel_url": back_url + sep + "cancelled=1",
            "client_reference_id": reference,
            "metadata": metadata,
        })
    except stripe.StripeError as exc:
        logger.warning("Stripe session create failed: %s", exc.user_message or type(exc).__name__)
        raise PaymentError("Couldn't start the card payment. Please try again in a moment.") from None
    return session.id, session.url


def create_session(checkout: CardCheckout, line_items: list[tuple[str, int]], api_base: str) -> str:
    """Basket checkout session; returns the hosted payment page URL."""
    if checkout.amount_cents < MIN_AMOUNT_CENTS:
        raise PaymentError("Card payments need a total of at least €0.50.")
    back = f"{api_base.rstrip('/')}/payments/return?checkout_id={checkout.id}"
    session_id, url = create_hosted_session(
        line_items, back, str(checkout.id), {"card_checkout_id": str(checkout.id), "user_id": str(checkout.user_id)},
    )
    checkout.stripe_session_id = session_id
    return url


def app_redirect_url(base: str, params: dict) -> str:
    """Append query params to the app's return URL."""
    sep = "&" if "?" in base else "?"
    return f"{base}{sep}{urlencode(params)}"


def session_payment(session_id: str) -> tuple[bool, str | None]:
    """(paid?, payment_intent_id) straight from Stripe."""
    try:
        session = _client().v1.checkout.sessions.retrieve(session_id)
    except stripe.StripeError as exc:
        logger.warning("Stripe session retrieve failed: %s", exc.user_message or type(exc).__name__)
        raise PaymentError("Couldn't check the payment with Stripe. Please try again.") from None
    intent = session.payment_intent
    intent_id = intent if isinstance(intent, str) or intent is None else intent.id
    return session.payment_status == "paid", intent_id


def refund(payment_intent: str, amount_cents: int | None = None) -> None:
    params: dict = {"payment_intent": payment_intent}
    if amount_cents is not None:
        params["amount"] = amount_cents
    try:
        _client().v1.refunds.create(params=params)
    except stripe.StripeError as exc:
        logger.warning("Stripe refund failed: %s", exc.user_message or type(exc).__name__)
        raise PaymentError("Couldn't refund the card payment right now. Please try again in a moment.") from None


def refund_order(order: Order) -> None:
    """Refund one card-paid order: its item and delivery (a basket payment can cover several orders)."""
    if not order.stripe_payment_intent:
        raise PaymentError("This order has no card payment to refund.")
    refund(order.stripe_payment_intent, to_cents(order.price + (order.delivery_fee or 0)))


def load_ids(raw: str | None) -> list[int]:
    return [int(x) for x in json.loads(raw)] if raw else []

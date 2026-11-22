"""Card checkout with a fake Stripe (no network): pay, verify, refunds, cancellations."""

from types import SimpleNamespace
from urllib.parse import parse_qs, urlparse

from app.core.config import settings
from app.services import payments
from tests.test_api import _png, _register_and_verify, capture_emails, client, make_seller  # noqa: F401
from tests.test_roles_orders import LISTING, auth


class FakeStripe:
    """Just enough of StripeClient for the flow: sessions.create/retrieve and refunds.create."""

    def __init__(self):
        self.sessions: dict[str, dict] = {}
        self.refunds: list[dict] = []
        outer = self

        class Sessions:
            def create(self, params):
                sid = f"cs_test_{len(outer.sessions) + 1}"
                outer.sessions[sid] = {"params": params, "paid": False}
                return SimpleNamespace(id=sid, url=f"https://checkout.stripe.test/{sid}")

            def retrieve(self, sid):
                s = outer.sessions[sid]
                return SimpleNamespace(payment_status="paid" if s["paid"] else "unpaid",
                                       payment_intent="pi_test_" + sid if s["paid"] else None)

        class Refunds:
            def create(self, params):
                outer.refunds.append(params)

        self.v1 = SimpleNamespace(checkout=SimpleNamespace(sessions=Sessions()), refunds=Refunds())


DETAILS = {"delivery_name": "Card Buyer", "phone": "+38344555444", "address_text": "Rr. Garibaldi 3, Prishtina",
           "accept_terms": True, "return_url": "exp://192.168.0.30:8081/--/checkout/complete"}


def _setup(client, monkeypatch, name):  # noqa: F811
    fake = FakeStripe()
    monkeypatch.setattr(settings, "stripe_secret_key", "sk_test_fake")
    monkeypatch.setattr(payments, "StripeClient", lambda key: fake)
    seller = auth(_register_and_verify(client, f"{name}s", f"{name}s@gmail.com"))
    make_seller(client, seller)
    buyer = auth(_register_and_verify(client, f"{name}b", f"{name}b@gmail.com"))
    files = [("images", ("a.png", _png(), "image/png"))]
    items = [client.post("/products", data=LISTING, files=files, headers=seller).json() for _ in range(2)]
    return fake, seller, buyer, items


def test_card_payments_off_without_test_key(client, monkeypatch):  # noqa: F811
    monkeypatch.setattr(settings, "stripe_secret_key", "")
    assert client.get("/payments/info").json()["card_enabled"] is False
    monkeypatch.setattr(settings, "stripe_secret_key", "sk_live_realmoney")
    assert client.get("/payments/info").json()["card_enabled"] is False  # live keys are never used


def test_pay_by_card_creates_paid_orders(client, monkeypatch):  # noqa: F811
    fake, seller, buyer, items = _setup(client, monkeypatch, "card1")
    ids = [p["id"] for p in items]

    bad = client.post("/payments/card-checkout", json={**DETAILS, "product_ids": ids, "return_url": "https://evil.example/x"},
                      headers=buyer)
    assert bad.status_code == 422  # can't bounce buyers to arbitrary sites

    r = client.post("/payments/card-checkout", json={**DETAILS, "product_ids": ids}, headers=buyer)
    assert r.status_code == 201, r.text
    started = r.json()
    assert started["url"].startswith("https://checkout.stripe.test/")
    sid = next(iter(fake.sessions))
    params = fake.sessions[sid]["params"]
    assert params["mode"] == "payment" and len(params["line_items"]) == 2
    assert params["line_items"][0]["price_data"] == {"currency": "eur", "unit_amount": 6000, "product_data": {"name": "Wool Coat"}}

    # Not paid yet: nothing is ordered and the items stay on sale.
    state = client.get(f"/payments/card-checkout/{started['checkout_id']}", headers=buyer).json()
    assert state["status"] == "pending" and state["orders"] == []
    assert client.get(f"/products/{ids[0]}").json()["status"] == "active"

    # Buyer pays; Stripe redirects back; we verify with Stripe and hand back to the app.
    fake.sessions[sid]["paid"] = True
    r = client.get(f"/payments/return?checkout_id={started['checkout_id']}&session_id={sid}", follow_redirects=False)
    assert r.status_code == 303
    target = urlparse(r.headers["location"])
    assert target.scheme == "exp" and parse_qs(target.query)["status"] == ["paid"]

    state = client.get(f"/payments/card-checkout/{started['checkout_id']}", headers=buyer).json()
    assert state["status"] == "paid" and len(state["orders"]) == 2
    order = state["orders"][0]
    assert order["payment_method"] == "card" and order["payment_status"] == "paid"
    assert client.get(f"/products/{ids[0]}").json()["status"] == "reserved"
    # Visiting the return link again doesn't create duplicate orders.
    client.get(f"/payments/return?checkout_id={started['checkout_id']}&session_id={sid}", follow_redirects=False)
    assert len(client.get("/orders?role=buyer", headers=buyer).json()) == 2

    # Cancelling a card-paid order refunds just that item and puts it back on sale.
    r = client.post(f"/orders/{order['id']}/status", json={"status": "cancelled"}, headers=buyer)
    assert r.status_code == 200 and r.json()["payment_status"] == "refunded"
    assert fake.refunds == [{"payment_intent": f"pi_test_{sid}", "amount": 6000}]
    assert client.get(f"/products/{order['product_id']}").json()["status"] == "active"


def test_item_sold_during_payment_is_refunded(client, monkeypatch):  # noqa: F811
    fake, seller, buyer, items = _setup(client, monkeypatch, "card2")
    ids = [p["id"] for p in items]
    started = client.post("/payments/card-checkout", json={**DETAILS, "product_ids": ids}, headers=buyer).json()
    sid = next(iter(fake.sessions))

    # Someone else buys one item (cash) while our buyer is on the card page.
    other = auth(_register_and_verify(client, "card2o", "card2o@gmail.com"))
    client.post("/orders/checkout", json={**{k: v for k, v in DETAILS.items() if k != "return_url"},
                                          "product_ids": [ids[1]]}, headers=other)

    fake.sessions[sid]["paid"] = True
    state = client.get(f"/payments/card-checkout/{started['checkout_id']}", headers=buyer).json()
    assert state["status"] == "refunded" and state["orders"] == []
    assert "refunded in full" in state["message"]
    assert fake.refunds == [{"payment_intent": f"pi_test_{sid}"}]
    assert client.get(f"/products/{ids[0]}").json()["status"] == "active"  # untouched


def test_cancel_on_stripe_page(client, monkeypatch):  # noqa: F811
    fake, seller, buyer, items = _setup(client, monkeypatch, "card3")
    started = client.post("/payments/card-checkout", json={**DETAILS, "product_ids": [items[0]["id"]]}, headers=buyer).json()
    r = client.get(f"/payments/return?checkout_id={started['checkout_id']}&cancelled=1", follow_redirects=False)
    assert parse_qs(urlparse(r.headers["location"]).query)["status"] == ["cancelled"]
    state = client.get(f"/payments/card-checkout/{started['checkout_id']}", headers=buyer).json()
    assert state["status"] == "cancelled" and state["orders"] == []
    # Another user can't peek at someone's checkout.
    seller_view = client.get(f"/payments/card-checkout/{started['checkout_id']}", headers=seller)
    assert seller_view.status_code == 404

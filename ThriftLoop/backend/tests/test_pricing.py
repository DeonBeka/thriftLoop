"""ThriftLoop fees: 10% commission from the seller, 5% of delivery, delivery free in Prishtina / €2 elsewhere."""

from urllib.parse import urlparse

from app.core.config import settings
from app.services import payments
from app.services.pricing import fees_per_item, normalize_city, order_money
from tests.test_api import _png, _register_and_verify, admin_token, capture_emails, client, make_seller  # noqa: F401
from tests.test_payments import FakeStripe
from tests.test_roles_orders import LISTING, auth


def test_money_maths():
    m = order_money(60, 2)
    assert (m.price, m.delivery_fee, m.commission, m.delivery_commission) == (60, 2, 6, 0.1)
    assert m.seller_payout == 55.9 and m.buyer_total == 62 and m.platform_total == 6.1
    free = order_money(19.99, 0)
    assert free.commission == 2.0 and free.delivery_commission == 0 and free.seller_payout == 17.99
    # Delivery once per seller; free in Prishtina.
    assert fees_per_item([1, 1, 2], "Ferizaj") == [2.0, 0.0, 2.0]
    assert fees_per_item([1, 2], "Prishtina") == [0.0, 0.0]
    assert normalize_city(" pristina ") == "Prishtina" and normalize_city("Gjakova") == "Gjakova"
    assert normalize_city("Tirana") is None


def _shop(client, name, count=2):  # noqa: F811
    seller = auth(_register_and_verify(client, f"{name}s", f"{name}s@gmail.com"))
    make_seller(client, seller)
    files = [("images", ("a.png", _png(), "image/png"))]
    items = [client.post("/products", data=LISTING, files=files, headers=seller).json() for _ in range(count)]
    return seller, items


DETAILS = {"delivery_name": "Fee Buyer", "phone": "+38344111000", "address_text": "Rr. Adem Jashari 1",
           "accept_terms": True}


def test_checkout_fees_and_admin_earnings(client):  # noqa: F811
    seller_a, a_items = _shop(client, "feea", 2)
    seller_b, b_items = _shop(client, "feeb", 1)
    buyer = auth(_register_and_verify(client, "feebuyer", "feebuyer@gmail.com"))
    admin = auth(admin_token(client))
    before = client.get("/admin/stats", headers=admin).json()

    pricing = client.get("/orders/pricing").json()
    assert pricing["free_delivery_city"] == "Prishtina" and pricing["delivery_fee"] == 2.0
    assert pricing["commission_rate"] == 0.1 and "Prizren" in pricing["cities"]

    ids = [p["id"] for p in a_items + b_items]
    assert client.post("/orders/checkout", json={**DETAILS, "product_ids": ids, "city": "Tirana"},
                       headers=buyer).status_code == 422  # only Kosovo
    r = client.post("/orders/checkout", json={**DETAILS, "product_ids": ids, "city": "ferizaj"}, headers=buyer)
    assert r.status_code == 201, r.text
    orders = r.json()
    # Two sellers outside Prishtina -> €2 delivery each, charged once per seller.
    assert [o["delivery_fee"] for o in orders] == [2.0, 0.0, 2.0]
    assert all(o["city"] == "Ferizaj" for o in orders)
    first = orders[0]
    # Buyer pays price + delivery; the 10% commission is not added for the buyer.
    assert first["price"] == 60 and first["total"] == 62
    assert (first["commission"], first["delivery_commission"], first["seller_payout"]) == (6.0, 0.1, 55.9)
    assert orders[1]["seller_payout"] == 54.0  # no delivery on the 2nd item from the same seller

    # Earnings count once an order is delivered.
    mid = client.get("/admin/stats", headers=admin).json()
    assert round(mid["earned_pending"] - before["earned_pending"], 2) == 6.1 + 6.0 + 6.1
    for o in orders[:2]:
        client.post(f"/orders/{o['id']}/status", json={"status": "confirmed"}, headers=seller_a)
        client.post(f"/orders/{o['id']}/status", json={"status": "delivered"}, headers=seller_a)
    after = client.get("/admin/stats", headers=admin).json()
    assert round(after["earned"] - before["earned"], 2) == 12.1
    assert round(after["sales_volume"] - before["sales_volume"], 2) == 122.0
    assert after["delivered_orders"] - before["delivered_orders"] == 2
    assert client.get("/admin/stats", headers=buyer).status_code == 403

    # Free delivery in Prishtina.
    _, c_items = _shop(client, "feec", 1)
    o = client.post("/orders/checkout", json={**DETAILS, "product_ids": [c_items[0]["id"]], "city": "Prishtina"},
                    headers=buyer).json()[0]
    assert o["delivery_fee"] == 0 and o["total"] == 60 and o["seller_payout"] == 54.0


def test_card_payment_charges_delivery_and_refunds_it(client, monkeypatch):  # noqa: F811
    fake = FakeStripe()
    monkeypatch.setattr(settings, "stripe_secret_key", "sk_test_fake")
    monkeypatch.setattr(payments, "StripeClient", lambda key: fake)
    _, items = _shop(client, "feed", 1)
    buyer = auth(_register_and_verify(client, "feedbuyer", "feedbuyer@gmail.com"))

    body = {**DETAILS, "product_ids": [items[0]["id"]], "city": "Peja", "return_url": "exp://10.0.0.2:8081/--/checkout/complete"}
    started = client.post("/payments/card-checkout", json=body, headers=buyer).json()
    sid = next(iter(fake.sessions))
    lines = fake.sessions[sid]["params"]["line_items"]
    assert [ln["price_data"]["unit_amount"] for ln in lines] == [6000, 200]  # item + €2 delivery to Peja
    assert lines[1]["price_data"]["product_data"]["name"].startswith("Delivery to Peja")

    fake.sessions[sid]["paid"] = True
    r = client.get(f"/payments/return?checkout_id={started['checkout_id']}&session_id={sid}", follow_redirects=False)
    assert urlparse(r.headers["location"]).scheme == "exp"
    order = client.get(f"/payments/card-checkout/{started['checkout_id']}", headers=buyer).json()["orders"][0]
    assert order["delivery_fee"] == 2.0 and order["total"] == 62 and order["payment_status"] == "paid"

    client.post(f"/orders/{order['id']}/status", json={"status": "cancelled"}, headers=buyer)
    assert fake.refunds[-1] == {"payment_intent": f"pi_test_{sid}", "amount": 6200}  # item + delivery back

"""Paid promotions: plans, Stripe-verified activation, featured slideshow, stacking, admin ad revenue."""

from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlparse

from app.core.config import settings
from app.database import SessionLocal
from app.models import Promotion
from app.services import payments
from tests.test_api import _png, _register_and_verify, admin_token, capture_emails, client, make_seller  # noqa: F401
from tests.test_payments import FakeStripe
from tests.test_roles_orders import LISTING, auth

RETURN = "exp://10.0.0.2:8081/--/promote/complete"


def test_boost_flow(client, monkeypatch):  # noqa: F811
    fake = FakeStripe()
    monkeypatch.setattr(settings, "stripe_secret_key", "sk_test_fake")
    monkeypatch.setattr(payments, "StripeClient", lambda key: fake)
    seller = auth(_register_and_verify(client, "promoseller", "promoseller@gmail.com"))
    make_seller(client, seller)
    other = auth(_register_and_verify(client, "promoother", "promoother@gmail.com"))
    admin = auth(admin_token(client))
    files = [("images", ("a.png", _png(), "image/png"))]
    item = client.post("/products", data=LISTING, files=files, headers=seller).json()
    before = client.get("/admin/stats", headers=admin).json()

    plans = {p["id"]: p for p in client.get("/promotions/plans").json()}
    assert plans["boost_7"] == {"id": "boost_7", "days": 7, "price": 3.99, "label": "7 days"}

    body = {"product_id": item["id"], "plan": "boost_7", "return_url": RETURN}
    assert client.post("/promotions/checkout", json=body, headers=other).status_code == 404  # not your listing
    assert client.post("/promotions/checkout", json={**body, "plan": "forever"}, headers=seller).status_code == 422
    assert client.post("/promotions/checkout", json={**body, "return_url": "https://evil.example"}, headers=seller).status_code == 422

    started = client.post("/promotions/checkout", json=body, headers=seller).json()
    sid = next(iter(fake.sessions))
    line = fake.sessions[sid]["params"]["line_items"][0]["price_data"]
    assert line["unit_amount"] == 399 and "Wool Coat" in line["product_data"]["name"]

    # Not paid yet: not featured.
    featured_ids = [f["product"]["id"] for f in client.get("/promotions/featured").json()]
    assert item["id"] not in featured_ids
    assert client.get(f"/promotions/{started['promotion_id']}", headers=seller).json()["status"] == "pending"

    # Paid -> active for 7 days and in the slideshow.
    fake.sessions[sid]["paid"] = True
    r = client.get(f"/promotions/return?promotion_id={started['promotion_id']}&session_id={sid}", follow_redirects=False)
    assert parse_qs(urlparse(r.headers["location"]).query)["status"] == ["active"]
    promo = client.get(f"/promotions/{started['promotion_id']}", headers=seller).json()
    ends = datetime.fromisoformat(promo["ends_at"].replace("Z", "+00:00"))
    if ends.tzinfo is None:
        ends = ends.replace(tzinfo=timezone.utc)
    assert promo["status"] == "active" and timedelta(days=6, hours=23) < ends - datetime.now(timezone.utc) <= timedelta(days=7)
    featured = client.get("/promotions/featured").json()
    assert featured[0]["product"]["id"] == item["id"]  # newest boost first

    # A second boost stacks after the first one (paid days are never lost).
    started2 = client.post("/promotions/checkout", json={**body, "plan": "boost_3"}, headers=seller).json()
    sid2 = list(fake.sessions)[-1]
    fake.sessions[sid2]["paid"] = True
    promo2 = client.get(f"/promotions/{started2['promotion_id']}", headers=seller).json()
    assert promo2["starts_at"][:16] == promo["ends_at"][:16]
    assert [p["product"]["id"] for p in client.get("/promotions/featured").json()].count(item["id"]) == 1
    assert len(client.get("/promotions/mine", headers=seller).json()) == 2

    # ThriftLoop's ad revenue.
    after = client.get("/admin/stats", headers=admin).json()
    assert round(after["ad_revenue"] - before["ad_revenue"], 2) == 5.98

    # Sold items leave the slideshow; expired boosts too.
    client.put(f"/products/{item['id']}", data={"status": "sold"}, headers=seller)
    assert item["id"] not in [f["product"]["id"] for f in client.get("/promotions/featured").json()]


def test_cancelled_and_expired_promotions(client, monkeypatch):  # noqa: F811
    fake = FakeStripe()
    monkeypatch.setattr(settings, "stripe_secret_key", "sk_test_fake")
    monkeypatch.setattr(payments, "StripeClient", lambda key: fake)
    seller = auth(_register_and_verify(client, "promoseller2", "promoseller2@gmail.com"))
    make_seller(client, seller)
    item = client.post("/products", data=LISTING, files=[("images", ("a.png", _png(), "image/png"))], headers=seller).json()

    started = client.post("/promotions/checkout", json={"product_id": item["id"], "plan": "boost_3", "return_url": RETURN},
                          headers=seller).json()
    r = client.get(f"/promotions/return?promotion_id={started['promotion_id']}&cancelled=1", follow_redirects=False)
    assert parse_qs(urlparse(r.headers["location"]).query)["status"] == ["cancelled"]

    with SessionLocal() as db:  # a boost that already ran out
        db.add(Promotion(product_id=item["id"], seller_id=item["seller"]["id"], plan="boost_3", price=1.99, status="active",
                         starts_at=datetime.now(timezone.utc) - timedelta(days=4),
                         ends_at=datetime.now(timezone.utc) - timedelta(days=1)))
        db.commit()
    assert item["id"] not in [f["product"]["id"] for f in client.get("/promotions/featured").json()]
    states = {p["status"] for p in client.get("/promotions/mine", headers=seller).json()}
    assert states == {"cancelled", "expired"}

    # Without Stripe configured, boosts are unavailable (no free promotion).
    monkeypatch.setattr(settings, "stripe_secret_key", "")
    r = client.post("/promotions/checkout", json={"product_id": item["id"], "plan": "boost_3", "return_url": RETURN},
                    headers=seller)
    assert r.status_code == 503

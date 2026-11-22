from tests.test_api import _png, _register_and_verify, admin_token, capture_emails, client, make_seller  # noqa: F401


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


LISTING = {"title": "Wool Coat", "description": "Warm grey wool coat, barely worn.", "price": "60",
           "category": "Jackets", "size": "M", "condition": "Like new"}


def test_terms_required(client):
    r = client.post("/auth/register", json={"username": "noterms", "email": "noterms@gmail.com",
                                            "password": "password123", "confirm_password": "password123"})
    assert r.status_code == 422 and "Terms" in r.json()["detail"]


def test_roles_and_seller_verification(client):
    viewer = auth(_register_and_verify(client, "viewer1", "viewer1@gmail.com"))
    me = client.get("/auth/me", headers=viewer).json()
    assert me["role"] == "viewer" and me["seller_status"] == "none" and me["terms_accepted_at"]

    # Viewers can't list.
    files = [("images", ("a.png", _png(), "image/png"))]
    assert client.post("/products", data=LISTING, files=files, headers=viewer).status_code == 403

    # Apply: selfie AND an official photo ID are required, seller terms must be accepted.
    base = {"full_name": "View Er", "phone": "+38344000111", "city": "Prizren", "accept_seller_terms": "true"}
    selfie_only = {"selfie": ("s.png", _png(), "image/png")}
    both = {"selfie": ("s.png", _png(), "image/png"), "id_document": ("id.png", _png(), "image/png")}
    assert client.post("/seller-applications", data=base, headers=viewer).status_code == 422
    r = client.post("/seller-applications", data={**base, "id_document_type": "passport"}, files=selfie_only, headers=viewer)
    assert r.status_code == 422 and "ID card" in r.json()["detail"]  # no ID photo
    r = client.post("/seller-applications", data=base, files=both, headers=viewer)
    assert r.status_code == 422 and "Choose" in r.json()["detail"]  # no document type
    r = client.post("/seller-applications", data={**base, "id_document_type": "library_card"}, files=both, headers=viewer)
    assert r.status_code == 422
    r = client.post("/seller-applications", data={**base, "id_document_type": "drivers_license"}, files=both, headers=viewer)
    assert r.status_code == 201 and r.json()["status"] == "pending"
    assert r.json()["has_id_document"] and r.json()["id_document_label"] == "Driver's licence"
    app_id = r.json()["id"]
    assert client.post("/seller-applications", data={**base, "id_document_type": "passport"}, files=both,
                       headers=viewer).status_code == 409
    assert client.get("/auth/me", headers=viewer).json()["seller_status"] == "pending"

    # Only admins see applications and selfies; selfies are not public files.
    assert client.get("/admin/applications", headers=viewer).status_code == 403
    admin = auth(admin_token(client))
    assert client.get("/auth/me", headers=admin).json()["role"] == "admin"
    pending = client.get("/admin/applications", headers=admin).json()
    assert any(a["id"] == app_id and a["user_email"] == "viewer1@gmail.com" for a in pending)
    selfie = client.get(f"/admin/applications/{app_id}/selfie", headers=admin)
    assert selfie.status_code == 200 and selfie.headers["content-type"] == "image/jpeg"
    assert client.get(f"/admin/applications/{app_id}/selfie", headers=viewer).status_code == 403

    # Reject needs a reason; approve turns the viewer into a seller.
    assert client.post(f"/admin/applications/{app_id}/reject", json={}, headers=admin).status_code == 422
    assert client.post(f"/admin/applications/{app_id}/approve", json={}, headers=admin).status_code == 200
    assert client.get("/auth/me", headers=viewer).json()["role"] == "seller"
    assert client.post("/products", data=LISTING, files=files, headers=viewer).status_code == 201

    # Admin can't be granted through the API.
    users = client.get("/admin/users", headers=admin).json()
    target = next(u for u in users if u["username"] == "viewer1")
    assert client.patch(f"/admin/users/{target['id']}/role", json={"role": "admin"}, headers=admin).status_code == 422
    stats = client.get("/admin/stats", headers=admin).json()
    assert stats["sellers"] >= 1


def test_cash_on_delivery_order_flow(client):
    seller = auth(_register_and_verify(client, "seller2", "seller2@gmail.com"))
    make_seller(client, seller)
    buyer = auth(_register_and_verify(client, "buyer2", "buyer2@gmail.com"))
    product = client.post("/products", data=LISTING, files=[("images", ("a.png", _png(), "image/png"))],
                          headers=seller).json()

    order_body = {"product_id": product["id"], "delivery_name": "Buyer Two", "phone": "+38344999888",
                  "address_text": "Rr. Nena Tereze 12, Prishtina", "city": "Prishtina", "latitude": 42.66, "longitude": 21.16}
    assert client.post("/orders", json=order_body, headers=buyer).status_code == 422  # terms not accepted
    assert client.post("/orders", json={**order_body, "accept_terms": True}, headers=seller).status_code == 400  # own item
    r = client.post("/orders", json={**order_body, "accept_terms": True}, headers=buyer)
    assert r.status_code == 201, r.text
    order = r.json()
    assert order["payment_method"] == "cash_on_delivery" and order["status"] == "pending"
    assert client.get(f"/products/{product['id']}").json()["status"] == "reserved"
    # Reserved items are off the marketplace and can't be ordered twice.
    assert client.post("/orders", json={**order_body, "accept_terms": True}, headers=buyer).status_code == 409

    # The order shows up for both sides, and a chat message is posted.
    assert client.get("/orders?role=seller", headers=seller).json()[0]["id"] == order["id"]
    assert client.get("/conversations", headers=seller).json()[0]["last_message"]["content"].startswith("🛍️")

    # Buyer can't confirm; seller confirms then marks delivered → product sold.
    assert client.post(f"/orders/{order['id']}/status", json={"status": "confirmed"}, headers=buyer).status_code == 409
    assert client.post(f"/orders/{order['id']}/status", json={"status": "confirmed"}, headers=seller).status_code == 200
    assert client.post(f"/orders/{order['id']}/status", json={"status": "delivered"}, headers=seller).status_code == 200
    assert client.get(f"/products/{product['id']}").json()["status"] == "sold"

    # Cancelling puts the item back on sale.
    p2 = client.post("/products", data=LISTING, files=[("images", ("a.png", _png(), "image/png"))], headers=seller).json()
    o2 = client.post("/orders", json={**order_body, "product_id": p2["id"], "accept_terms": True}, headers=buyer).json()
    assert client.post(f"/orders/{o2['id']}/status", json={"status": "cancelled"}, headers=buyer).status_code == 200
    assert client.get(f"/products/{p2['id']}").json()["status"] == "active"



def test_basket_checkout_is_all_or_nothing(client):
    seller = auth(_register_and_verify(client, "seller3", "seller3@gmail.com"))
    make_seller(client, seller)
    buyer = auth(_register_and_verify(client, "buyer3", "buyer3@gmail.com"))
    other = auth(_register_and_verify(client, "buyer4", "buyer4@gmail.com"))
    files = [("images", ("a.png", _png(), "image/png"))]
    a, b, c = (client.post("/products", data=LISTING, files=files, headers=seller).json() for _ in range(3))
    details = {"delivery_name": "Buyer Three", "phone": "+38344777666", "address_text": "Rr. Agim Ramadani 5, Prishtina", "city": "Prishtina"}

    assert client.post("/orders/checkout", json={**details, "product_ids": [a["id"]]}, headers=buyer).status_code == 422
    assert client.post("/orders/checkout", json={**details, "product_ids": [], "accept_terms": True},
                       headers=buyer).status_code == 422

    # Someone else orders C first: a basket with A + C places nothing, and A stays on sale.
    client.post("/orders/checkout", json={**details, "product_ids": [c["id"]], "accept_terms": True}, headers=other)
    r = client.post("/orders/checkout", json={**details, "product_ids": [a["id"], c["id"]], "accept_terms": True},
                    headers=buyer)
    assert r.status_code == 409 and "was just ordered" in r.json()["detail"]
    assert client.get(f"/products/{a['id']}").json()["status"] == "active"

    # A + B (duplicates ignored) -> two orders with the same delivery details, both items reserved.
    r = client.post("/orders/checkout", json={**details, "product_ids": [a["id"], b["id"], a["id"]], "accept_terms": True},
                    headers=buyer)
    assert r.status_code == 201, r.text
    orders = r.json()
    assert len(orders) == 2 and {o["product_id"] for o in orders} == {a["id"], b["id"]}
    assert all(o["address_text"] == details["address_text"] and o["status"] == "pending" for o in orders)
    assert client.get(f"/products/{b['id']}").json()["status"] == "reserved"
    # Can't buy your own items through the basket either.
    d = client.post("/products", data=LISTING, files=files, headers=seller).json()
    assert client.post("/orders/checkout", json={**details, "product_ids": [d["id"]], "accept_terms": True},
                       headers=seller).status_code == 400

def test_rate_limit(client, monkeypatch):
    from app.core.config import settings
    from app.core.rate_limit import limiter

    monkeypatch.setattr(settings, "rate_limit_enabled", True)
    monkeypatch.setattr(settings, "rate_limit_auth_per_minute", 3)
    limiter.reset()
    codes = [client.post("/auth/login", json={"email": "x@gmail.com", "password": "wrongpass1"}).status_code
             for _ in range(4)]
    assert codes[:3] == [401, 401, 401] and codes[3] == 429
    limiter.reset()

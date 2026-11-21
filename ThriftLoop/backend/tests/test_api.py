import io
import os
import re
import tempfile
from pathlib import Path

_tmp = Path(tempfile.mkdtemp())
os.environ["DATABASE_URL"] = f"sqlite:///{(_tmp / 'test.db').as_posix()}"
os.environ["UPLOAD_DIR"] = str(_tmp / "uploads")
os.environ["EMAIL_DEV_MODE"] = "true"
os.environ["REQUIRE_EMAIL_VERIFICATION"] = "true"  # most tests exercise the OTP flow
os.environ["JWT_SECRET_KEY"] = "test-secret-that-is-long-enough-for-hs256-signing"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image  # noqa: E402

from app.main import app  # noqa: E402
from app.services import email as email_service  # noqa: E402

sent_codes: dict[str, str] = {}


@pytest.fixture(autouse=True)
def capture_emails(monkeypatch):
    monkeypatch.setattr(
        "app.routers.auth.send_verification_email",
        lambda to, username, code: sent_codes.__setitem__(to, code),
    )
    yield


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def _png() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (40, 50), "#183D32").save(buf, "PNG")
    return buf.getvalue()


def _register_and_verify(client, username: str, email: str) -> str:
    r = client.post("/auth/register", json={
        "username": username, "email": email, "password": "password123", "confirm_password": "password123"})
    assert r.status_code == 201, r.text
    r = client.post("/auth/verify-email", json={"email": email, "code": sent_codes[email]})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def test_registration_and_otp_rules(client, monkeypatch):
    r = client.post("/auth/register", json={
        "username": "bob", "email": "bob@yahoo.com", "password": "password123", "confirm_password": "password123"})
    assert r.status_code == 400  # Gmail only

    r = client.post("/auth/register", json={
        "username": "bob", "email": "bob@gmail.com", "password": "password123", "confirm_password": "nope12345"})
    assert r.status_code == 422 and "match" in r.json()["detail"]

    r = client.post("/auth/register", json={
        "username": "bob", "email": "bob@gmail.com", "password": "password123", "confirm_password": "password123"})
    assert r.status_code == 201
    code = sent_codes["bob@gmail.com"]
    assert re.fullmatch(r"\d{6}", code)

    # Unverified users cannot log in.
    assert client.post("/auth/login", json={"email": "bob@gmail.com", "password": "password123"}).status_code == 403
    # Cooldown on resend.
    assert client.post("/auth/resend-code", json={"email": "bob@gmail.com"}).status_code == 429

    wrong = "000000" if code != "000000" else "111111"
    r = client.post("/auth/verify-email", json={"email": "bob@gmail.com", "code": wrong})
    assert r.status_code == 400 and "left" in r.json()["detail"]

    r = client.post("/auth/verify-email", json={"email": "bob@gmail.com", "code": code})
    assert r.status_code == 200
    token = r.json()["access_token"]
    # Single use.
    assert client.post("/auth/verify-email", json={"email": "bob@gmail.com", "code": code}).status_code == 400

    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200 and me.json()["is_verified"] is True
    assert client.post("/auth/login", json={"email": "bob@gmail.com", "password": "password123"}).status_code == 200
    assert client.post("/auth/login", json={"email": "bob@gmail.com", "password": "wrongpass1"}).status_code == 401


def test_verification_disabled_signs_in_immediately(client, monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "require_email_verification", False)
    sent_codes.pop("quick@gmail.com", None)
    r = client.post("/auth/register", json={
        "username": "quick", "email": "quick@gmail.com", "password": "password123", "confirm_password": "password123"})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["verification_required"] is False and body["access_token"] and body["user"]["is_verified"]
    assert "quick@gmail.com" not in sent_codes  # no email sent
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.status_code == 200
    assert client.post("/auth/login", json={"email": "quick@gmail.com", "password": "password123"}).status_code == 200


def test_attempt_limit(client):
    client.post("/auth/register", json={
        "username": "eve", "email": "eve@gmail.com", "password": "password123", "confirm_password": "password123"})
    code = sent_codes["eve@gmail.com"]
    wrong = "000000" if code != "000000" else "111111"
    statuses = [client.post("/auth/verify-email", json={"email": "eve@gmail.com", "code": wrong}).status_code
                for _ in range(5)]
    assert statuses[-1] == 429
    # Even the right code is now dead.
    assert client.post("/auth/verify-email", json={"email": "eve@gmail.com", "code": code}).status_code == 400


def test_marketplace_flow(client):
    seller = {"Authorization": f"Bearer {_register_and_verify(client, 'seller1', 'seller1@gmail.com')}"}
    buyer = {"Authorization": f"Bearer {_register_and_verify(client, 'buyer1', 'buyer1@gmail.com')}"}

    form = {"title": "Green Hoodie", "description": "A lovely green hoodie.", "price": "30",
            "category": "Hoodies", "size": "M", "condition": "Good"}
    files = [("images", ("a.png", _png(), "image/png")), ("images", ("b.png", _png(), "image/png"))]
    r = client.post("/products", data=form, files=files, headers=seller)
    assert r.status_code == 201, r.text
    product = r.json()
    assert len(product["images"]) == 2
    assert client.get(product["images"][0]["url"]).status_code == 200

    assert client.post("/products", data=form, headers=seller).status_code == 422  # needs photos
    assert client.post("/products", data=form, files=files).status_code == 401  # needs auth

    r = client.get("/products", params={"q": "hoodie", "size": "M", "max_price": 40, "sort": "price_asc"})
    assert any(p["id"] == product["id"] for p in r.json()["items"])
    assert client.get("/products", params={"min_price": 31}).json()["total"] == 0

    # Edit: drop one image, mark sold.
    keep = str(product["images"][1]["id"])
    r = client.put(f"/products/{product['id']}", data={"price": "25", "keep_image_ids": keep, "status": "sold"},
                   headers=seller)
    assert r.status_code == 200, r.text
    assert r.json()["price"] == 25 and len(r.json()["images"]) == 1 and r.json()["status"] == "sold"
    assert client.put(f"/products/{product['id']}", data={"price": "1"}, headers=buyer).status_code == 403
    client.put(f"/products/{product['id']}", data={"status": "active"}, headers=seller)

    # Favorites
    assert client.post(f"/favorites/{product['id']}", headers=buyer).status_code == 201
    favs = client.get("/favorites", headers=buyer).json()
    assert [p["id"] for p in favs] == [product["id"]] and favs[0]["is_favorited"]

    # Messaging
    r = client.post("/conversations", json={"product_id": product["id"], "message": "Still available?"},
                    headers=buyer)
    assert r.status_code == 200, r.text
    convo = r.json()
    assert convo["other_user"]["username"] == "seller1"
    seller_list = client.get("/conversations", headers=seller).json()
    assert seller_list[0]["unread_count"] == 1
    client.post(f"/conversations/{convo['id']}/messages", json={"content": "Yes!"}, headers=seller)
    msgs = client.get(f"/conversations/{convo['id']}/messages", headers=buyer).json()
    assert [m["content"] for m in msgs] == ["Still available?", "Yes!"]
    outsider = {"Authorization": f"Bearer {_register_and_verify(client, 'nosy', 'nosy@gmail.com')}"}
    assert client.get(f"/conversations/{convo['id']}/messages", headers=outsider).status_code == 404

    # Profile
    seller_id = convo["seller_id"]
    profile = client.get(f"/users/{seller_id}").json()
    assert profile["active_listings_count"] == 1
    r = client.put("/users/me", data={"bio": "Hello there"},
                   files={"profile_image": ("me.png", _png(), "image/png")}, headers=seller)
    assert r.status_code == 200 and r.json()["bio"] == "Hello there" and r.json()["profile_image"]

    # Delete: favorite disappears, conversation survives without product.
    assert client.delete(f"/products/{product['id']}", headers=seller).status_code == 204
    assert client.get("/favorites", headers=buyer).json() == []
    assert client.get(f"/conversations/{convo['id']}", headers=buyer).json()["product"] is None

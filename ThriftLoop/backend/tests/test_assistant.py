from app.database import SessionLocal
from app.models import Product, ProductImage, User
from app.services.assistant import SearchFilters, merge_follow_up, parse_rules
from tests.test_api import client  # noqa: F401  (shared app/DB fixture)


def test_parse_blue_tops_under_10_bucks():
    f = parse_rules("give me some blue tops under 10 bucks")
    assert f.colors == ["blue"]
    assert f.groups == ["tops"]
    assert f.max_price == 10
    assert f.min_price is None


def test_parse_specific_category_size_condition_and_sort():
    f = parse_rules("cheapest black jeans size W30, like new")
    assert f.categories == ["Jeans"] and f.groups == []
    assert f.colors == ["black"]
    assert f.sizes == ["W30"]
    assert f.conditions == ["Like new"]
    assert f.sort == "price_asc"


def test_parse_price_ranges_and_shoes():
    f = parse_rules("sneakers between 20 and 50 euros in EU 42")
    assert f.groups == ["shoes"] and f.sizes == ["EU 42"]
    assert (f.min_price, f.max_price) == (20, 50)
    assert parse_rules("pants over $30").min_price == 30
    assert parse_rules("pants over $30").groups == ["bottoms"]
    assert parse_rules("something cheap").max_price == 20


def test_follow_up_keeps_previous_request():
    previous = parse_rules("blue tops under 10 bucks")
    follow = merge_follow_up(parse_rules("what about under 20?"), previous, "what about under 20?")
    assert follow.colors == ["blue"] and follow.groups == ["tops"] and follow.max_price == 20


def _add(db, seller_id, title, category, price, size="M", status="active"):
    p = Product(seller_id=seller_id, title=title, description=f"A lovely {title.lower()}.", price=price,
                category=category, size=size, condition="Good", status=status)
    p.images = [ProductImage(image_path="https://example.com/x.jpg", display_order=0)]
    db.add(p)
    return p


def test_assistant_endpoint_filters_and_relaxes(client):  # noqa: F811
    with SessionLocal() as db:
        seller = User(username="asst_seller", email="asst_seller@gmail.com", hashed_password="x",
                      is_verified=True, role="seller")
        db.add(seller)
        db.flush()
        _add(db, seller.id, "Navy Blue Hoodie", "Hoodies", 8)
        _add(db, seller.id, "Light Blue Tee", "T-shirts", 25)
        _add(db, seller.id, "Blue Straight Jeans", "Jeans", 9)          # bottom, not a top
        _add(db, seller.id, "Red Tee", "T-shirts", 5)                   # wrong colour
        _add(db, seller.id, "Blue Sold Jacket", "Jackets", 4, status="sold")  # not available
        db.commit()

    r = client.post("/assistant/chat", json={"message": "give me some blue tops under 10 bucks"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["engine"] == "rules"  # no API key in tests
    titles = [p["title"] for p in body["products"]]
    assert titles == ["Navy Blue Hoodie"]
    assert all(p["price"] <= 10 and p["category"] in ("Hoodies", "T-shirts", "Jackets") for p in body["products"])
    assert body["filters"]["groups"] == ["tops"]

    # Nothing under €3 -> show the closest blue tops and say so.
    r = client.post("/assistant/chat", json={"message": "blue tops under 3 euros"})
    body = r.json()
    assert body["relaxed"] == "price"
    assert body["products"][0]["title"] == "Navy Blue Hoodie"
    assert "couldn’t find" in body["reply"]

    # Follow-up widens the budget but keeps "blue tops".
    previous = r.json()["filters"]
    r = client.post("/assistant/chat", json={"message": "what about under 30?", "previous": previous})
    titles = {p["title"] for p in r.json()["products"]}
    assert titles == {"Navy Blue Hoodie", "Light Blue Tee"}

    # Super-category filter on the regular listing endpoint.
    bottoms = client.get("/products", params={"group": "bottoms", "q": "Blue Straight"}).json()["items"]
    assert [p["title"] for p in bottoms] == ["Blue Straight Jeans"]
    assert client.get("/assistant/info").json()["ai_enabled"] is False


def test_pixel_analyser_reads_garment_colour():
    from PIL import Image, ImageDraw

    from app.services.vision import colors_from_pixels, name_color

    assert name_color(15, 15, 18) == "black"
    assert name_color(250, 250, 248) == "white"
    assert name_color(30, 60, 140) == "blue"
    assert name_color(200, 30, 40) == "red"

    # A black T-shirt shape on a white studio background.
    photo = Image.new("RGB", (400, 400), (245, 245, 245))
    ImageDraw.Draw(photo).rectangle((110, 80, 290, 360), fill=(20, 20, 22))
    assert colors_from_pixels(photo) == ["black"]

    # A navy hoodie on a beige wall.
    photo = Image.new("RGB", (400, 400), (225, 210, 185))
    ImageDraw.Draw(photo).rectangle((100, 70, 300, 370), fill=(25, 40, 95))
    assert colors_from_pixels(photo) == ["blue"]


def test_colour_seen_in_photo_counts_even_if_seller_did_not_write_it(client):  # noqa: F811
    with SessionLocal() as db:
        seller = User(username="photo_seller", email="photo_seller@gmail.com", hashed_password="x",
                      is_verified=True, role="seller")
        db.add(seller)
        db.flush()
        tee = _add(db, seller.id, "Classic Crew Tee", "T-shirts", 7)  # no colour in title/description
        tee.photo_colors = "black"
        other = _add(db, seller.id, "Plain Crew Tee", "T-shirts", 6)
        other.photo_colors = "white"
        db.commit()

    titles = [p["title"] for p in client.post("/assistant/chat", json={"message": "black t-shirts under 10"}).json()["products"]]
    assert "Classic Crew Tee" in titles
    assert "Plain Crew Tee" not in titles

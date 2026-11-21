"""Populate the database with demo users and listings.

Run from backend/:  python -m app.seed          (adds data if the DB is empty)
                    python -m app.seed --reset  (wipes the DB and uploads first)

Product photos are generated locally with Pillow (soft studio-style garment silhouettes),
so the demo works fully offline. Real listings use photos uploaded from the app.
"""

import random
import shutil
import sys
import uuid
from datetime import datetime, timedelta, timezone

from PIL import Image, ImageDraw, ImageFilter
from sqlalchemy import select

from app.core.config import settings
from app.core.security import hash_password
from app.database import Base, SessionLocal, engine, init_db
from app.models import Conversation, Favorite, Message, Product, ProductImage, User

DEMO_PASSWORD = "thriftloop123"

USERS = [
    ("maya.vintage", "maya.vintage@gmail.com", "Curating 90s denim and cosy knits. Ships within 2 days.", "#C9B8A6"),
    ("leo_threads", "leo.threads@gmail.com", "Streetwear lover clearing out my closet. Open to offers!", "#7E9C8C"),
    ("sofia.loops", "sofia.loops@gmail.com", "Slow fashion, small wardrobe. Everything is washed and steamed.", "#B6A2C4"),
    ("noah.archive", "noah.archive@gmail.com", "Outdoor gear and workwear. Pet-free, smoke-free home.", "#8FA3B8"),
]

# title, category, size, condition, price, colour, description
PRODUCTS = [
    ("Faded Carhartt Hoodie", "Hoodies", "L", "Good", 38, "#6B7A5E",
     "Heavyweight hoodie with a lovely sun-faded olive tone. Small mark on the cuff, otherwise solid."),
    ("Cream Knit Zip Hoodie", "Hoodies", "M", "Like new", 45, "#E8DFCF",
     "Soft cotton-blend zip hoodie in cream. Worn twice, no pilling. Relaxed fit."),
    ("Oversized Grey Hoodie", "Hoodies", "XL", "Fair", 18, "#9A9C9E",
     "Classic grey marl, super comfy. Some fading and a tiny hole near the pocket — priced to go."),
    ("Vintage Band Tee", "T-shirts", "M", "Good", 25, "#2F2F33",
     "Single-stitch black tee with cracked print. Boxy 90s cut, soft from years of wear."),
    ("Organic Cotton Basic Tee", "T-shirts", "S", "New with tags", 14, "#F3F1EC",
     "Bright white organic cotton tee, still with tags. Bought the wrong size."),
    ("Striped Breton Tee", "T-shirts", "XS", "Like new", 19, "#2D4B73",
     "Navy and white Breton stripes, long sleeve. Barely worn."),
    ("Waxed Field Jacket", "Jackets", "L", "Good", 85, "#5C5A3E",
     "Waxed cotton jacket with corduroy collar and tartan lining. Re-waxed last winter."),
    ("Denim Trucker Jacket", "Jackets", "M", "Like new", 55, "#4A6C93",
     "Mid-wash trucker jacket, classic fit. No fading or damage."),
    ("Black Puffer Jacket", "Jackets", "S", "Good", 60, "#1F2224",
     "Warm, lightweight puffer. Packs into its own pocket. One small repair on the sleeve."),
    ("Straight Leg 501s", "Jeans", "W32", "Good", 42, "#3E5C82",
     "Vintage 501s with a perfect mid-blue fade. L32. Button fly."),
    ("Light Wash Mom Jeans", "Jeans", "W28", "Like new", 36, "#9DB4CC",
     "High-rise mom jeans in a light vintage wash. Rigid denim, tapered leg."),
    ("Black Skinny Jeans", "Jeans", "W30", "Fair", 15, "#26282B",
     "Everyday black skinnies. Some fading on the knees."),
    ("Pleated Wool Trousers", "Trousers", "M", "Like new", 48, "#6F665C",
     "Taupe pleated trousers in a wool blend. Wide leg, falls beautifully."),
    ("Cargo Pants", "Trousers", "L", "Good", 32, "#7A7357",
     "Khaki ripstop cargos with lots of pockets. Adjustable ankle toggles."),
    ("Linen Drawstring Trousers", "Trousers", "S", "New with tags", 29, "#D9CDB8",
     "Breezy natural linen trousers. Never worn, tags attached."),
    ("White Leather Sneakers", "Shoes", "EU 42", "Good", 40, "#F1F0EB",
     "Minimal white leather sneakers. Cleaned and new laces added."),
    ("Suede Chelsea Boots", "Shoes", "EU 39", "Like new", 70, "#8A6A4C",
     "Tan suede Chelsea boots, worn a handful of times. Protected with spray."),
    ("Retro Running Shoes", "Shoes", "EU 44", "Fair", 22, "#B44D3B",
     "Red and grey retro runners. Soles have some wear but loads of life left."),
    ("Canvas Tote Bag", "Accessories", "One size", "Like new", 12, "#E4D7BE",
     "Heavy canvas tote with inner pocket. Fits a laptop."),
    ("Wool Beanie", "Accessories", "One size", "New with tags", 10, "#B6D4BE",
     "Ribbed merino beanie in sage green. Brand new."),
    ("Leather Crossbody Bag", "Accessories", "One size", "Good", 34, "#5B3A29",
     "Small brown leather crossbody with adjustable strap. Light scuffs."),
    ("Corduroy Cap", "Accessories", "One size", "Like new", 15, "#3F5A4C",
     "Forest green corduroy cap with brass buckle."),
]


def _shade(hex_colour: str, factor: float) -> tuple[int, int, int]:
    hex_colour = hex_colour.lstrip("#")
    r, g, b = (int(hex_colour[i : i + 2], 16) for i in (0, 2, 4))
    return tuple(max(0, min(255, int(c * factor))) for c in (r, g, b))  # type: ignore[return-value]


def _garment(draw: ImageDraw.ImageDraw, category: str, colour: tuple[int, int, int], w: int, h: int) -> None:
    cx = w // 2
    dark = tuple(int(c * 0.82) for c in colour)
    if category in ("Hoodies", "T-shirts", "Jackets"):
        long_sleeve = category != "T-shirts"
        top, bottom = int(h * 0.24), int(h * 0.80)
        body = [(cx - 170, top + 30), (cx - 60, top), (cx + 60, top), (cx + 170, top + 30),
                (cx + 150, bottom), (cx - 150, bottom)]
        if long_sleeve:
            ls = [(cx - 170, top + 30), (cx - 250, int(h * 0.72)), (cx - 195, int(h * 0.75)), (cx - 145, top + 140)]
            rs = [(cx + 170, top + 30), (cx + 250, int(h * 0.72)), (cx + 195, int(h * 0.75)), (cx + 145, top + 140)]
        else:
            ls = [(cx - 170, top + 30), (cx - 245, top + 130), (cx - 190, top + 170), (cx - 150, top + 120)]
            rs = [(cx + 170, top + 30), (cx + 245, top + 130), (cx + 190, top + 170), (cx + 150, top + 120)]
        draw.polygon(ls, fill=dark)
        draw.polygon(rs, fill=dark)
        draw.polygon(body, fill=colour)
        if category == "Hoodies":
            draw.ellipse([cx - 85, top - 70, cx + 85, top + 60], fill=dark)
            draw.ellipse([cx - 55, top - 35, cx + 55, top + 45], fill=_shade("#3a3a3a", 1))
            draw.rounded_rectangle([cx - 90, int(h * 0.60), cx + 90, int(h * 0.71)], 18, outline=dark, width=6)
        elif category == "Jackets":
            draw.line([(cx, top + 10), (cx, bottom)], fill=dark, width=6)
            draw.polygon([(cx - 60, top), (cx, top + 110), (cx - 95, top + 70)], fill=dark)
            draw.polygon([(cx + 60, top), (cx, top + 110), (cx + 95, top + 70)], fill=dark)
        else:
            draw.ellipse([cx - 55, top - 25, cx + 55, top + 35], fill=_shade("#F6F4EF", 0.97))
    elif category in ("Jeans", "Trousers"):
        top, bottom = int(h * 0.18), int(h * 0.86)
        draw.rectangle([cx - 140, top, cx + 140, top + 45], fill=dark)
        draw.polygon([(cx - 140, top + 40), (cx + 2, top + 40), (cx - 15, bottom), (cx - 130, bottom)], fill=colour)
        draw.polygon([(cx - 2, top + 40), (cx + 140, top + 40), (cx + 130, bottom), (cx + 15, bottom)], fill=colour)
        draw.line([(cx, top + 45), (cx, top + 150)], fill=dark, width=5)
    elif category == "Shoes":
        for dx, dy in ((-30, -50), (30, 70)):
            y = int(h * 0.50) + dy
            x = cx - 200 + dx
            draw.rounded_rectangle([x, y + 70, x + 400, y + 115], 22, fill=_shade("#FFFFFF", 0.93))
            draw.polygon([(x + 10, y + 75), (x + 60, y - 30), (x + 190, y - 40), (x + 250, y + 20),
                          (x + 390, y + 40), (x + 395, y + 80)], fill=colour)
            draw.line([(x + 120, y - 20), (x + 200, y + 40)], fill=dark, width=5)
    else:  # Accessories
        draw.rounded_rectangle([cx - 160, int(h * 0.38), cx + 160, int(h * 0.80)], 30, fill=colour)
        draw.arc([cx - 100, int(h * 0.20), cx + 100, int(h * 0.52)], 180, 360, fill=dark, width=16)


def make_product_image(category: str, hex_colour: str, variant: int) -> str:
    w, h = 900, 1125  # 4:5 like most marketplace photos
    bg_choices = ["#EFECE6", "#E9ECE7", "#F1EEEA", "#E6EAE6"]
    bg = _shade(bg_choices[variant % len(bg_choices)], 1)
    image = Image.new("RGB", (w, h), bg)
    shadow = Image.new("L", (w, h), 0)
    ImageDraw.Draw(shadow).ellipse([w * 0.2, h * 0.82, w * 0.8, h * 0.9], fill=70)
    image.paste(_shade("#9a978f", 1), mask=shadow.filter(ImageFilter.GaussianBlur(30)))
    colour = _shade(hex_colour, 1.0 - 0.06 * variant)
    _garment(ImageDraw.Draw(image), category, colour, w, h)
    if variant:
        image = image.rotate(4 * (1 if variant % 2 else -1), resample=Image.BICUBIC, fillcolor=bg)
    target = settings.upload_dir / "products"
    target.mkdir(parents=True, exist_ok=True)
    name = f"seed_{uuid.uuid4().hex[:12]}.jpg"
    image.save(target / name, "JPEG", quality=88)
    return f"products/{name}"


def make_avatar(username: str, hex_colour: str) -> str:
    size = 400
    image = Image.new("RGB", (size, size), _shade(hex_colour, 1))
    draw = ImageDraw.Draw(image)
    draw.ellipse([130, 80, 270, 220], fill=_shade(hex_colour, 0.78))
    draw.ellipse([60, 240, 340, 520], fill=_shade(hex_colour, 0.78))
    target = settings.upload_dir / "avatars"
    target.mkdir(parents=True, exist_ok=True)
    name = f"seed_{username.replace('.', '_')}.jpg"
    image.save(target / name, "JPEG", quality=88)
    return f"avatars/{name}"


def seed(reset: bool = False) -> None:
    if reset:
        Base.metadata.drop_all(bind=engine)
        shutil.rmtree(settings.upload_dir, ignore_errors=True)
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    init_db()

    rng = random.Random(42)
    with SessionLocal() as db:
        if db.scalar(select(User).limit(1)) is not None:
            print("Database already has data — run with --reset to start fresh.")
            return

        now = datetime.now(timezone.utc)
        users = []
        for i, (username, email, bio, colour) in enumerate(USERS):
            user = User(
                username=username,
                email=email,
                hashed_password=hash_password(DEMO_PASSWORD),
                bio=bio,
                profile_image=make_avatar(username, colour),
                is_verified=True,
                created_at=now - timedelta(days=200 - i * 35),
            )
            db.add(user)
            users.append(user)
        db.flush()

        products = []
        for i, (title, category, size, condition, price, colour, description) in enumerate(PRODUCTS):
            seller = users[i % len(users)]
            product = Product(
                seller_id=seller.id,
                title=title,
                description=description,
                price=float(price),
                category=category,
                size=size,
                condition=condition,
                status="sold" if i in (2, 11) else "active",
                created_at=now - timedelta(hours=i * 9 + rng.randint(0, 6)),
            )
            product.images = [
                ProductImage(image_path=make_product_image(category, colour, v), display_order=v)
                for v in range(rng.choice([2, 3]))
            ]
            db.add(product)
            products.append(product)
        db.flush()

        for user in users:
            for product in rng.sample(products, 6):
                if product.seller_id != user.id:
                    db.add(Favorite(user_id=user.id, product_id=product.id))

        buyer, product = users[1], products[0]
        convo = Conversation(buyer_id=buyer.id, seller_id=product.seller_id, product_id=product.id)
        db.add(convo)
        db.flush()
        thread = [
            (buyer.id, "Hey! Is the hoodie still available?"),
            (product.seller_id, "Hi! Yes it is 😊"),
            (buyer.id, "Would you take 32 for it?"),
            (product.seller_id, "I can do 35 and post it tomorrow."),
        ]
        for j, (sender, text) in enumerate(thread):
            db.add(Message(conversation_id=convo.id, sender_id=sender, content=text,
                           created_at=now - timedelta(minutes=60 - j * 7), is_read=j < 3))
        db.commit()

    print(f"Seeded {len(USERS)} users and {len(PRODUCTS)} listings.")
    print(f"Demo login: {USERS[0][1]} / {DEMO_PASSWORD}")


if __name__ == "__main__":
    seed(reset="--reset" in sys.argv)

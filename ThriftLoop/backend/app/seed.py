"""Populate the database with demo users and listings.

Run from backend/:  python -m app.seed                 (adds data if the DB is empty)
                    python -m app.seed --refresh-demo  (replaces only the demo users/listings)
                    python -m app.seed --reset         (wipes the whole DB and uploads first)

Listing photos are real Unsplash photos (see app/seed_photos.py), stored as their CDN URLs.
Demo users have no profile photo, so the app shows their initial. Listings people create in
the app use photos uploaded from their phone.
"""

import random
import shutil
import sys
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.core.config import settings
from app.core.security import hash_password
from app.database import Base, SessionLocal, engine, init_db
from app.models import Conversation, Favorite, Message, Product, ProductImage, User
from app.seed_photos import LISTINGS, unsplash_url

DEMO_PASSWORD = "thriftloop123"

USERS = [
    ("maya.vintage", "maya.vintage@gmail.com", "Curating 90s denim and cosy knits. Ships within 2 days."),
    ("leo_threads", "leo.threads@gmail.com", "Streetwear lover clearing out my closet. Open to offers!"),
    ("sofia.loops", "sofia.loops@gmail.com", "Slow fashion, small wardrobe. Everything is washed and steamed."),
    ("noah.archive", "noah.archive@gmail.com", "Outdoor gear and workwear. Pet-free, smoke-free home."),
]

SOLD_TITLES = {"Grey Marl Hoodie", "Black Jeans"}


def _remove_demo_users(db) -> int:
    """Delete only the demo sellers (and, via cascades, their listings/favorites/chats)."""
    emails = [email for _, email, _ in USERS]
    demo = list(db.scalars(select(User).where(User.email.in_(emails))).all())
    for user in demo:
        db.delete(user)
    db.commit()
    # Old generated placeholder images from earlier seeds.
    for folder in ("products", "avatars"):
        for path in (settings.upload_dir / folder).glob("seed_*"):
            path.unlink(missing_ok=True)
    return len(demo)


def seed(reset: bool = False, refresh_demo: bool = False) -> None:
    if reset:
        Base.metadata.drop_all(bind=engine)
        shutil.rmtree(settings.upload_dir, ignore_errors=True)
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    init_db()

    rng = random.Random(42)
    with SessionLocal() as db:
        if refresh_demo:
            print(f"Removed {_remove_demo_users(db)} demo users; real accounts were kept.")
        elif db.scalar(select(User).limit(1)) is not None:
            print("Database already has data. Use --refresh-demo to replace only the demo data, or --reset to wipe everything.")
            return

        now = datetime.now(timezone.utc)
        users = []
        for i, (username, email, bio) in enumerate(USERS):
            user = User(
                username=username,
                email=email,
                hashed_password=hash_password(DEMO_PASSWORD),
                bio=bio,
                is_verified=True,
                created_at=now - timedelta(days=200 - i * 35),
            )
            db.add(user)
            users.append(user)
        db.flush()

        products = []
        for i, (title, category, size, condition, price, description, photos) in enumerate(LISTINGS):
            product = Product(
                seller_id=users[i % len(users)].id,
                title=title,
                description=description,
                price=float(price),
                category=category,
                size=size,
                condition=condition,
                status="sold" if title in SOLD_TITLES else "active",
                created_at=now - timedelta(hours=i * 9 + rng.randint(0, 6)),
            )
            product.images = [
                ProductImage(image_path=unsplash_url(photo_id), display_order=order)
                for order, (photo_id, _photographer) in enumerate(photos)
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

    print(f"Seeded {len(USERS)} users and {len(LISTINGS)} listings with Unsplash photos.")
    print(f"Demo login: {USERS[0][1]} / {DEMO_PASSWORD}")


if __name__ == "__main__":
    seed(reset="--reset" in sys.argv, refresh_demo="--refresh-demo" in sys.argv)

"""Turn ORM objects into API schemas (keeps URL building and counts in one place)."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Conversation, Favorite, Message, Product, User
from app.schemas import (
    ConversationOut,
    CurrentUserOut,
    MessageOut,
    ProductImageOut,
    ProductOut,
    UserProfileOut,
    UserSummary,
)
from app.schemas.conversation import ConversationProduct
from app.services.images import public_url


def user_summary(user: User) -> UserSummary:
    return UserSummary(id=user.id, username=user.username, profile_image=public_url(user.profile_image))


def _listing_counts(db: Session, user_id: int) -> tuple[int, int]:
    rows = db.execute(
        select(Product.status, func.count()).where(Product.seller_id == user_id).group_by(Product.status)
    ).all()
    counts = {status: count for status, count in rows}
    return counts.get("active", 0), counts.get("sold", 0)


def user_profile(db: Session, user: User) -> UserProfileOut:
    active, sold = _listing_counts(db, user.id)
    return UserProfileOut(
        **user_summary(user).model_dump(),
        bio=user.bio,
        created_at=user.created_at,
        active_listings_count=active,
        sold_count=sold,
    )


def current_user_out(db: Session, user: User) -> CurrentUserOut:
    return CurrentUserOut(**user_profile(db, user).model_dump(), email=user.email, is_verified=user.is_verified)


def products_out(db: Session, products: list[Product], viewer: User | None) -> list[ProductOut]:
    if not products:
        return []
    ids = [p.id for p in products]
    fav_counts = dict(
        db.execute(
            select(Favorite.product_id, func.count()).where(Favorite.product_id.in_(ids)).group_by(Favorite.product_id)
        ).all()
    )
    favorited: set[int] = set()
    if viewer is not None:
        favorited = set(
            db.scalars(
                select(Favorite.product_id).where(Favorite.user_id == viewer.id, Favorite.product_id.in_(ids))
            ).all()
        )
    return [
        ProductOut(
            id=p.id,
            title=p.title,
            description=p.description,
            price=p.price,
            category=p.category,
            size=p.size,
            condition=p.condition,
            status=p.status,
            created_at=p.created_at,
            images=[
                ProductImageOut(id=img.id, url=public_url(img.image_path) or "", display_order=img.display_order)
                for img in p.images
            ],
            seller=user_summary(p.seller),
            favorites_count=fav_counts.get(p.id, 0),
            is_favorited=p.id in favorited,
        )
        for p in products
    ]


def product_out(db: Session, product: Product, viewer: User | None) -> ProductOut:
    return products_out(db, [product], viewer)[0]


def message_out(message: Message) -> MessageOut:
    return MessageOut(
        id=message.id,
        conversation_id=message.conversation_id,
        sender_id=message.sender_id,
        content=message.content,
        created_at=message.created_at,
        is_read=message.is_read,
    )


def conversation_out(db: Session, conversation: Conversation, viewer: User) -> ConversationOut:
    other = conversation.seller if conversation.buyer_id == viewer.id else conversation.buyer
    last = db.scalars(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.created_at.desc(), Message.id.desc())
        .limit(1)
    ).first()
    unread = db.scalar(
        select(func.count())
        .select_from(Message)
        .where(
            Message.conversation_id == conversation.id,
            Message.sender_id != viewer.id,
            Message.is_read.is_(False),
        )
    )
    product = None
    if conversation.product is not None:
        p = conversation.product
        product = ConversationProduct(
            id=p.id,
            title=p.title,
            price=p.price,
            status=p.status,
            image_url=public_url(p.images[0].image_path) if p.images else None,
        )
    return ConversationOut(
        id=conversation.id,
        created_at=conversation.created_at,
        buyer_id=conversation.buyer_id,
        seller_id=conversation.seller_id,
        other_user=user_summary(other),
        product=product,
        last_message=message_out(last) if last else None,
        unread_count=unread or 0,
    )

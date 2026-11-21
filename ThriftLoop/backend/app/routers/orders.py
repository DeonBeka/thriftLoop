from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models import Conversation, Message, Order, Product, User
from app.schemas.marketplace import OrderCreate, OrderOut, OrderStatusUpdate
from app.services.serializers import order_out
from app.utils_format import price_text

router = APIRouter(prefix="/orders", tags=["orders"])

# Who may move an order from one status to another.
SELLER_TRANSITIONS = {"pending": {"confirmed", "cancelled"}, "confirmed": {"delivered", "cancelled"}}
BUYER_TRANSITIONS = {"pending": {"cancelled"}}


def _get_order(db: Session, order_id: int, user: User) -> Order:
    order = db.get(Order, order_id)
    if order is None or (user.id not in (order.buyer_id, order.seller_id) and user.role != "admin"):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found.")
    return order


def _notify(db: Session, order: Order, sender_id: int, text: str) -> None:
    """Drop an update into the buyer/seller chat so both sides see order activity."""
    if order.product_id is None:
        return
    convo = db.scalar(select(Conversation).where(
        Conversation.buyer_id == order.buyer_id,
        Conversation.seller_id == order.seller_id,
        Conversation.product_id == order.product_id,
    ))
    if convo is None:
        convo = Conversation(buyer_id=order.buyer_id, seller_id=order.seller_id, product_id=order.product_id)
        db.add(convo)
        db.flush()
    db.add(Message(conversation_id=convo.id, sender_id=sender_id, content=text))


@router.post("", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
def place_order(payload: OrderCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> OrderOut:
    if not payload.accept_terms:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Please accept the cash-on-delivery terms.")
    product = db.get(Product, payload.product_id)
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This listing no longer exists.")
    if product.seller_id == user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You can't buy your own listing.")
    if product.status != "active":
        raise HTTPException(status.HTTP_409_CONFLICT, "Sorry, someone else just ordered this item.")

    order = Order(
        product_id=product.id,
        buyer_id=user.id,
        seller_id=product.seller_id,
        product_title=product.title,
        product_image=product.images[0].image_path if product.images else None,
        price=product.price,
        payment_method="cash_on_delivery",
        delivery_name=payload.delivery_name,
        phone=payload.phone,
        address_text=payload.address_text,
        latitude=payload.latitude,
        longitude=payload.longitude,
        note=(payload.note or "").strip() or None,
        status="pending",
    )
    product.status = "reserved"  # hidden from the marketplace while the order is open
    db.add(order)
    db.flush()
    _notify(db, order, user.id, f"🛍️ I ordered this for {price_text(order.price)}, cash on delivery. Order #{order.id}.")
    db.commit()
    return order_out(order)


@router.get("", response_model=list[OrderOut])
def list_orders(
    role: Annotated[Literal["buyer", "seller", "all"], Query()] = "all",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[OrderOut]:
    stmt = select(Order).order_by(Order.created_at.desc())
    if role == "buyer":
        stmt = stmt.where(Order.buyer_id == user.id)
    elif role == "seller":
        stmt = stmt.where(Order.seller_id == user.id)
    else:
        stmt = stmt.where(or_(Order.buyer_id == user.id, Order.seller_id == user.id))
    return [order_out(o) for o in db.scalars(stmt).all()]


@router.get("/{order_id}", response_model=OrderOut)
def get_order(order_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> OrderOut:
    return order_out(_get_order(db, order_id, user))


@router.post("/{order_id}/status", response_model=OrderOut)
def update_status(order_id: int, body: OrderStatusUpdate, db: Session = Depends(get_db),
                  user: User = Depends(get_current_user)) -> OrderOut:
    order = _get_order(db, order_id, user)
    allowed: set[str] = set()
    if user.id == order.seller_id or user.role == "admin":
        allowed |= SELLER_TRANSITIONS.get(order.status, set())
    if user.id == order.buyer_id:
        allowed |= BUYER_TRANSITIONS.get(order.status, set())
    if body.status not in allowed:
        raise HTTPException(status.HTTP_409_CONFLICT, f"An order that is {order.status} can't be marked {body.status}.")

    order.status = body.status
    if order.product is not None:
        if body.status == "delivered":
            order.product.status = "sold"
        elif body.status == "cancelled" and order.product.status == "reserved":
            order.product.status = "active"  # back on the marketplace
    messages = {
        "confirmed": f"✅ Order #{order.id} confirmed. I'll arrange delivery soon.",
        "delivered": f"📦 Order #{order.id} delivered and paid in cash. Thank you!",
        "cancelled": f"Order #{order.id} was cancelled.",
    }
    _notify(db, order, user.id, messages[body.status])
    db.commit()
    return order_out(order)

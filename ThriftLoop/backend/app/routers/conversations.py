from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_, select, update
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models import Conversation, Message, Product, User
from app.schemas import ConversationCreate, ConversationOut, MessageCreate, MessageOut
from app.services.serializers import conversation_out, message_out

router = APIRouter(prefix="/conversations", tags=["messaging"])


def _get_conversation(db: Session, conversation_id: int, user: User) -> Conversation:
    conversation = db.get(Conversation, conversation_id)
    if conversation is None or user.id not in (conversation.buyer_id, conversation.seller_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found.")
    return conversation


@router.get("", response_model=list[ConversationOut])
def list_conversations(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[ConversationOut]:
    last_activity = (
        select(func.max(Message.created_at))
        .where(Message.conversation_id == Conversation.id)
        .correlate(Conversation)
        .scalar_subquery()
    )
    conversations = db.scalars(
        select(Conversation)
        .where(or_(Conversation.buyer_id == user.id, Conversation.seller_id == user.id))
        .order_by(func.coalesce(last_activity, Conversation.created_at).desc())
    ).all()
    return [conversation_out(db, c, user) for c in conversations]


@router.post("", response_model=ConversationOut)
def start_conversation(
    payload: ConversationCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> ConversationOut:
    product = db.get(Product, payload.product_id)
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This listing no longer exists.")
    if product.seller_id == user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You can't message yourself about your own listing.")

    conversation = db.scalar(
        select(Conversation).where(
            Conversation.buyer_id == user.id,
            Conversation.seller_id == product.seller_id,
            Conversation.product_id == product.id,
        )
    )
    if conversation is None:
        conversation = Conversation(buyer_id=user.id, seller_id=product.seller_id, product_id=product.id)
        db.add(conversation)
        db.flush()
    if payload.message and payload.message.strip():
        db.add(Message(conversation_id=conversation.id, sender_id=user.id, content=payload.message.strip()))
    db.commit()
    return conversation_out(db, conversation, user)


@router.get("/{conversation_id}", response_model=ConversationOut)
def get_conversation(
    conversation_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> ConversationOut:
    return conversation_out(db, _get_conversation(db, conversation_id, user), user)


@router.get("/{conversation_id}/messages", response_model=list[MessageOut])
def list_messages(
    conversation_id: int,
    after_id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[MessageOut]:
    conversation = _get_conversation(db, conversation_id, user)
    # Opening the thread marks the other person's messages as read.
    db.execute(
        update(Message)
        .where(
            Message.conversation_id == conversation.id,
            Message.sender_id != user.id,
            Message.is_read.is_(False),
        )
        .values(is_read=True)
    )
    db.commit()
    stmt = select(Message).where(Message.conversation_id == conversation.id)
    if after_id is not None:
        stmt = stmt.where(Message.id > after_id)
    messages = db.scalars(stmt.order_by(Message.created_at.asc(), Message.id.asc())).all()
    return [message_out(m) for m in messages]


@router.post("/{conversation_id}/messages", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
def send_message(
    conversation_id: int,
    payload: MessageCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MessageOut:
    conversation = _get_conversation(db, conversation_id, user)
    message = Message(conversation_id=conversation.id, sender_id=user.id, content=payload.content)
    db.add(message)
    db.commit()
    return message_out(message)

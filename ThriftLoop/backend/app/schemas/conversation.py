from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.schemas.user import UserSummary


class ConversationProduct(BaseModel):
    id: int
    title: str
    price: float
    status: str
    image_url: str | None = None


class MessageOut(BaseModel):
    id: int
    conversation_id: int
    sender_id: int
    content: str
    created_at: datetime
    is_read: bool


class ConversationOut(BaseModel):
    id: int
    created_at: datetime
    buyer_id: int
    seller_id: int
    other_user: UserSummary
    product: ConversationProduct | None = None
    last_message: MessageOut | None = None
    unread_count: int = 0


class ConversationCreate(BaseModel):
    product_id: int
    message: str | None = Field(default=None, max_length=2000)


class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=2000)

    @field_validator("content")
    @classmethod
    def not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Message can't be empty.")
        return value

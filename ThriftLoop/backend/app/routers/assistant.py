from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_optional_user
from app.database import get_db
from app.models import User
from app.schemas import ProductOut
from app.services.assistant import SearchFilters, answer

router = APIRouter(prefix="/assistant", tags=["assistant"])


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=500)
    previous: SearchFilters | None = None  # filters from the last reply, for follow-ups


class ChatResponse(BaseModel):
    reply: str
    summary: str
    filters: SearchFilters
    relaxed: str | None = None  # "price" / "color" when we widened the search to show something
    engine: str  # "ai" or "rules"
    products: list[ProductOut]
    suggestions: list[str]


class AssistantInfo(BaseModel):
    ai_enabled: bool
    model: str | None


@router.get("/info", response_model=AssistantInfo)
def info() -> AssistantInfo:
    enabled = bool(settings.anthropic_api_key)
    return AssistantInfo(ai_enabled=enabled, model=settings.assistant_model if enabled else None)


@router.post("/chat", response_model=ChatResponse)
def chat(body: ChatRequest, db: Session = Depends(get_db), viewer: User | None = Depends(get_optional_user)) -> ChatResponse:
    return ChatResponse(**answer(db, body.message.strip(), body.previous, viewer))

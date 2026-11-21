from datetime import datetime

from pydantic import BaseModel

from app.schemas.user import UserSummary


class ProductImageOut(BaseModel):
    id: int
    url: str
    display_order: int
    angle: str | None = None  # "front" / "back" / "side" when the seller labelled the photo


class ProductOut(BaseModel):
    id: int
    title: str
    description: str
    price: float
    category: str
    size: str
    condition: str
    status: str
    created_at: datetime
    images: list[ProductImageOut]
    seller: UserSummary
    favorites_count: int = 0
    is_favorited: bool = False
    photo_colors: list[str] = []  # colours seen in the main photo (used by Live view)


class ProductListResponse(BaseModel):
    items: list[ProductOut]
    total: int
    limit: int
    offset: int


class ProductOptions(BaseModel):
    categories: list[str]
    conditions: list[str]
    sizes: list[str]
    groups: dict[str, list[str]] = {}

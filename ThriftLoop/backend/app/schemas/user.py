from datetime import datetime

from pydantic import BaseModel


class UserSummary(BaseModel):
    id: int
    username: str
    profile_image: str | None = None


class UserProfileOut(UserSummary):
    bio: str | None = None
    created_at: datetime
    active_listings_count: int = 0
    sold_count: int = 0


class CurrentUserOut(UserProfileOut):
    email: str
    is_verified: bool

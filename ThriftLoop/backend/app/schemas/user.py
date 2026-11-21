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
    role: str = "viewer"


class CurrentUserOut(UserProfileOut):
    email: str
    is_verified: bool
    terms_accepted_at: datetime | None = None
    # Status of the latest seller application: none | pending | approved | rejected
    seller_status: str = "none"


class AdminUserOut(UserSummary):
    email: str
    role: str
    created_at: datetime
    active_listings_count: int = 0
    seller_status: str = "none"

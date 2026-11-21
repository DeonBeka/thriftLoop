from typing import Annotated, Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.deps import get_current_user, get_optional_user
from app.database import get_db
from app.models import Product, User
from app.schemas import ProductOut, UserProfileOut
from app.schemas.auth import USERNAME_RE
from app.schemas.user import CurrentUserOut
from app.services.images import delete_upload, save_upload
from app.services.serializers import current_user_out, products_out, user_profile

router = APIRouter(prefix="/users", tags=["users"])


@router.put("/me", response_model=CurrentUserOut)
def update_me(
    username: Annotated[str | None, Form()] = None,
    bio: Annotated[str | None, Form()] = None,
    remove_profile_image: Annotated[bool, Form()] = False,
    profile_image: Annotated[UploadFile | None, File()] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CurrentUserOut:
    if username is not None:
        username = username.strip()
        if not USERNAME_RE.match(username):
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                "Username can only use letters, numbers, dots and underscores (3–30 characters).",
            )
        taken = db.scalar(select(User).where(User.username.ilike(username), User.id != user.id))
        if taken is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, "That username is taken.")
        user.username = username
    if bio is not None:
        bio = bio.strip()
        if len(bio) > 300:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Bio must be 300 characters or less.")
        user.bio = bio or None

    old_image = user.profile_image
    if profile_image is not None and (profile_image.filename or profile_image.size):
        user.profile_image = save_upload(profile_image, "avatars", max_dimension=600)
    elif remove_profile_image:
        user.profile_image = None
    db.commit()
    if old_image != user.profile_image:
        delete_upload(old_image)
    return current_user_out(db, user)


@router.get("/{user_id}", response_model=UserProfileOut)
def get_user(user_id: int, db: Session = Depends(get_db)) -> UserProfileOut:
    user = db.get(User, user_id)
    if user is None or not user.is_verified:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found.")
    return user_profile(db, user)


@router.get("/{user_id}/products", response_model=list[ProductOut])
def get_user_products(
    user_id: int,
    status_filter: Annotated[Literal["active", "reserved", "sold", "all"], Query(alias="status")] = "active",
    db: Session = Depends(get_db),
    viewer: User | None = Depends(get_optional_user),
) -> list[ProductOut]:
    if db.get(User, user_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found.")
    stmt = (
        select(Product)
        .where(Product.seller_id == user_id)
        .options(selectinload(Product.images), selectinload(Product.seller))
        .order_by(Product.created_at.desc())
    )
    if status_filter != "all":
        stmt = stmt.where(Product.status == status_filter)
    return products_out(db, list(db.scalars(stmt).all()), viewer)

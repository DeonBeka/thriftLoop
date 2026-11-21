from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.deps import get_current_user
from app.database import get_db
from app.models import Favorite, Product, User
from app.schemas import ProductOut
from app.services.serializers import products_out

router = APIRouter(prefix="/favorites", tags=["favorites"])


@router.get("", response_model=list[ProductOut])
def list_favorites(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[ProductOut]:
    # Deleted listings disappear via ON DELETE CASCADE; sold ones stay and carry status="sold".
    products = db.scalars(
        select(Product)
        .join(Favorite, Favorite.product_id == Product.id)
        .where(Favorite.user_id == user.id)
        .options(selectinload(Product.images), selectinload(Product.seller))
        .order_by(Favorite.created_at.desc())
    ).all()
    return products_out(db, list(products), user)


@router.post("/{product_id}", status_code=status.HTTP_201_CREATED)
def add_favorite(product_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    if db.get(Product, product_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This listing no longer exists.")
    exists = db.scalar(select(Favorite).where(Favorite.user_id == user.id, Favorite.product_id == product_id))
    if exists is None:
        db.add(Favorite(user_id=user.id, product_id=product_id))
        db.commit()
    return {"product_id": product_id, "is_favorited": True}


@router.delete("/{product_id}")
def remove_favorite(product_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    fav = db.scalar(select(Favorite).where(Favorite.user_id == user.id, Favorite.product_id == product_id))
    if fav is not None:
        db.delete(fav)
        db.commit()
    return {"product_id": product_id, "is_favorited": False}

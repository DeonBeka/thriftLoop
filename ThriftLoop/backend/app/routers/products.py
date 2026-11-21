from typing import Annotated, Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.deps import get_current_user, get_optional_user, require_seller
from app.database import get_db
from app.models import Favorite, Product, ProductImage, User
from app.models.product import CATEGORIES, CONDITIONS, SELLER_SETTABLE_STATUSES, SIZES
from app.schemas import ProductListResponse, ProductOut
from app.schemas.product import ProductOptions
from app.services.images import delete_upload, save_upload
from app.services.serializers import product_out, products_out

router = APIRouter(prefix="/products", tags=["products"])

MAX_IMAGES = 8
SortOption = Literal["newest", "price_asc", "price_desc", "popular"]


def _csv(value: str | None) -> list[str]:
    return [v.strip() for v in value.split(",") if v.strip()] if value else []


def _validate_fields(title: str, description: str, price: float, category: str, size: str, condition: str) -> None:
    errors: list[str] = []
    if not 3 <= len(title.strip()) <= 80:
        errors.append("Title must be 3–80 characters.")
    if not 10 <= len(description.strip()) <= 2000:
        errors.append("Description must be 10–2000 characters.")
    if not 0 < price <= 100_000:
        errors.append("Price must be greater than 0.")
    if category not in CATEGORIES:
        errors.append("Pick a valid category.")
    if size not in SIZES:
        errors.append("Pick a valid size.")
    if condition not in CONDITIONS:
        errors.append("Pick a valid condition.")
    if errors:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, " ".join(errors))


def _load_product(db: Session, product_id: int) -> Product:
    product = db.scalar(
        select(Product)
        .options(selectinload(Product.images), selectinload(Product.seller))
        .where(Product.id == product_id)
    )
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This listing no longer exists.")
    return product


@router.get("/options", response_model=ProductOptions)
def product_options() -> ProductOptions:
    return ProductOptions(categories=CATEGORIES, conditions=CONDITIONS, sizes=SIZES)


@router.get("", response_model=ProductListResponse)
def list_products(
    db: Session = Depends(get_db),
    viewer: User | None = Depends(get_optional_user),
    q: str | None = None,
    category: str | None = None,
    size: Annotated[str | None, Query(description="Comma separated sizes")] = None,
    condition: Annotated[str | None, Query(description="Comma separated conditions")] = None,
    min_price: Annotated[float | None, Query(ge=0)] = None,
    max_price: Annotated[float | None, Query(ge=0)] = None,
    seller_id: int | None = None,
    status_filter: Annotated[Literal["active", "reserved", "sold", "all"], Query(alias="status")] = "active",
    exclude_own: bool = False,
    sort: SortOption = "newest",
    limit: Annotated[int, Query(ge=1, le=100)] = 40,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ProductListResponse:
    stmt = select(Product)
    if status_filter != "all":
        stmt = stmt.where(Product.status == status_filter)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Product.title.ilike(like), Product.description.ilike(like), Product.category.ilike(like)))
    if category:
        stmt = stmt.where(Product.category == category)
    if sizes := _csv(size):
        stmt = stmt.where(Product.size.in_(sizes))
    if conditions := _csv(condition):
        stmt = stmt.where(Product.condition.in_(conditions))
    if min_price is not None:
        stmt = stmt.where(Product.price >= min_price)
    if max_price is not None:
        stmt = stmt.where(Product.price <= max_price)
    if seller_id is not None:
        stmt = stmt.where(Product.seller_id == seller_id)
    if exclude_own and viewer is not None:
        stmt = stmt.where(Product.seller_id != viewer.id)

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0

    if sort == "price_asc":
        stmt = stmt.order_by(Product.price.asc(), Product.id.desc())
    elif sort == "price_desc":
        stmt = stmt.order_by(Product.price.desc(), Product.id.desc())
    elif sort == "popular":
        fav_count = (
            select(func.count()).where(Favorite.product_id == Product.id).correlate(Product).scalar_subquery()
        )
        stmt = stmt.order_by(fav_count.desc(), Product.created_at.desc())
    else:
        stmt = stmt.order_by(Product.created_at.desc(), Product.id.desc())

    stmt = stmt.options(selectinload(Product.images), selectinload(Product.seller)).limit(limit).offset(offset)
    items = list(db.scalars(stmt).all())
    return ProductListResponse(items=products_out(db, items, viewer), total=total, limit=limit, offset=offset)


@router.get("/{product_id}", response_model=ProductOut)
def get_product(
    product_id: int, db: Session = Depends(get_db), viewer: User | None = Depends(get_optional_user)
) -> ProductOut:
    return product_out(db, _load_product(db, product_id), viewer)


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(
    title: Annotated[str, Form()],
    description: Annotated[str, Form()],
    price: Annotated[float, Form()],
    category: Annotated[str, Form()],
    size: Annotated[str, Form()],
    condition: Annotated[str, Form()],
    images: Annotated[list[UploadFile], File()],
    db: Session = Depends(get_db),
    user: User = Depends(require_seller),
) -> ProductOut:
    _validate_fields(title, description, price, category, size, condition)
    images = [f for f in images if f.filename or f.size]
    if not images:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Add at least one photo.")
    if len(images) > MAX_IMAGES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, f"You can add up to {MAX_IMAGES} photos.")

    saved: list[str] = []
    try:
        for upload in images:
            saved.append(save_upload(upload, "products"))
    except HTTPException:
        for path in saved:
            delete_upload(path)
        raise

    product = Product(
        seller_id=user.id,
        title=title.strip(),
        description=description.strip(),
        price=round(price, 2),
        category=category,
        size=size,
        condition=condition,
        status="active",
    )
    product.images = [ProductImage(image_path=path, display_order=i) for i, path in enumerate(saved)]
    db.add(product)
    db.commit()
    return product_out(db, _load_product(db, product.id), user)


@router.put("/{product_id}", response_model=ProductOut)
def update_product(
    product_id: int,
    title: Annotated[str | None, Form()] = None,
    description: Annotated[str | None, Form()] = None,
    price: Annotated[float | None, Form()] = None,
    category: Annotated[str | None, Form()] = None,
    size: Annotated[str | None, Form()] = None,
    condition: Annotated[str | None, Form()] = None,
    status_value: Annotated[str | None, Form(alias="status")] = None,
    keep_image_ids: Annotated[
        str | None, Form(description="Comma separated ids of existing images to keep, in display order")
    ] = None,
    images: Annotated[list[UploadFile] | None, File()] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProductOut:
    product = _load_product(db, product_id)
    if product.seller_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only edit your own listings.")

    new_title = title if title is not None else product.title
    new_description = description if description is not None else product.description
    new_price = price if price is not None else product.price
    new_category = category or product.category
    new_size = size or product.size
    new_condition = condition or product.condition
    _validate_fields(new_title, new_description, new_price, new_category, new_size, new_condition)
    if status_value is not None:
        if status_value not in SELLER_SETTABLE_STATUSES:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Status must be 'active' or 'sold'.")
        if product.status == "reserved":
            raise HTTPException(status.HTTP_409_CONFLICT, "This item has an open order. Finish or cancel the order first.")

    new_uploads = [f for f in (images or []) if f.filename or f.size]

    # Work out which existing images survive.
    if keep_image_ids is not None:
        try:
            keep_order = [int(v) for v in _csv(keep_image_ids)]
        except ValueError:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "keep_image_ids must be numbers.")
        by_id = {img.id: img for img in product.images}
        kept = [by_id[i] for i in keep_order if i in by_id]
    else:
        kept = list(product.images)

    if not kept and not new_uploads:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "A listing needs at least one photo.")
    if len(kept) + len(new_uploads) > MAX_IMAGES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, f"You can add up to {MAX_IMAGES} photos.")

    saved = [save_upload(f, "products") for f in new_uploads]
    removed = [img for img in product.images if img not in kept]
    removed_paths = [img.image_path for img in removed]

    product.title = new_title.strip()
    product.description = new_description.strip()
    product.price = round(new_price, 2)
    product.category = new_category
    product.size = new_size
    product.condition = new_condition
    if status_value is not None:
        product.status = status_value

    for img in removed:
        product.images.remove(img)
    for i, img in enumerate(kept):
        img.display_order = i
    for j, path in enumerate(saved):
        product.images.append(ProductImage(image_path=path, display_order=len(kept) + j))
    db.commit()

    for path in removed_paths:
        delete_upload(path)
    db.expire_all()
    return product_out(db, _load_product(db, product.id), user)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    product = _load_product(db, product_id)
    if product.seller_id != user.id and user.role != "admin":  # admins can remove any listing (moderation)
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only delete your own listings.")
    paths = [img.image_path for img in product.images]
    db.delete(product)
    db.commit()
    for path in paths:
        delete_upload(path)

from datetime import datetime, timezone
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.deps import require_admin
from app.database import get_db
from app.models import Order, Product, SellerApplication, User
from app.schemas.marketplace import AdminStats, ReviewRequest, RoleUpdate, SellerApplicationOut
from app.schemas.user import AdminUserOut
from app.services.images import private_file
from app.services.serializers import application_out, seller_status, user_summary

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


def _application(db: Session, application_id: int) -> SellerApplication:
    application = db.get(SellerApplication, application_id)
    if application is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found.")
    return application


@router.get("/stats", response_model=AdminStats)
def stats(db: Session = Depends(get_db)) -> AdminStats:
    count = lambda stmt: db.scalar(stmt) or 0  # noqa: E731
    return AdminStats(
        users=count(select(func.count()).select_from(User)),
        sellers=count(select(func.count()).select_from(User).where(User.role == "seller")),
        pending_applications=count(
            select(func.count()).select_from(SellerApplication).where(SellerApplication.status == "pending")
        ),
        active_listings=count(select(func.count()).select_from(Product).where(Product.status == "active")),
        open_orders=count(select(func.count()).select_from(Order).where(Order.status.in_(["pending", "confirmed"]))),
    )


@router.get("/applications", response_model=list[SellerApplicationOut])
def list_applications(
    status_filter: Annotated[Literal["pending", "approved", "rejected", "all"], Query(alias="status")] = "pending",
    db: Session = Depends(get_db),
) -> list[SellerApplicationOut]:
    stmt = select(SellerApplication).order_by(SellerApplication.created_at.desc())
    if status_filter != "all":
        stmt = stmt.where(SellerApplication.status == status_filter)
    return [application_out(a, include_email=True) for a in db.scalars(stmt).all()]


@router.get("/applications/{application_id}", response_model=SellerApplicationOut)
def get_application(application_id: int, db: Session = Depends(get_db)) -> SellerApplicationOut:
    return application_out(_application(db, application_id), include_email=True)


@router.get("/applications/{application_id}/selfie")
def application_selfie(application_id: int, db: Session = Depends(get_db)) -> FileResponse:
    path = private_file(_application(db, application_id).selfie_path)
    return FileResponse(path, media_type="image/jpeg", headers={"Cache-Control": "private, no-store"})


@router.get("/applications/{application_id}/id-document")
def application_id_document(application_id: int, db: Session = Depends(get_db)) -> FileResponse:
    application = _application(db, application_id)
    if not application.id_document_path:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No ID document was uploaded.")
    return FileResponse(private_file(application.id_document_path), media_type="image/jpeg",
                        headers={"Cache-Control": "private, no-store"})


def _review(db: Session, application_id: int, admin: User, approve: bool, note: str | None) -> SellerApplicationOut:
    application = _application(db, application_id)
    if application.status != "pending":
        raise HTTPException(status.HTTP_409_CONFLICT, f"This application was already {application.status}.")
    application.status = "approved" if approve else "rejected"
    application.admin_note = (note or "").strip() or None
    application.reviewed_by_id = admin.id
    application.reviewed_at = datetime.now(timezone.utc)
    if approve and application.user.role == "viewer":
        application.user.role = "seller"
    db.commit()
    return application_out(application, include_email=True)


@router.post("/applications/{application_id}/approve", response_model=SellerApplicationOut)
def approve(application_id: int, body: ReviewRequest, db: Session = Depends(get_db),
            admin: User = Depends(require_admin)) -> SellerApplicationOut:
    return _review(db, application_id, admin, True, body.note)


@router.post("/applications/{application_id}/reject", response_model=SellerApplicationOut)
def reject(application_id: int, body: ReviewRequest, db: Session = Depends(get_db),
           admin: User = Depends(require_admin)) -> SellerApplicationOut:
    if not (body.note or "").strip():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Add a short reason so the user knows what to fix.")
    return _review(db, application_id, admin, False, body.note)


@router.get("/users", response_model=list[AdminUserOut])
def list_users(q: str | None = None, db: Session = Depends(get_db)) -> list[AdminUserOut]:
    stmt = select(User).order_by(User.created_at.desc()).limit(200)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(User.username.ilike(like), User.email.ilike(like)))
    users = db.scalars(stmt).all()
    counts = dict(db.execute(
        select(Product.seller_id, func.count()).where(Product.status == "active").group_by(Product.seller_id)
    ).all())
    return [
        AdminUserOut(**user_summary(u).model_dump(), email=u.email, role=u.role, created_at=u.created_at,
                     active_listings_count=counts.get(u.id, 0), seller_status=seller_status(u))
        for u in users
    ]


@router.patch("/users/{user_id}/role", response_model=AdminUserOut)
def set_role(user_id: int, body: RoleUpdate, db: Session = Depends(get_db),
             admin: User = Depends(require_admin)) -> AdminUserOut:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found.")
    if user.role == "admin":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Admin accounts are managed in the server settings.")
    user.role = body.role
    if body.role == "viewer":
        # Revoking selling hides their active listings from the marketplace.
        for product in user.products:
            if product.status == "active":
                product.status = "sold"
    db.commit()
    return AdminUserOut(**user_summary(user).model_dump(), email=user.email, role=user.role,
                        created_at=user.created_at, seller_status=seller_status(user))

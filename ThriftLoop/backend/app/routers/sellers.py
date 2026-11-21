from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models import SellerApplication, User
from app.schemas.marketplace import SellerApplicationOut
from app.services.images import save_upload
from app.services.serializers import application_out

router = APIRouter(prefix="/seller-applications", tags=["sellers"])


@router.get("/me", response_model=SellerApplicationOut | None)
def my_application(user: User = Depends(get_current_user)) -> SellerApplicationOut | None:
    latest = user.seller_applications[0] if user.seller_applications else None
    return application_out(latest) if latest else None


@router.post("", response_model=SellerApplicationOut, status_code=status.HTTP_201_CREATED)
def apply(
    full_name: Annotated[str, Form(min_length=2, max_length=100)],
    phone: Annotated[str, Form(min_length=6, max_length=30)],
    city: Annotated[str, Form(min_length=2, max_length=80)],
    accept_seller_terms: Annotated[bool, Form()],
    selfie: Annotated[UploadFile, File(description="Live selfie taken with the front camera")],
    id_document: Annotated[UploadFile | None, File()] = None,
    note: Annotated[str | None, Form(max_length=500)] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SellerApplicationOut:
    if user.can_sell:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You're already a seller.")
    if any(a.status == "pending" for a in user.seller_applications):
        raise HTTPException(status.HTTP_409_CONFLICT, "Your application is already being reviewed.")
    if not accept_seller_terms:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Please accept the Seller Terms to apply.")

    # Verification photos go to private storage: only admins can view them, never via /uploads.
    selfie_path = save_upload(selfie, "verification", max_dimension=1200, private=True)
    id_path = None
    if id_document is not None and (id_document.filename or id_document.size):
        id_path = save_upload(id_document, "verification", max_dimension=1600, private=True)

    application = SellerApplication(
        user_id=user.id,
        full_name=full_name.strip(),
        phone=phone.strip(),
        city=city.strip(),
        note=(note or "").strip() or None,
        selfie_path=selfie_path,
        id_document_path=id_path,
        status="pending",
    )
    db.add(application)
    db.commit()
    db.refresh(application)
    return application_out(application)

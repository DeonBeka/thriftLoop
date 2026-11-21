import uuid
from io import BytesIO
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.config import settings

MAX_UPLOAD_BYTES = 15 * 1024 * 1024
MAX_DIMENSION = 1600
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/octet-stream"}


def save_upload(file: UploadFile, subdir: str, max_dimension: int = MAX_DIMENSION) -> str:
    """Validate, resize and store an uploaded image. Returns a path relative to the upload dir."""
    if file.content_type and file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unsupported file type: {file.content_type}")
    data = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Images must be smaller than 15 MB.")
    try:
        image = Image.open(BytesIO(data))
        image = ImageOps.exif_transpose(image)
    except (UnidentifiedImageError, OSError):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "One of the files isn't a valid image.")

    image = image.convert("RGB")
    image.thumbnail((max_dimension, max_dimension))

    target_dir = settings.upload_dir / subdir
    target_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4().hex}.jpg"
    image.save(target_dir / filename, "JPEG", quality=85, optimize=True)
    return f"{subdir}/{filename}"


def delete_upload(relative_path: str | None) -> None:
    if not relative_path or relative_path.startswith("http"):
        return
    path = (settings.upload_dir / relative_path).resolve()
    if settings.upload_dir.resolve() in path.parents and path.exists():
        path.unlink(missing_ok=True)


def public_url(relative_path: str | None) -> str | None:
    """Clients prefix this with the API base URL. External URLs pass through untouched."""
    if not relative_path:
        return None
    if relative_path.startswith("http"):
        return relative_path
    return f"/uploads/{Path(relative_path).as_posix()}"

import uuid
from io import BytesIO
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.config import settings

try:  # iPhone photos are often HEIC; teach Pillow to read them.
    from pillow_heif import register_heif_opener

    register_heif_opener()
except ImportError:  # pragma: no cover
    pass

MAX_UPLOAD_BYTES = 15 * 1024 * 1024
MAX_DIMENSION = 1600
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/octet-stream"}


def save_upload(file: UploadFile, subdir: str, max_dimension: int = MAX_DIMENSION, private: bool = False) -> str:
    """Validate, resize and store an uploaded image. Returns a path relative to the (private) upload dir."""
    if file.content_type and file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unsupported file type: {file.content_type}")
    data = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Images must be smaller than 15 MB.")
    try:
        image = Image.open(BytesIO(data))
        image = ImageOps.exif_transpose(image)
    except (UnidentifiedImageError, OSError):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "One of the files isn't a valid image.") from None

    image = image.convert("RGB")
    image.thumbnail((max_dimension, max_dimension))

    target_dir = (settings.private_upload_dir if private else settings.upload_dir) / subdir
    target_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4().hex}.jpg"
    image.save(target_dir / filename, "JPEG", quality=85, optimize=True)
    return f"{subdir}/{filename}"


def delete_upload(relative_path: str | None, private: bool = False) -> None:
    if not relative_path or relative_path.startswith("http"):
        return
    root = settings.private_upload_dir if private else settings.upload_dir
    path = (root / relative_path).resolve()
    if root.resolve() in path.parents and path.exists():
        path.unlink(missing_ok=True)


def private_file(relative_path: str) -> Path:
    """Resolve a private upload safely (no path traversal)."""
    root = settings.private_upload_dir.resolve()
    path = (root / relative_path).resolve()
    if root not in path.parents or not path.exists():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File not found.")
    return path


def public_url(relative_path: str | None) -> str | None:
    """Clients prefix this with the API base URL. External URLs pass through untouched."""
    if not relative_path:
        return None
    if relative_path.startswith("http"):
        return relative_path
    return f"/uploads/{Path(relative_path).as_posix()}"

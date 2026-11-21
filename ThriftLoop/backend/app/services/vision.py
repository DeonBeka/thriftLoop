"""Works out what colour a listing really is from its main photo.

Sellers don't always write the colour ("Classic tee" instead of "Black tee"), so the shopping assistant
also matches on the colours seen in the photo. Two engines:

  * Claude vision (when ANTHROPIC_API_KEY is set) - looks at the photo and names the garment's colours,
    ignoring the background, skin and props.
  * A built-in pixel analyser (always available) - removes the background colour, looks at the middle of
    the photo where the item usually is, and names the dominant colours.

Results are stored in Product.photo_colors ("black,white"; "" = analysed, nothing clear; NULL = not yet).
New listings are analysed in the background right after upload; older ones are filled in at startup.
"""

from __future__ import annotations

import base64
import colorsys
import json
import logging
import threading
import time
import urllib.request
from collections import Counter
from io import BytesIO

import anthropic
from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.database import SessionLocal
from app.models import Product
from app.services import gemini

logger = logging.getLogger("thriftloop.vision")

COLOR_NAMES = ["black", "white", "grey", "blue", "green", "red", "brown", "beige", "pink", "purple", "yellow", "orange"]
# Only the demo listings use remote photos; never fetch anything else.
ALLOWED_REMOTE_PREFIX = "https://images.unsplash.com/"
MAX_REMOTE_BYTES = 8 * 1024 * 1024


# ---------------------------------------------------------------------------------------------
# Loading
# ---------------------------------------------------------------------------------------------

def load_image(image_path: str) -> Image.Image | None:
    try:
        if image_path.startswith("http"):
            if not image_path.startswith(ALLOWED_REMOTE_PREFIX):
                return None
            # The prefix check above limits this to the Unsplash CDN over https.
            with urllib.request.urlopen(image_path, timeout=15) as resp:  # nosec B310
                data = resp.read(MAX_REMOTE_BYTES + 1)
            if len(data) > MAX_REMOTE_BYTES:
                return None
            image = Image.open(BytesIO(data))
        else:
            root = settings.upload_dir.resolve()
            path = (root / image_path).resolve()
            if root not in path.parents or not path.exists():
                return None
            image = Image.open(path)
        image = ImageOps.exif_transpose(image).convert("RGB")
        image.thumbnail((768, 768))
        return image
    except (OSError, UnidentifiedImageError, ValueError):
        logger.info("Could not load photo %s for colour analysis", image_path)
        return None


# ---------------------------------------------------------------------------------------------
# Built-in pixel analyser
# ---------------------------------------------------------------------------------------------

def name_color(r: int, g: int, b: int) -> str:
    """Map one RGB pixel to one of COLOR_NAMES."""
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    hue = h * 360
    if v < 0.2:
        return "black"
    if s < 0.13 or (s < 0.22 and v < 0.45):
        if v > 0.82:
            return "white"
        if v < 0.32:
            return "black"
        return "grey"
    if hue < 12 or hue >= 345:
        return "pink" if (s < 0.45 and v > 0.7) else "red"
    if hue < 42:
        if s < 0.42 and v > 0.62:
            return "beige"
        if v < 0.62:
            return "brown"
        return "orange" if s > 0.6 else "beige"
    if hue < 66:
        if s < 0.55 and v > 0.6:  # khaki / sand reads as beige, not yellow
            return "beige"
        if v < 0.5:
            return "brown" if hue < 52 else "green"
        return "yellow"
    if hue < 170:
        return "green"
    if hue < 255:
        return "blue"
    if hue < 290:
        return "purple"
    return "pink" if v > 0.6 else "purple"


def _distance(a: tuple[int, int, int], b: tuple[int, int, int]) -> float:
    return sum((x - y) ** 2 for x, y in zip(a, b, strict=True)) ** 0.5


def colors_from_pixels(image: Image.Image) -> list[str]:
    """Dominant garment colours: drop the background colour, focus on the centre, count named colours."""
    small = image.resize((64, 64))
    raw = small.tobytes()
    pixels = [(raw[i], raw[i + 1], raw[i + 2]) for i in range(0, len(raw), 3)]

    def at(x: int, y: int) -> tuple[int, int, int]:
        return pixels[y * 64 + x]

    border = [at(x, y) for x in range(64) for y in (0, 1, 62, 63)] + [at(x, y) for y in range(64) for x in (0, 1, 62, 63)]
    background = tuple(sorted(channel)[len(channel) // 2] for channel in zip(*border, strict=True))

    centre = [at(x, y) for x in range(16, 48) for y in range(12, 54)]
    item = [p for p in centre if _distance(p, background) > 45]  # type: ignore[arg-type]
    if len(item) < len(centre) * 0.12:  # item blends into the background; use the centre as-is
        item = centre

    counts = Counter(name_color(*p) for p in item)
    total = sum(counts.values())
    ranked = [(c, n / total) for c, n in counts.most_common()]
    result = [c for i, (c, share) in enumerate(ranked[:2]) if share >= (0.3 if i == 0 else 0.25)]
    return result


# ---------------------------------------------------------------------------------------------
# Claude vision (optional)
# ---------------------------------------------------------------------------------------------

VISION_SCHEMA = {
    "type": "object",
    "properties": {"colors": {"type": "array", "items": {"type": "string", "enum": COLOR_NAMES}}},
    "required": ["colors"],
    "additionalProperties": False,
}

VISION_PROMPT = (
    "This is a photo from a second-hand clothing listing titled \"{title}\" ({category}). "
    "Name the main colour of the item being sold, plus a second colour only if a large part of the item is "
    "clearly that colour. Ignore the background, the person's skin and hair, and other clothes or props. "
    "Navy counts as blue, cream as beige, olive as green, burgundy as red. If you can't tell, return an empty list."
)


def _only_known(colors: object) -> list[str]:
    if not isinstance(colors, list):
        return []
    return [c for c in dict.fromkeys(colors) if c in COLOR_NAMES][:2]


def colors_from_ai(image: Image.Image, title: str, category: str) -> list[str] | None:
    """Claude vision if an Anthropic key is set, else Gemini if a Gemini key is set, else None."""
    buffer = BytesIO()
    image.save(buffer, "JPEG", quality=85)
    prompt = VISION_PROMPT.format(title=title, category=category)
    if not settings.anthropic_api_key:
        if not gemini.enabled():
            return None
        # Photo analysis runs in the background, so it can afford to wait out a rate limit (chat can't).
        result = gemini.generate_json(prompt, VISION_SCHEMA, image_jpeg=buffer.getvalue(), retries=2)
        return _only_known(result.get("colors")) if isinstance(result, dict) else None
    data = base64.standard_b64encode(buffer.getvalue()).decode()
    try:
        client = anthropic.Anthropic(api_key=settings.anthropic_api_key, timeout=30.0, max_retries=1)
        response = client.beta.messages.create(
            model=settings.assistant_model,
            max_tokens=256,
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            output_config={"effort": "low", "format": {"type": "json_schema", "schema": VISION_SCHEMA}},
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": data}},
                    {"type": "text", "text": prompt},
                ],
            }],
        )
    except anthropic.APIError as exc:
        logger.warning("Photo colour AI failed (%s); using the built-in analyser", type(exc).__name__)
        return None
    if response.stop_reason in ("refusal", "max_tokens"):
        return None
    text = next((b.text for b in response.content if b.type == "text"), "")
    try:
        return _only_known(json.loads(text).get("colors", []))
    except (json.JSONDecodeError, AttributeError):
        return None


# ---------------------------------------------------------------------------------------------
# Listings
# ---------------------------------------------------------------------------------------------

def detect_colors(image_path: str, title: str = "", category: str = "") -> list[str] | None:
    """Colours for one photo, or None if the photo couldn't be read."""
    image = load_image(image_path)
    if image is None:
        return None
    ai = colors_from_ai(image, title, category)
    return ai if ai is not None else colors_from_pixels(image)


def analyze_product(product_id: int) -> None:
    """Background task: analyse a listing's main photo and store the colours."""
    if not settings.photo_colors_enabled:
        return
    with SessionLocal() as db:
        product = db.get(Product, product_id, options=[selectinload(Product.images)])
        if product is None or not product.images:
            return
        colors = detect_colors(product.images[0].image_path, product.title, product.category)
        product.photo_colors = ",".join(colors) if colors is not None else ""
        db.commit()


def backfill() -> None:
    """Analyse listings that were created before photo analysis existed."""
    with SessionLocal() as db:
        ids = db.scalars(select(Product.id).where(Product.photo_colors.is_(None))).all()
    for product_id in ids:
        try:
            analyze_product(product_id)
        except Exception:  # keep going; one bad photo shouldn't stop the rest
            logger.exception("Photo colour analysis failed for listing %s", product_id)
        if gemini.enabled() and not settings.anthropic_api_key:
            time.sleep(5)  # stay under the free Gemini tier's per-minute limit


def start_backfill() -> None:
    if settings.photo_colors_enabled:
        threading.Thread(target=backfill, name="photo-colors", daemon=True).start()


if __name__ == "__main__":
    # python -m app.services.vision          analyse listings that have no colours yet
    # python -m app.services.vision --redo   re-analyse every listing (e.g. after adding an AI key)
    import sys

    from sqlalchemy import update

    logging.basicConfig(level=logging.INFO)
    if "--redo" in sys.argv:
        with SessionLocal() as db:
            db.execute(update(Product).values(photo_colors=None))
            db.commit()
    backfill()
    with SessionLocal() as db:
        for title, found in db.execute(select(Product.title, Product.photo_colors)).all():
            print(f"{title[:40]:40} {found or '-'}")

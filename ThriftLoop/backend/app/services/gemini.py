"""Minimal Google Gemini client (REST, standard library only) for JSON answers.

Used as the AI provider when GEMINI_API_KEY is set and no ANTHROPIC_API_KEY is. Returns None on any
problem so callers fall back to the built-in logic.
"""

from __future__ import annotations

import base64
import json
import logging
import urllib.error
import urllib.request

from app.core.config import settings

logger = logging.getLogger("thriftloop.gemini")

ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


def enabled() -> bool:
    return bool(settings.gemini_api_key)


def generate_json(prompt: str, schema: dict, *, system: str | None = None, image_jpeg: bytes | None = None,
                  timeout: float = 25.0) -> dict | None:
    if not settings.gemini_api_key:
        return None
    parts: list[dict] = [{"text": prompt}]
    if image_jpeg is not None:
        parts.append({"inline_data": {"mime_type": "image/jpeg", "data": base64.b64encode(image_jpeg).decode()}})
    body: dict = {
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": {"responseMimeType": "application/json", "responseJsonSchema": schema, "temperature": 0},
    }
    if system:
        body["systemInstruction"] = {"parts": [{"text": system}]}

    request = urllib.request.Request(
        ENDPOINT.format(model=settings.gemini_model),
        data=json.dumps(body).encode(),
        # Key in a header, not the URL, so it never ends up in logs.
        headers={"Content-Type": "application/json", "x-goog-api-key": settings.gemini_api_key},
        method="POST",
    )
    try:
        # Fixed https Google endpoint.
        with urllib.request.urlopen(request, timeout=timeout) as resp:  # nosec B310
            data = json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        detail = exc.read()[:300].decode(errors="replace")
        logger.warning("Gemini error %s: %s", exc.code, detail)
        return None
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        logger.warning("Gemini unreachable: %s", type(exc).__name__)
        return None

    try:
        candidate = data["candidates"][0]
        text = "".join(p.get("text", "") for p in candidate["content"]["parts"])
        return json.loads(text)
    except (KeyError, IndexError, TypeError, json.JSONDecodeError):
        logger.warning("Gemini returned no usable answer (%s)", data.get("promptFeedback") or "empty")
        return None

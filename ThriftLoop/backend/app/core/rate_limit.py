"""Simple in-memory sliding-window rate limiter.

Keyed by the signed-in user (from the JWT) or, for anonymous requests, by client IP.
Stricter buckets protect login/sign-up (brute force) and photo uploads (disk + CPU).
Good for a single-server deployment; use Redis if you run several API processes.
"""

import time
from collections import defaultdict, deque
from threading import Lock

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.config import settings
from app.core.security import decode_access_token

WINDOW_SECONDS = 60
AUTH_PATHS = ("/auth/login", "/auth/register", "/auth/verify-email", "/auth/resend-code")
UPLOAD_PATHS = ("/products", "/seller-applications", "/users/me")


class RateLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def hit(self, key: str, limit: int) -> int:
        """Record a request. Returns 0 if allowed, otherwise seconds until a slot frees up."""
        now = time.monotonic()
        with self._lock:
            bucket = self._hits[key]
            while bucket and now - bucket[0] >= WINDOW_SECONDS:
                bucket.popleft()
            if len(bucket) >= limit:
                return max(1, int(WINDOW_SECONDS - (now - bucket[0])) + 1)
            bucket.append(now)
            return 0

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


limiter = RateLimiter()


def _identity(request: Request) -> str:
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        user_id = decode_access_token(auth[7:])
        if user_id is not None:
            return f"user:{user_id}"
    return f"ip:{request.client.host if request.client else 'unknown'}"


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if not settings.rate_limit_enabled or request.method == "OPTIONS" or request.url.path.startswith("/uploads"):
            return await call_next(request)

        path = request.url.path
        checks = [(f"all:{_identity(request)}", settings.rate_limit_per_minute)]
        if path in AUTH_PATHS:
            ip = request.client.host if request.client else "unknown"
            checks.append((f"auth:{ip}", settings.rate_limit_auth_per_minute))
        elif request.method in ("POST", "PUT") and path in UPLOAD_PATHS:
            checks.append((f"upload:{_identity(request)}", settings.rate_limit_upload_per_minute))

        for key, limit in checks:
            wait = limiter.hit(key, limit)
            if wait:
                return JSONResponse(
                    status_code=429,
                    content={"detail": f"Too many requests. Please wait {wait} seconds and try again."},
                    headers={"Retry-After": str(wait)},
                )
        return await call_next(request)

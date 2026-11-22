from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.rate_limit import RateLimitMiddleware
from app.database import init_db
from app.routers import (
    admin,
    assistant,
    auth,
    conversations,
    favorites,
    orders,
    payments,
    products,
    promotions,
    sellers,
    users,
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    settings.private_upload_dir.mkdir(parents=True, exist_ok=True)
    init_db()
    if settings.seed_demo_data:
        from app.seed import seed

        seed()  # no-op when the database already has users
    from app.services.vision import start_backfill

    start_backfill()  # reads colours from photos of older listings, in the background
    yield


app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan)

app.add_middleware(RateLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
    """Flatten Pydantic errors into one readable sentence the app can show as-is."""
    messages = []
    for err in exc.errors():
        msg = str(err.get("msg", "Invalid value")).removeprefix("Value error, ")
        field = err.get("loc", [])[-1] if err.get("loc") else None
        if msg.startswith(("String should", "Input should", "Field required", "value is not")) and field:
            msg = f"{str(field).replace('_', ' ').capitalize()}: {msg.lower()}"
        messages.append(msg)
    return JSONResponse(status_code=422, content={"detail": " ".join(dict.fromkeys(messages))})


app.include_router(auth.router)
app.include_router(users.router)
app.include_router(products.router)
app.include_router(favorites.router)
app.include_router(conversations.router)
app.include_router(sellers.router)
app.include_router(orders.router)
app.include_router(payments.router)
app.include_router(promotions.router)
app.include_router(admin.router)
app.include_router(assistant.router)

settings.upload_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")


@app.get("/health", tags=["meta"])
def health() -> dict:
    return {"status": "ok"}

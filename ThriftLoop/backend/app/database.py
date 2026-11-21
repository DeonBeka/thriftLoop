from collections.abc import Generator

from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},
)


@event.listens_for(engine, "connect")
def _enable_sqlite_foreign_keys(dbapi_connection, _record) -> None:
    # SQLite ignores foreign keys (and ON DELETE CASCADE) unless this is enabled per connection.
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Columns added after the first release. create_all() only creates missing tables, so existing
# databases get these via ALTER TABLE (tiny, dependency-free migration step).
_ADDED_COLUMNS = {
    "users": {
        "role": "VARCHAR(20) NOT NULL DEFAULT 'viewer'",
        "terms_accepted_at": "DATETIME",
    },
}


def _migrate() -> None:
    inspector = inspect(engine)
    with engine.begin() as conn:
        for table, columns in _ADDED_COLUMNS.items():
            if not inspector.has_table(table):
                continue
            existing = {c["name"] for c in inspector.get_columns(table)}
            for name, ddl in columns.items():
                if name not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))
                    if table == "users" and name == "role":
                        # Anyone who already had listings keeps selling.
                        conn.execute(text(
                            "UPDATE users SET role='seller' WHERE id IN (SELECT DISTINCT seller_id FROM products)"
                        ))


def sync_admins(db: Session) -> None:
    """Admins come only from ADMIN_EMAILS in backend/.env — there is no API to grant admin."""
    from app.models import User

    emails = settings.admin_email_set
    for user in db.query(User).filter(User.role == "admin").all():
        if user.email.lower() not in emails:
            user.role = "seller" if user.products else "viewer"
    if emails:
        for user in db.query(User).filter(User.email.in_(emails)).all():
            user.role = "admin"
    db.commit()


def init_db() -> None:
    from app import models  # noqa: F401  (registers models on Base.metadata)

    Base.metadata.create_all(bind=engine)
    _migrate()
    with SessionLocal() as db:
        sync_admins(db)

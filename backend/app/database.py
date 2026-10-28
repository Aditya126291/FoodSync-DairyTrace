"""Database configuration for DairyTrace (SQLite default, PostgreSQL compatible)."""

import os
import warnings
from typing import Generator
from sqlalchemy import create_engine, event
from sqlalchemy.engine import make_url
from sqlalchemy.orm import declarative_base, sessionmaker, Session

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_DB_PATH = os.path.join(BASE_DIR, "dairytrace.db").replace("\\", "/")
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DEFAULT_DB_PATH}")

# Handle Heroku/Render style postgres:// URLs transparently
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

APP_ENV = os.getenv("APP_ENV", "development").strip().lower()
if APP_ENV == "production" and not os.getenv("DATABASE_URL"):
    raise RuntimeError("DATABASE_URL is required in production.")
if APP_ENV == "production" and DATABASE_URL.startswith("sqlite"):
    raise RuntimeError("Production requires PostgreSQL. Set DATABASE_URL to a managed PostgreSQL connection string.")
if DATABASE_URL.startswith("postgresql"):
    db_url = make_url(DATABASE_URL)
    if APP_ENV == "production" and "sslmode" not in db_url.query:
        db_url = db_url.update_query_dict({"sslmode": os.getenv("DB_SSLMODE", "require")})
    DATABASE_URL = db_url.render_as_string(hide_password=False)

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
pool_options = {}
if DATABASE_URL.startswith("postgresql"):
    pool_options = {
        "pool_pre_ping": True,
        "pool_size": int(os.getenv("DB_POOL_SIZE", "5")),
        "max_overflow": int(os.getenv("DB_MAX_OVERFLOW", "10")),
        "pool_recycle": int(os.getenv("DB_POOL_RECYCLE_SECONDS", "1800")),
    }
    if pool_options["pool_size"] < 1 or pool_options["max_overflow"] < 0 or pool_options["pool_recycle"] < 1:
        raise RuntimeError("PostgreSQL pool settings must be positive (max overflow may be zero).")

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    future=True,
    **pool_options,
)

# Enable SQLite foreign key enforcement
if DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)

Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency yielding a SQLAlchemy database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create the local SQLite schema for development and tests only."""
    if not DATABASE_URL.startswith("sqlite"):
        warnings.warn("PostgreSQL schema is managed by Alembic; run `alembic upgrade head`.", RuntimeWarning)
        return
    from app import models  # noqa: F401
    Base.metadata.create_all(bind=engine)

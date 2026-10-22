"""Database configuration for DairyTrace (SQLite default, PostgreSQL compatible)."""

import os
from typing import Generator
from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker, Session

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_DB_PATH = os.path.join(BASE_DIR, "dairytrace.db").replace("\\", "/")
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DEFAULT_DB_PATH}")

# Handle Heroku/Render style postgres:// URLs transparently
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    future=True,
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
    """Create all database tables if they do not exist."""
    from app import models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    # create_all does not alter existing tables; add nullable lookup fields safely.
    inspector = inspect(engine)
    if "batches" in inspector.get_table_names():
        columns = {column["name"] for column in inspector.get_columns("batches")}
        with engine.begin() as connection:
            if "sku" not in columns:
                connection.execute(text("ALTER TABLE batches ADD COLUMN sku VARCHAR(80)"))
            if "serial_number" not in columns:
                connection.execute(text("ALTER TABLE batches ADD COLUMN serial_number VARCHAR(120)"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_batches_sku ON batches (sku)"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_batches_serial_number ON batches (serial_number)"))

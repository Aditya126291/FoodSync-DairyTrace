"""Shared test database setup and fixtures for Pytest and Unittest."""

import os
import sys
import warnings
from contextlib import contextmanager
from typing import Generator

warnings.filterwarnings(
    "ignore",
    message=r".*Using `httpx` with `starlette\.testclient` is deprecated.*",
)

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

# Ensure backend/ is on sys.path regardless of where pytest/python is invoked from
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app import models  # noqa: F401, E402


def create_isolated_test_session() -> tuple[Session, sessionmaker, any]:
    """Creates a brand-new in-memory SQLite database engine and session with all tables initialized."""
    test_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )

    @event.listens_for(test_engine, "connect")
    def _enable_fk(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(bind=test_engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine, future=True)
    return TestingSessionLocal(), TestingSessionLocal, test_engine


@contextmanager
def isolated_db_session() -> Generator[Session, None, None]:
    """Context manager yielding a fresh, isolated in-memory SQLite session."""
    session, _, test_engine = create_isolated_test_session()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=test_engine)
        test_engine.dispose()


@contextmanager
def isolated_test_client() -> Generator[tuple[TestClient, Session], None, None]:
    """Context manager yielding a FastAPI TestClient bound to an isolated in-memory SQLite database."""
    session, TestingSessionLocal, test_engine = create_isolated_test_session()

    def _override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _override_get_db
    try:
        with TestClient(app) as client:
            yield client, session
    finally:
        app.dependency_overrides.clear()
        session.close()
        Base.metadata.drop_all(bind=test_engine)
        test_engine.dispose()


# Register Pytest fixtures if pytest is installed
try:
    import pytest  # type: ignore

    @pytest.fixture()
    def db_session() -> Generator[Session, None, None]:
        with isolated_db_session() as session:
            yield session

    @pytest.fixture()
    def client() -> Generator[TestClient, None, None]:
        with isolated_test_client() as (test_client, _):
            yield test_client
except ImportError:
    pass

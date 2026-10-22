"""Shared test database setup and fixtures for Pytest and Unittest."""

import os
import sys
import warnings

os.environ.setdefault("BCRYPT_ROUNDS", "4")  # fast hashing in tests
os.environ.setdefault("JWT_SECRET", "test-secret-not-for-production-0123456789")
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


DEMO_PASSWORDS = {"INSPECTOR": ("inspector@dairytrace.demo", "Inspect@2026"), "QA_OFFICER": ("qa@dairytrace.demo", "QaOfficer@2026")}


def login_headers(client: TestClient, role: str) -> dict[str, str]:
    email, password = DEMO_PASSWORDS[role]
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


@contextmanager
def isolated_test_client(role: str | None = "QA_OFFICER") -> Generator[tuple[TestClient, Session], None, None]:
    """FastAPI TestClient bound to an isolated in-memory DB.

    Demo staff users are seeded; the client is signed in as `role` by default (pass None for anonymous).
    `client.reseed()` loads the Tech4Food sample genealogy directly through the DB session.
    """
    from app.security import reset_rate_limits
    from app.seed_data import seed_demo_users, seed_tech4food_scenario

    reset_rate_limits()
    session, TestingSessionLocal, test_engine = create_isolated_test_session()
    seed_demo_users(session)

    def _override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _override_get_db
    try:
        with TestClient(app) as client:
            client.reseed = lambda: seed_tech4food_scenario(session)  # type: ignore[attr-defined]
            client.login_headers = lambda r: login_headers(client, r)  # type: ignore[attr-defined]
            if role:
                client.headers.update(login_headers(client, role))
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

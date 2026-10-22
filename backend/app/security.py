"""Authentication & role-based access control (JWT + bcrypt).

Roles are stored in the `users` table and embedded in the signed token. The client
never picks its own role; every protected route resolves the user from the database.
"""

from __future__ import annotations

import os
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from typing import Callable, Deque

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User

ROLE_INSPECTOR = "INSPECTOR"
ROLE_QA = "QA_OFFICER"
STAFF_ROLES = (ROLE_INSPECTOR, ROLE_QA)

_DEV_SECRET = "dev-only-insecure-secret-change-me-0123456789"
JWT_SECRET = os.getenv("JWT_SECRET", _DEV_SECRET)
JWT_ALGORITHM = "HS256"
TOKEN_TTL_MINUTES = int(os.getenv("TOKEN_TTL_MINUTES", "480"))
MAX_FAILED_LOGINS = 5
LOCKOUT_MINUTES = 15

_bearer = HTTPBearer(auto_error=False)


def assert_production_ready() -> None:
    """Refuse to boot in production with the built-in development secret."""
    if os.getenv("APP_ENV", "development").lower() == "production" and JWT_SECRET == _DEV_SECRET:
        raise RuntimeError("JWT_SECRET must be set when APP_ENV=production.")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8")[:72], bcrypt.gensalt(rounds=int(os.getenv("BCRYPT_ROUNDS", "12")))).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8")[:72], password_hash.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),
        "role": user.role,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=TOKEN_TTL_MINUTES)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _unauthorized(detail: str = "Authentication required.") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise _unauthorized()
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise _unauthorized("Session expired or invalid. Please sign in again.")
    user = db.query(User).filter_by(id=user_id).first()
    if user is None or not user.is_active:
        raise _unauthorized("Account is not active.")
    return user


def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User | None:
    """Return the signed-in staff user if a valid token is supplied, otherwise None."""
    if credentials is None:
        return None
    try:
        return get_current_user(credentials, db)
    except HTTPException:
        return None


def require_roles(*roles: str) -> Callable[..., User]:
    """Dependency factory: allow only users whose DB-stored role is in `roles`."""

    def _checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your role is not permitted to perform this action.",
            )
        return user

    return _checker


require_staff = require_roles(*STAFF_ROLES)
require_qa = require_roles(ROLE_QA)


# ---------------------------------------------------------------------------
# Minimal in-memory sliding-window rate limiter for public endpoints.
# (Single-process; swap for Redis if the API is scaled out.)
# ---------------------------------------------------------------------------
_hits: dict[str, Deque[float]] = defaultdict(deque)


def rate_limit(name: str, limit: int, window_seconds: int) -> Callable[..., None]:
    def _limiter(request: Request) -> None:
        if os.getenv("DISABLE_RATE_LIMIT") == "1":
            return
        client = request.client.host if request.client else "unknown"
        key = f"{name}:{client}"
        now = time.monotonic()
        bucket = _hits[key]
        while bucket and now - bucket[0] > window_seconds:
            bucket.popleft()
        if len(bucket) >= limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please wait a few minutes and try again.",
            )
        bucket.append(now)

    return _limiter


def reset_rate_limits() -> None:
    _hits.clear()

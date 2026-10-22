"""Staff authentication endpoints. There is deliberately no self-signup."""

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.audit import write_audit
from app.database import get_db
from app.models import User
from app.security import (
    LOCKOUT_MINUTES,
    MAX_FAILED_LOGINS,
    _utcnow,
    create_access_token,
    get_current_user,
    rate_limit,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])

_INVALID = "Invalid email or password."


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=160)
    password: str = Field(..., min_length=1, max_length=200)


def _public_user(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "organisation": user.organisation,
        "role": user.role,
    }


@router.post("/login", dependencies=[Depends(rate_limit("login", 20, 300))])
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> dict:
    user = db.query(User).filter(User.email == payload.email.strip().lower()).first()
    now = _utcnow()

    if user is not None and user.locked_until and user.locked_until > now:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed attempts. Try again in a few minutes.",
        )

    if user is None or not user.is_active or not verify_password(payload.password, user.password_hash):
        if user is not None:
            user.failed_logins = (user.failed_logins or 0) + 1
            if user.failed_logins >= MAX_FAILED_LOGINS:
                user.locked_until = now + timedelta(minutes=LOCKOUT_MINUTES)
                user.failed_logins = 0
            db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=_INVALID)

    user.failed_logins = 0
    user.locked_until = None
    user.last_login_at = now
    write_audit(db, user, "LOGIN", "user", user.id)
    db.commit()
    return {"access_token": create_access_token(user), "token_type": "bearer", "user": _public_user(user)}


@router.get("/me")
def me(user: User = Depends(get_current_user)) -> dict:
    return _public_user(user)

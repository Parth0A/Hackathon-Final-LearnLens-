import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Callable
from uuid import uuid4

from fastapi import Depends, HTTPException, Request, Response, status

from lib.db import db


COOKIE_NAME = os.environ.get("AUTH_COOKIE_NAME", "learnlens_session")
SESSION_DAYS = 7
PBKDF2_ITERATIONS = 600_000
LEGACY_PBKDF2_ITERATIONS = 180_000


def hash_password(password: str, salt: str | None = None) -> str:
    salt_value = salt or secrets.token_hex(16)
    derived = hashlib.pbkdf2_hmac("sha256", password.encode(), salt_value.encode(), PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt_value}${derived.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        parts = stored.split("$")
        if len(parts) == 4 and parts[0] == "pbkdf2_sha256":
            _, iterations_text, salt, expected = parts
            iterations = int(iterations_text)
        elif len(parts) == 2:
            salt, expected = parts
            iterations = LEGACY_PBKDF2_ITERATIONS
        else:
            return False
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), iterations).hex()
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def password_needs_rehash(stored: str) -> bool:
    try:
        parts = stored.split("$")
        if len(parts) != 4 or parts[0] != "pbkdf2_sha256":
            return True
        return int(parts[1]) < PBKDF2_ITERATIONS
    except (ValueError, TypeError):
        return True


def public_user(user: dict[str, Any]) -> dict[str, Any]:
    return {key: user.get(key) for key in ("id", "email", "name", "role", "student_id", "class_name", "about", "avatar_url")}


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def create_session(user_id: str, response: Response, request: Request) -> None:
    token = secrets.token_urlsafe(40)
    now = datetime.now(timezone.utc)
    expires = now + timedelta(days=SESSION_DAYS)
    await db.sessions.insert_one({
        "id": str(uuid4()), "user_id": user_id, "token_hash": token_digest(token),
        "created_at": now.isoformat(), "expires_at": expires.isoformat(),
    })
    is_secure = request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https"
    same_site = os.environ.get("AUTH_COOKIE_SAMESITE", "lax").strip().lower()
    if same_site not in {"lax", "strict", "none"}:
        same_site = "lax"
    if same_site == "none" and not is_secure:
        same_site = "lax"
    response.set_cookie(COOKIE_NAME, token, max_age=SESSION_DAYS * 86400, httponly=True, secure=is_secure, samesite=same_site, path="/")


async def require_user(request: Request) -> dict[str, Any]:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sign in to continue")
    session = await db.sessions.find_one({"token_hash": token_digest(token)})
    if not session or session.get("expires_at", "") <= datetime.now(timezone.utc).isoformat():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")
    user = await db.users.find_one({"id": session["user_id"], "active": True})
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account unavailable")
    return user


async def optional_user(request: Request) -> dict[str, Any] | None:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return None
    session = await db.sessions.find_one({"token_hash": token_digest(token)})
    if not session or session.get("expires_at", "") <= datetime.now(timezone.utc).isoformat():
        return None
    return await db.users.find_one({"id": session["user_id"], "active": True})


def require_role(role: str) -> Callable[..., Any]:
    async def guard(user: dict[str, Any] = Depends(require_user)) -> dict[str, Any]:
        if user.get("role") != role:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"{role.title()} access required")
        return user
    return guard


def require_own_student(user: dict[str, Any], student_id: str) -> None:
    if user.get("role") != "student" or user.get("student_id") != student_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can access only your own learning data")
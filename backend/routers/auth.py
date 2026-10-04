import os
import hmac
import hashlib
import secrets
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile

from lib.db import db
from models.access import AuthResponse, LoginRequest, ProfileUpdateRequest, RegisterRequest, UserResponse
from services.auth import COOKIE_NAME, create_session, hash_password, optional_user, password_needs_rehash, public_user, require_user, token_digest, verify_password
from services.curriculum import CONCEPTS
from services.seeding import now_iso
from services.storage import MAX_FILE_BYTES, delete_object, get_object, put_object


router = APIRouter(prefix="/auth")

PBKDF2_ITERATIONS = 600_000
LEGACY_PBKDF2_ITERATIONS = 180_000
LOGIN_WINDOW_SECONDS = 900
LOGIN_MAX_ATTEMPTS = 10
ADMIN_REQUEST_WINDOW_SECONDS = 900
ADMIN_REQUEST_MAX = 3
ADMIN_VERIFY_WINDOW_SECONDS = 600
ADMIN_VERIFY_MAX = 6


def _client_key(request: Request, scope: str, identity: str = "") -> str:
    host = request.client.host if request.client else "unknown"
    return f"{scope}:{identity.lower()}:{host}"


async def _rate_limited(key: str, max_attempts: int, window_seconds: int) -> bool:
    now = datetime.now(timezone.utc).timestamp()
    record = await db.security_rate_limits.find_one({"key": key})
    if not record or now - float(record.get("window_started", 0)) >= window_seconds:
        await db.security_rate_limits.update_one(
            {"key": key},
            {"$set": {"attempts": 1, "window_started": now, "updated_at": now_iso()}},
            upsert=True,
        )
        return False
    attempts = int(record.get("attempts", 0))
    if attempts >= max_attempts:
        return True
    await db.security_rate_limits.update_one(
        {"key": key},
        {"$inc": {"attempts": 1}, "$set": {"updated_at": now_iso()}},
    )
    return False


async def _clear_rate_limit(key: str) -> None:
    await db.security_rate_limits.delete_one({"key": key})


@router.post("/register", response_model=AuthResponse)
async def register(payload: RegisterRequest, request: Request, response: Response) -> AuthResponse:
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="An account already exists for this email")
    if payload.role == "teacher" and not payload.teacher_verification_code:
        raise HTTPException(status_code=403, detail="A valid teacher verification code is required")
    if payload.role == "teacher" and not hmac.compare_digest(payload.teacher_verification_code or "", os.environ.get("TEACHER_VERIFICATION_CODE", "")):
        raise HTTPException(status_code=403, detail="A valid teacher verification code is required")
    user_id = str(uuid4())
    student_id = user_id if payload.role == "student" else None
    user = {
        "id": user_id, "email": email, "name": payload.name, "role": payload.role,
        "student_id": student_id, "class_name": payload.class_name, "about": "",
        "avatar_url": None, "password_hash": hash_password(payload.password), "active": True,
        "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    if student_id:
        await db.students.insert_one({"id": student_id, "name": payload.name, "education_level": payload.class_name or "Student"})
        await db.learning_states.insert_many([{
            "student_id": student_id, "concept_id": concept["id"], "mastery": 0.0,
            "attempts": 0, "correct_attempts": 0, "incorrect_attempts": 0,
            "root_gap": None, "confidence": None, "recovery_status": "not_started", "updated_at": now_iso(),
        } for concept in CONCEPTS])
    await create_session(user_id, response, request)
    return AuthResponse(user=UserResponse(**public_user(user)), message="Account created")


@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest, request: Request, response: Response) -> AuthResponse:
    email = payload.email.lower()
    key = _client_key(request, "login", email)
    if await _rate_limited(key, LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_SECONDS):
        raise HTTPException(status_code=429, detail="Too many sign-in attempts. Please try again later.")
    user = await db.users.find_one({"email": email, "active": True})
    stored_hash = user.get("password_hash", "") if user else ""
    if not user or not verify_password(payload.password, stored_hash):
        raise HTTPException(status_code=401, detail="Email or password is incorrect")
    if password_needs_rehash(stored_hash):
        await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": hash_password(payload.password), "updated_at": now_iso()}})
    await _clear_rate_limit(key)
    await create_session(user["id"], response, request)
    return AuthResponse(user=UserResponse(**public_user(user)), message="Signed in")


@router.get("/me", response_model=UserResponse)
async def me(user: dict = Depends(require_user)) -> UserResponse:
    return UserResponse(**public_user(user))


@router.get("/session", response_model=UserResponse | None)
async def session(user: dict | None = Depends(optional_user)) -> UserResponse | None:
    return UserResponse(**public_user(user)) if user else None


@router.patch("/profile", response_model=UserResponse)
async def update_profile(payload: ProfileUpdateRequest, user: dict = Depends(require_user)) -> UserResponse:
    values = {"name": payload.name, "class_name": payload.class_name, "about": payload.about, "updated_at": now_iso()}
    await db.users.update_one({"id": user["id"]}, {"$set": values})
    if user.get("student_id"):
        await db.students.update_one({"id": user["student_id"]}, {"$set": {"name": payload.name, "education_level": payload.class_name or "Student"}})
    user.update(values)
    return UserResponse(**public_user(user))


@router.post("/profile/avatar", response_model=UserResponse)
async def upload_profile_avatar(file: UploadFile = File(...), user: dict = Depends(require_user)) -> UserResponse:
    allowed_types = {"image/jpeg", "image/png", "image/webp"}
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Use a JPG, PNG, or WebP image.")
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="The image is empty.")
    if len(content) > 2 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Profile photos must be 2 MB or smaller.")

    extension = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}[file.content_type]
    path = f"profiles/{user['id']}/avatar/{uuid4()}{extension}"
    old_path = user.get("avatar_path")
    await put_object(path, content, file.content_type)
    if old_path:
        await delete_object(old_path)

    avatar_url = f"/api/auth/avatar/{user['id']}?v={int(datetime.now(timezone.utc).timestamp())}"
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"avatar_path": path, "avatar_url": avatar_url, "updated_at": now_iso()}},
    )
    user.update({"avatar_path": path, "avatar_url": avatar_url})
    return UserResponse(**public_user(user))


@router.get("/avatar/{user_id}")
async def get_profile_avatar(user_id: str):
    user = await db.users.find_one({"id": user_id, "active": True}, {"avatar_path": 1})
    if not user or not user.get("avatar_path"):
        raise HTTPException(status_code=404, detail="Profile photo not found")
    try:
        content, content_type = await get_object(user["avatar_path"])
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Profile photo not found")
    return Response(content=content, media_type=content_type, headers={"Cache-Control": "private, max-age=300"})


@router.post("/logout", status_code=204)
async def logout(request: Request, response: Response) -> None:
    token = request.cookies.get(COOKIE_NAME)
    if token:
        await db.sessions.delete_many({"token_hash": token_digest(token)})
    response.delete_cookie(COOKIE_NAME, path="/")


@router.post("/admin/request-verification")
async def request_admin_verification(request: Request) -> dict:
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com").strip().lower()
    resend_key = os.environ.get("RESEND_API_KEY", "").strip()
    sender = os.environ.get("EMAIL_FROM", "").strip()
    request_key = _client_key(request, "admin-request")
    if await _rate_limited(request_key, ADMIN_REQUEST_MAX, ADMIN_REQUEST_WINDOW_SECONDS):
        raise HTTPException(status_code=429, detail="Too many verification requests. Please try again later.")
    if not resend_key or not sender:
        raise HTTPException(status_code=503, detail="Admin email verification is not configured yet")
    code = f"{secrets.randbelow(1000000):06d}"
    await db.admin_verifications.delete_many({"email": admin_email})
    await db.admin_verifications.insert_one({
        "email": admin_email, "code_hash": hash_password(code),
        "expires_at": datetime.now(timezone.utc).timestamp() + 600,
        "created_at": now_iso(),
    })
    import requests
    result = requests.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {resend_key}", "Content-Type": "application/json"},
        json={"from": sender, "to": [admin_email], "subject": "LearnLens Admin verification",
              "html": f"<p>Your LearnLens Admin verification code is <strong>{code}</strong>.</p><p>This code expires in 10 minutes.</p>"},
        timeout=15,
    )
    if result.status_code >= 300:
        await db.admin_verifications.delete_many({"email": admin_email})
        raise HTTPException(status_code=502, detail="Could not send the admin verification email")
    return {"message": "Verification email sent"}


@router.post("/admin/verify", response_model=AuthResponse)
async def verify_admin(payload: dict, request: Request, response: Response) -> AuthResponse:
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com").strip().lower()
    code = str(payload.get("code", "")).strip()
    if not code.isdigit() or len(code) != 6:
        raise HTTPException(status_code=422, detail="Enter a valid 6-digit verification code")
    verify_key = _client_key(request, "admin-verify")
    if await _rate_limited(verify_key, ADMIN_VERIFY_MAX, ADMIN_VERIFY_WINDOW_SECONDS):
        raise HTTPException(status_code=429, detail="Too many verification attempts. Please try again later.")
    record = await db.admin_verifications.find_one({"email": admin_email})
    if not record or record.get("expires_at", 0) < datetime.now(timezone.utc).timestamp():
        raise HTTPException(status_code=401, detail="Verification code expired or unavailable")
    if not verify_password(code, record.get("code_hash", "")):
        raise HTTPException(status_code=401, detail="Incorrect verification code")
    await db.admin_verifications.delete_many({"email": admin_email})
    await _clear_rate_limit(verify_key)
    admin_id = "learnlens-admin"
    user = await db.users.find_one({"id": admin_id})
    if not user:
        user = {"id": admin_id, "email": admin_email, "name": "LearnLens Admin", "role": "admin",
                "student_id": None, "class_name": None, "about": "", "avatar_url": None, "active": True}
        await db.users.insert_one(user)
    await create_session(admin_id, response, request)
    return AuthResponse(user=UserResponse(**public_user(user)), message="Admin verified")

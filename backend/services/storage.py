"""File storage backed by MongoDB GridFS.

All uploaded bytes (Library files and profile avatars) live in GridFS inside the
same MongoDB database as the rest of LearnLens. A record's ``storage_path`` is
the GridFS file id, which is unique per upload: replacing a file always writes a
new id and deletes the old object, so retrieval can never return a stale file.
"""

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from gridfs.errors import NoFile
from motor.motor_asyncio import AsyncIOMotorGridFSBucket

from lib.db import db


APP_NAME = "learnlens"
USER_QUOTA_BYTES = 500 * 1024 * 1024
MAX_FILE_BYTES = 50 * 1024 * 1024
MAX_AVATAR_BYTES = 5 * 1024 * 1024
ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ppt", ".pptx", ".doc", ".docx", ".txt", ".md", ".csv"}
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp"}

# GridFS bucket for the shared application database ("fs.files" / "fs.chunks").
bucket = AsyncIOMotorGridFSBucket(db)


def storage_enabled() -> bool:
    # Storage is MongoDB-backed, so it is always available wherever the app runs.
    return True


def validate_file(filename: str, content: bytes) -> str:
    extension = Path(filename).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise ValueError("Unsupported file type")
    if len(content) > MAX_FILE_BYTES:
        raise ValueError("Files must be 50 MB or smaller")
    return extension


def validate_image(filename: str, content: bytes) -> str:
    extension = Path(filename).suffix.lower()
    if extension not in IMAGE_EXTENSIONS:
        raise ValueError("Avatar must be a PNG, JPG, GIF, or WEBP image")
    if len(content) > MAX_AVATAR_BYTES:
        raise ValueError("Avatar must be 5 MB or smaller")
    return extension


async def put_object(path: str, content: bytes, content_type: str) -> dict[str, Any]:
    """Store bytes in GridFS and return the opaque record fields callers persist."""
    file_id = await bucket.upload_from_stream(
        path,
        content,
        metadata={"content_type": content_type, "uploaded_at": datetime.now(timezone.utc).isoformat()},
    )
    return {"path": str(file_id), "size": len(content), "content_type": content_type}


async def get_object(path: str) -> tuple[bytes, str]:
    try:
        file_id = ObjectId(path)
    except (InvalidId, TypeError):
        raise FileNotFoundError(path)
    try:
        stream = await bucket.open_download_stream(file_id)
    except NoFile:
        raise FileNotFoundError(path)
    data = await stream.read()
    content_type = (stream.metadata or {}).get("content_type") or "application/octet-stream"
    return data, content_type


async def delete_object(path: str | None) -> None:
    """Best-effort delete; storage cleanup must never fail the caller's request."""
    if not path:
        return
    try:
        await bucket.delete(ObjectId(path))
    except (InvalidId, TypeError, NoFile):
        return
    except Exception:
        return

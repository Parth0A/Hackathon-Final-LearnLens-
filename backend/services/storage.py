from io import BytesIO
from pathlib import Path
from typing import Any

from motor.motor_asyncio import AsyncIOMotorGridFSBucket

from lib.db import db


APP_NAME = "learnlens"
USER_QUOTA_BYTES = 500 * 1024 * 1024
MAX_FILE_BYTES = 50 * 1024 * 1024
ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ppt", ".pptx", ".doc", ".docx", ".txt", ".md", ".csv"}


def storage_enabled() -> bool:
    return True


def validate_file(filename: str, content: bytes) -> str:
    extension = Path(filename).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise ValueError("Unsupported file type")
    if len(content) > MAX_FILE_BYTES:
        raise ValueError("Files must be 50 MB or smaller")
    return extension


def _bucket() -> AsyncIOMotorGridFSBucket:
    return AsyncIOMotorGridFSBucket(db, bucket_name="library_files")


async def put_object(path: str, content: bytes, content_type: str) -> dict[str, Any]:
    file_id = await _bucket().upload_from_stream(
        path,
        content,
        metadata={"app": APP_NAME, "content_type": content_type},
    )
    return {"path": path, "size": len(content), "file_id": str(file_id)}


async def get_object(path: str) -> tuple[bytes, str]:
    record = await db.library_files.files.find_one({"filename": path})
    if not record:
        raise FileNotFoundError(path)
    stream = await _bucket().open_download_stream(record["_id"])
    content = await stream.read()
    metadata = record.get("metadata") or {}
    return content, metadata.get("content_type") or record.get("contentType") or "application/octet-stream"


async def delete_object(path: str) -> None:
    record = await db.library_files.files.find_one({"filename": path})
    if record:
        await _bucket().delete(record["_id"])

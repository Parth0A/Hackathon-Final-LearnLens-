import os
from pathlib import Path
from typing import Any

import httpx


APP_NAME = "learnlens"
USER_QUOTA_BYTES = 500 * 1024 * 1024
MAX_FILE_BYTES = 50 * 1024 * 1024
ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ppt", ".pptx", ".doc", ".docx", ".txt", ".md", ".csv"}
storage_key: str | None = None


def storage_enabled() -> bool:
    return bool((os.environ.get("EMERGENT_LLM_KEY") or "").strip())


def validate_file(filename: str, content: bytes) -> str:
    extension = Path(filename).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise ValueError("Unsupported file type")
    if len(content) > MAX_FILE_BYTES:
        raise ValueError("Files must be 50 MB or smaller")
    return extension


def storage_url() -> str:
    base = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
    return base.rstrip("/") + "/objstore/api/v1/storage"


async def init_storage(force: bool = False) -> str:
    global storage_key
    if storage_key and not force:
        return storage_key
    emergent_key = (os.environ.get("EMERGENT_LLM_KEY") or "").strip()
    if not emergent_key:
        raise RuntimeError("File storage is disabled until an Emergent integration key is provided")
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(f"{storage_url()}/init", json={"emergent_key": emergent_key})
        response.raise_for_status()
        storage_key = response.json()["storage_key"]
        return storage_key


async def put_object(path: str, content: bytes, content_type: str) -> dict[str, Any]:
    key = await init_storage()
    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.put(f"{storage_url()}/objects/{path}", headers={"X-Storage-Key": key, "Content-Type": content_type}, content=content)
        if response.status_code == 404:
            key = await init_storage(force=True)
            response = await client.put(f"{storage_url()}/objects/{path}", headers={"X-Storage-Key": key, "Content-Type": content_type}, content=content)
        response.raise_for_status()
        return response.json()


async def get_object(path: str) -> tuple[bytes, str]:
    key = await init_storage()
    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.get(f"{storage_url()}/objects/{path}", headers={"X-Storage-Key": key})
        if response.status_code == 404:
            key = await init_storage(force=True)
            response = await client.get(f"{storage_url()}/objects/{path}", headers={"X-Storage-Key": key})
        response.raise_for_status()
        return response.content, response.headers.get("Content-Type", "application/octet-stream")
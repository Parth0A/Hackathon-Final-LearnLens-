from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile

from lib.db import db
from models.access import FolderCreateRequest, LibraryFolder, LibraryItem, LibraryItemUpdate, NoteCreateRequest, StorageStatus
from services.auth import require_user
from services.seeding import now_iso
from services.storage import APP_NAME, USER_QUOTA_BYTES, delete_object, get_object, put_object, storage_enabled, validate_file


router = APIRouter(prefix="/library")


async def usage_for(owner_id: str) -> int:
    items = await db.library_items.find({"owner_id": owner_id, "is_deleted": False}).to_list(2000)
    return sum(int(item.get("size", 0)) for item in items)


def item_model(item: dict[str, Any]) -> LibraryItem:
    return LibraryItem(**item)


@router.get("/storage", response_model=StorageStatus)
async def storage_status(user: dict = Depends(require_user)) -> StorageStatus:
    used = await usage_for(user["id"])
    enabled = storage_enabled()
    return StorageStatus(enabled=enabled, provider="MongoDB GridFS", limit_bytes=USER_QUOTA_BYTES, used_bytes=used, message="MongoDB storage connected")


@router.get("/folders", response_model=list[LibraryFolder])
async def list_folders(user: dict = Depends(require_user)) -> list[LibraryFolder]:
    return [LibraryFolder(**item) for item in await db.library_folders.find({"owner_id": user["id"]}).sort("created_at", 1).to_list(1000)]


@router.post("/folders", response_model=LibraryFolder)
async def create_folder(payload: FolderCreateRequest, user: dict = Depends(require_user)) -> LibraryFolder:
    if payload.parent_id and not await db.library_folders.find_one({"id": payload.parent_id, "owner_id": user["id"]}):
        raise HTTPException(status_code=404, detail="Parent folder not found")
    item = {"id": str(uuid4()), "owner_id": user["id"], "name": payload.name, "parent_id": payload.parent_id, "created_at": now_iso()}
    await db.library_folders.insert_one(item)
    return LibraryFolder(**item)


@router.get("/items", response_model=list[LibraryItem])
async def list_items(search: str = Query(default="", max_length=100), folder_id: str | None = None, user: dict = Depends(require_user)) -> list[LibraryItem]:
    query: dict[str, Any] = {"owner_id": user["id"], "is_deleted": False}
    if folder_id:
        query["folder_id"] = folder_id
    if search:
        query["name"] = {"$regex": search, "$options": "i"}
    return [item_model(item) for item in await db.library_items.find(query).sort("updated_at", -1).to_list(1000)]


@router.post("/notes", response_model=LibraryItem)
async def create_note(payload: NoteCreateRequest, user: dict = Depends(require_user)) -> LibraryItem:
    content_size = len(payload.content.encode())
    if await usage_for(user["id"]) + content_size > USER_QUOTA_BYTES:
        raise HTTPException(status_code=413, detail="Your 500 MB Library limit has been reached")
    if payload.folder_id and not await db.library_folders.find_one({"id": payload.folder_id, "owner_id": user["id"]}):
        raise HTTPException(status_code=404, detail="Folder not found")
    now = now_iso()
    item = {"id": str(uuid4()), "owner_id": user["id"], "kind": "note", "name": payload.name, "content_type": "text/plain", "size": content_size, "folder_id": payload.folder_id, "favorite": False, "storage_path": None, "content": payload.content, "source_metadata": {"source": "Personal LearnLens note"}, "retrieval_status": "not_applicable", "is_deleted": False, "created_at": now, "updated_at": now}
    try:
        await db.library_items.insert_one(item)
    except Exception:
        await delete_object(storage_path)
        raise
    return item_model(item)


@router.post("/upload", response_model=LibraryItem)
async def upload_file(file: UploadFile = File(...), folder_id: str | None = None, user: dict = Depends(require_user)) -> LibraryItem:
    if folder_id and not await db.library_folders.find_one({"id": folder_id, "owner_id": user["id"]}):
        raise HTTPException(status_code=404, detail="Folder not found")
    content = await file.read()
    try:
        extension = validate_file(file.filename or "file", content)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if await usage_for(user["id"]) + len(content) > USER_QUOTA_BYTES:
        raise HTTPException(status_code=413, detail="Your 500 MB Library limit has been reached")
    storage_path = f"{APP_NAME}/uploads/{user['id']}/{uuid4()}{extension}"
    result = await put_object(storage_path, content, file.content_type or "application/octet-stream")
    now = now_iso()
    is_teacher_resource = user["role"] == "teacher"
    item = {"id": str(uuid4()), "owner_id": user["id"], "kind": "file", "name": file.filename or f"resource{extension}", "content_type": file.content_type or "application/octet-stream", "size": int(result.get("size", len(content))), "folder_id": folder_id, "favorite": False, "storage_path": result["path"], "content": None, "source_metadata": {"source": "Teacher-uploaded course material" if is_teacher_resource else "Personal student library", "original_filename": file.filename or "resource", "owner_role": user["role"]}, "retrieval_status": "ready_for_future_retrieval" if is_teacher_resource else "not_applicable", "is_deleted": False, "created_at": now, "updated_at": now}
    await db.library_items.insert_one(item)
    return item_model(item)


@router.patch("/items/{item_id}", response_model=LibraryItem)
async def update_item(item_id: str, payload: LibraryItemUpdate, user: dict = Depends(require_user)) -> LibraryItem:
    item = await db.library_items.find_one({"id": item_id, "owner_id": user["id"], "is_deleted": False})
    if not item:
        raise HTTPException(status_code=404, detail="Library item not found")
    values = {key: value for key, value in payload.model_dump().items() if value is not None}
    if "folder_id" in values and values["folder_id"] and not await db.library_folders.find_one({"id": values["folder_id"], "owner_id": user["id"]}):
        raise HTTPException(status_code=404, detail="Folder not found")
    values["updated_at"] = now_iso()
    await db.library_items.update_one({"id": item_id}, {"$set": values})
    item.update(values)
    return item_model(item)


@router.delete("/items/{item_id}", status_code=204)
async def delete_item(item_id: str, user: dict = Depends(require_user)) -> None:
    item = await db.library_items.find_one({"id": item_id, "owner_id": user["id"], "is_deleted": False})
    if not item:
        raise HTTPException(status_code=404, detail="Library item not found")
    if item.get("storage_path"):
        await delete_object(item["storage_path"])
    await db.library_items.update_one({"id": item_id}, {"$set": {"is_deleted": True, "updated_at": now_iso()}})


@router.get("/items/{item_id}/download")
async def download_item(item_id: str, user: dict = Depends(require_user)) -> Response:
    item = await db.library_items.find_one({"id": item_id, "owner_id": user["id"], "is_deleted": False})
    if not item:
        raise HTTPException(status_code=404, detail="Library item not found")
    if item["kind"] == "note":
        content = (item.get("content") or "").encode()
        return Response(content=content, media_type="text/plain", headers={"Content-Disposition": f'attachment; filename="{Path(item["name"]).stem}.txt"'})
    if not item.get("storage_path"):
        raise HTTPException(status_code=409, detail="Stored file is unavailable")
    content, detected_type = await get_object(item["storage_path"])
    return Response(content=content, media_type=item.get("content_type") or detected_type, headers={"Content-Disposition": f'inline; filename="{item["name"]}"'})
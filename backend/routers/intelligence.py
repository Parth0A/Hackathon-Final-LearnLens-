from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException

from lib.db import db
from models.intelligence import IntelligenceTaskUpdate, LearningIntelligenceOverview, ResourceXRay, RetentionAction
from services.auth import require_user
from services.intelligence import build_overview, xray_library_item


router = APIRouter(prefix="/intelligence")


@router.post("/resource-xray/{item_id}", response_model=ResourceXRay)
async def resource_xray(item_id: str, user: dict = Depends(require_user)) -> ResourceXRay:
    return await xray_library_item(item_id, user)


@router.get("/resource-xray/{item_id}", response_model=ResourceXRay)
async def resource_xray_result(item_id: str, user: dict = Depends(require_user)) -> ResourceXRay:
    record = await db.resource_xrays.find_one({"item_id": item_id, "owner_id": user["id"]})
    if not record:
        raise HTTPException(status_code=404, detail="Run Resource X-Ray for this resource first")
    return ResourceXRay(**record)


@router.get("/overview/{student_id}", response_model=LearningIntelligenceOverview)
async def learning_intelligence_overview(student_id: str, user: dict = Depends(require_user)) -> LearningIntelligenceOverview:
    if user.get("role") != "student" or user.get("student_id") != student_id:
        raise HTTPException(status_code=403, detail="You can access only your own learning intelligence")
    return LearningIntelligenceOverview(**await build_overview(student_id, user["id"]))


@router.post("/tasks/complete", response_model=dict[str, str])
async def complete_intelligence_task(request: IntelligenceTaskUpdate, user: dict = Depends(require_user)) -> dict[str, str]:
    if user.get("role") != "student" or not user.get("student_id"):
        raise HTTPException(status_code=403, detail="Student access required")
    student_id = user["student_id"]
    await db.intelligence_tasks.update_one(
        {"student_id": student_id, "concept_id": request.concept_id},
        {"$set": {"status": request.status, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    await db.activity_events.insert_one({
        "student_id": student_id,
        "type": "study_task_completed",
        "label": f"Completed study task: {request.concept_id}",
        "detail": "Learning Intelligence study plan updated.",
        "created_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
    })
    return {"status": request.status, "concept_id": request.concept_id}


@router.post("/retention/action", response_model=dict[str, str])
async def retention_action(request: RetentionAction, user: dict = Depends(require_user)) -> dict[str, str]:
    if user.get("role") != "student" or not user.get("student_id"):
        raise HTTPException(status_code=403, detail="Student access required")
    student_id = user["student_id"]
    if request.action != "schedule":
        raise HTTPException(status_code=422, detail="Unsupported retention action")
    scheduled_for = datetime.now(timezone.utc).isoformat()
    await db.retention_actions.update_one(
        {"student_id": student_id, "concept_id": request.concept_id, "status": "scheduled"},
        {"$set": {"updated_at": scheduled_for}},
        upsert=True,
    )
    return {"status": "scheduled", "concept_id": request.concept_id, "scheduled_for": scheduled_for}

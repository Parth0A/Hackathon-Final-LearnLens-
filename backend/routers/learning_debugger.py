from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from lib.db import db

router = APIRouter(prefix="/learning-debugger", tags=["learning-debugger"])

SUBJECTS = [
    "Data Structures",
    "Database Management Systems",
    "Operating Systems",
    "Computer Networks",
    "Object-Oriented Programming",
    "Mathematics",
    "Physics",
    "Chemistry",
]


class ProgressPayload(BaseModel):
    subject: str = Field(min_length=1)
    current_stage: int = Field(default=1, ge=1, le=5)
    completed_stages: list[int] = Field(default_factory=list)


class DebuggerProgress(BaseModel):
    student_id: str
    subject: str
    current_stage: int
    completed_stages: list[int]
    updated_at: str


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.get("/progress/{student_id}", response_model=DebuggerProgress)
async def get_progress(student_id: str, subject: str = "Data Structures"):
    if subject not in SUBJECTS:
        raise HTTPException(status_code=400, detail="Unsupported subject")

    record = await db.learning_debugger_progress.find_one(
        {"student_id": student_id, "subject": subject},
        {"_id": 0},
    )
    if record:
        return DebuggerProgress(**record)

    now = _now()
    initial = DebuggerProgress(
        student_id=student_id,
        subject=subject,
        current_stage=1,
        completed_stages=[],
        updated_at=now,
    )
    await db.learning_debugger_progress.update_one(
        {"student_id": student_id, "subject": subject},
        {"$setOnInsert": initial.model_dump()},
        upsert=True,
    )
    return initial


@router.put("/progress/{student_id}", response_model=DebuggerProgress)
async def save_progress(student_id: str, payload: ProgressPayload):
    if payload.subject not in SUBJECTS:
        raise HTTPException(status_code=400, detail="Unsupported subject")

    completed = sorted(set(stage for stage in payload.completed_stages if 1 <= stage <= 5))
    current_stage = min(5, max(1, payload.current_stage))

    # A stage can only be the active stage after every previous stage is complete.
    expected_stage = next((stage for stage in range(1, 6) if stage not in completed), 5)
    current_stage = min(current_stage, expected_stage)
    if current_stage > 1 and current_stage - 1 not in completed:
        current_stage = expected_stage

    now = _now()
    document = {
        "student_id": student_id,
        "subject": payload.subject,
        "current_stage": current_stage,
        "completed_stages": completed,
        "updated_at": now,
    }
    await db.learning_debugger_progress.update_one(
        {"student_id": student_id, "subject": payload.subject},
        {"$set": document},
        upsert=True,
    )
    return DebuggerProgress(**document)

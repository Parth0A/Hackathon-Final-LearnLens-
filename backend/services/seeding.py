from datetime import datetime, timezone
import os
from typing import Any

from lib.db import db
from services.curriculum import CONCEPTS, CONCEPT_BY_ID, PREREQUISITES, QUESTIONS
from services.auth import hash_password


DEMO_STUDENT = {"id": "demo-student", "name": "Demo Student", "education_level": "Undergraduate"}
COHORT = [
    {"id": "student-02", "name": "Maya Patel", "education_level": "Undergraduate"},
    {"id": "student-03", "name": "Jon Bell", "education_level": "Undergraduate"},
    {"id": "student-04", "name": "Priya Shah", "education_level": "Undergraduate"},
    {"id": "student-05", "name": "Leo Martin", "education_level": "Undergraduate"},
]

DEMO_TEACHER_ID = "demo-teacher"
DEMO_CLASSROOM_ID = "demo-classroom"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def seed_reference_data() -> None:
    if await db.concepts.count_documents({}) == 0:
        await db.concepts.insert_many(CONCEPTS)
    if await db.questions.count_documents({}) == 0:
        await db.questions.insert_many(QUESTIONS)
    if await db.prerequisites.count_documents({}) == 0:
        await db.prerequisites.insert_many([
            {"id": f"edge-{parent}-{child}", "prerequisite_concept_id": parent, "dependent_concept_id": child}
            for parent, child in PREREQUISITES
        ])
    if await db.students.count_documents({}) == 0:
        await db.students.insert_many([DEMO_STUDENT, *COHORT])


async def seed_access_data() -> None:
    student_email = os.environ["DEMO_STUDENT_EMAIL"].lower()
    teacher_email = os.environ["DEMO_TEACHER_EMAIL"].lower()
    if not await db.users.find_one({"id": DEMO_STUDENT["id"]}):
        await db.users.insert_one({
            "id": DEMO_STUDENT["id"], "email": student_email, "name": DEMO_STUDENT["name"],
            "role": "student", "student_id": DEMO_STUDENT["id"], "class_name": "Undergraduate · Data Structures",
            "about": "Learning Data Structures one recovered concept at a time.", "avatar_url": None,
            "password_hash": hash_password(os.environ["DEMO_STUDENT_PASSWORD"]), "active": True, "created_at": now_iso(),
        })
    if not await db.users.find_one({"id": DEMO_TEACHER_ID}):
        await db.users.insert_one({
            "id": DEMO_TEACHER_ID, "email": teacher_email, "name": "Demo Teacher",
            "role": "teacher", "student_id": None, "class_name": "Data Structures Faculty",
            "about": "Guiding the demo classroom with evidence-based recovery.", "avatar_url": None,
            "password_hash": hash_password(os.environ["DEMO_TEACHER_PASSWORD"]), "active": True, "created_at": now_iso(),
        })
    for index, student in enumerate(COHORT, start=2):
        await db.users.update_one({"id": f"cohort-user-{index}"}, {"$setOnInsert": {
            "id": f"cohort-user-{index}", "email": f"student{index}@learnlens.demo", "name": student["name"],
            "role": "student", "student_id": student["id"], "class_name": "Undergraduate · Data Structures",
            "about": "", "avatar_url": None, "password_hash": hash_password(f"CohortStudent{index}!"),
            "active": False, "created_at": now_iso(),
        }}, upsert=True)
    if not await db.classrooms.find_one({"id": DEMO_CLASSROOM_ID}):
        await db.classrooms.insert_one({
            "id": DEMO_CLASSROOM_ID, "owner_id": DEMO_TEACHER_ID, "name": "Data Structures Recovery Lab",
            "subject": "Data Structures", "class_division": "CS-A", "academic_year": "2026",
            "code": "DS26A7", "join_link": "/join/DS26A7", "created_at": now_iso(),
        })
    for student in [DEMO_STUDENT, *COHORT]:
        await db.classroom_memberships.update_one(
            {"classroom_id": DEMO_CLASSROOM_ID, "student_id": student["id"]},
            {"$setOnInsert": {"id": f"membership-{student['id']}", "classroom_id": DEMO_CLASSROOM_ID, "student_id": student["id"], "user_id": student["id"], "joined_at": now_iso()}},
            upsert=True,
        )


async def seed_initial_states(student_id: str, reset: bool = False) -> None:
    if reset:
        for collection in ("question_attempts", "learning_states", "learning_gaps", "interventions", "practice_attempts", "retests", "learning_path", "activity_events"):
            await db[collection].delete_many({"student_id": student_id})
    if await db.learning_states.count_documents({"student_id": student_id}) > 0 and not reset:
        return
    initial_mastery = {"lifo": 0.42, "stack": 0.45}
    for concept in CONCEPTS:
        concept_id = concept["id"]
        mastery = initial_mastery.get(concept_id, 0.0)
        status = "in_recovery" if concept_id == "lifo" else ("current" if concept_id == "stack" else "not_started")
        await db.learning_states.insert_one({
            "student_id": student_id, "concept_id": concept_id, "mastery": mastery,
            "attempts": 0, "correct_attempts": 0, "incorrect_attempts": 0,
            "root_gap": "lifo" if concept_id == "stack" else None,
            "confidence": 0.87 if concept_id == "stack" else None,
            "recovery_status": status, "updated_at": now_iso(),
        })
    await db.activity_events.insert_one({
        "student_id": student_id, "type": "demo_ready", "label": "Demo state ready",
        "detail": "A resettable LIFO/FIFO scenario is ready to explore.", "created_at": now_iso(),
    })


async def ensure_seeded() -> None:
    await seed_reference_data()
    await seed_access_data()
    await seed_initial_states(DEMO_STUDENT["id"])
    for student in COHORT:
        if await db.learning_states.count_documents({"student_id": student["id"]}) == 0:
            await db.learning_states.insert_many([
                {"student_id": student["id"], "concept_id": "lifo", "mastery": 0.35 + (index * 0.08), "attempts": 6, "correct_attempts": 2 + index, "incorrect_attempts": 4 - index, "root_gap": "lifo", "confidence": 0.82, "recovery_status": "in_recovery", "updated_at": now_iso()}
                for index in range(1)
            ])
            await db.activity_events.insert_one({"student_id": student["id"], "type": "gap_detected", "label": "LIFO gap detected", "detail": "FIFO/LIFO confusion needs attention.", "created_at": now_iso()})


async def reset_demo() -> None:
    await seed_reference_data()
    await seed_initial_states(DEMO_STUDENT["id"], reset=True)
"""Shared Mongo handle — import `client`/`db` from here (server.py, routers, seed.py)."""

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING, IndexModel

load_dotenv(Path(__file__).parent.parent / ".env")

mongo_url = os.environ["MONGO_URL"]
# Fail fast instead of hanging boot/requests for the driver default (30s) when MongoDB is unreachable.
client = AsyncIOMotorClient(
    mongo_url,
    serverSelectionTimeoutMS=int(os.environ.get("MONGO_SERVER_SELECTION_TIMEOUT_MS", "5000")),
    connectTimeoutMS=int(os.environ.get("MONGO_CONNECT_TIMEOUT_MS", "10000")),
    socketTimeoutMS=int(os.environ.get("MONGO_SOCKET_TIMEOUT_MS", "20000")),
)
db = client[os.environ["DB_NAME"]]

logger = logging.getLogger(__name__)

# One entry per collection: every field a route filters, sorts, or dedupes on. Applied by ensure_indexes() at startup.
INDEXES: dict[str, list[IndexModel]] = {
    "status_checks": [IndexModel([("timestamp", DESCENDING)], name="timestamp_desc")],
    "students": [IndexModel([("id", ASCENDING)], name="student_id", unique=True)],
    "concepts": [IndexModel([("id", ASCENDING)], name="concept_id", unique=True)],
    "questions": [IndexModel([("id", ASCENDING)], name="question_id", unique=True), IndexModel([("concept_id", ASCENDING)], name="question_concept")],
    "prerequisites": [IndexModel([("prerequisite_concept_id", ASCENDING), ("dependent_concept_id", ASCENDING)], name="prerequisite_edge", unique=True)],
    "question_attempts": [IndexModel([("student_id", ASCENDING), ("timestamp", DESCENDING)], name="attempt_student_time")],
    "learning_states": [IndexModel([("student_id", ASCENDING), ("concept_id", ASCENDING)], name="state_student_concept", unique=True)],
    "learning_gaps": [IndexModel([("student_id", ASCENDING), ("status", ASCENDING)], name="gap_student_status")],
    "interventions": [IndexModel([("student_id", ASCENDING), ("created_at", DESCENDING)], name="intervention_student_time")],
    "practice_attempts": [IndexModel([("student_id", ASCENDING), ("intervention_id", ASCENDING)], name="practice_intervention")],
    "retests": [IndexModel([("student_id", ASCENDING), ("created_at", DESCENDING)], name="retest_student_time")],
    "learning_path": [IndexModel([("student_id", ASCENDING), ("order", ASCENDING)], name="path_student_order")],
    "activity_events": [IndexModel([("student_id", ASCENDING), ("created_at", DESCENDING)], name="activity_student_time")],
    "learning_history": [IndexModel([("student_id", ASCENDING), ("created_at", DESCENDING)], name="history_student_time")],
    "users": [IndexModel([("email", ASCENDING)], name="user_email", unique=True), IndexModel([("id", ASCENDING)], name="user_id", unique=True)],
    "sessions": [IndexModel([("token_hash", ASCENDING)], name="session_token", unique=True), IndexModel([("user_id", ASCENDING)], name="session_user")],
    "library_folders": [IndexModel([("owner_id", ASCENDING), ("created_at", DESCENDING)], name="folder_owner_time")],
    "library_items": [IndexModel([("owner_id", ASCENDING), ("is_deleted", ASCENDING), ("updated_at", DESCENDING)], name="library_owner_active_time")],
    "resource_xrays": [IndexModel([("owner_id", ASCENDING), ("item_id", ASCENDING)], name="resource_xray_owner_item", unique=True)],
    "intelligence_tasks": [IndexModel([("student_id", ASCENDING), ("concept_id", ASCENDING)], name="intelligence_task_student_concept", unique=True)],
    "retention_actions": [IndexModel([("student_id", ASCENDING), ("concept_id", ASCENDING), ("status", ASCENDING)], name="retention_action_student_concept")],
    "classrooms": [IndexModel([("id", ASCENDING)], name="classroom_id", unique=True), IndexModel([("code", ASCENDING)], name="classroom_code", unique=True), IndexModel([("owner_id", ASCENDING)], name="classroom_owner")],
    "classroom_memberships": [IndexModel([("classroom_id", ASCENDING), ("student_id", ASCENDING)], name="classroom_student", unique=True)],
    "classroom_assessments": [IndexModel([("classroom_id", ASCENDING), ("created_at", DESCENDING)], name="assessment_classroom_time")],
    "classroom_question_attempts": [IndexModel([("classroom_id", ASCENDING), ("student_id", ASCENDING), ("timestamp", DESCENDING)], name="class_attempt_student_time")],
    "classroom_assessment_results": [IndexModel([("assessment_id", ASCENDING), ("student_id", ASCENDING)], name="assessment_student_result", unique=True)],
}


async def ensure_indexes() -> None:
    for collection, models in INDEXES.items():
        for model in models:  # one at a time so a bad spec skips only itself
            try:
                await db[collection].create_indexes([model])
            except Exception as exc:  # never block boot on an index; the log line names what to fix
                logger.error("ensure_indexes(%s.%s): %s", collection, model.document["name"], exc)

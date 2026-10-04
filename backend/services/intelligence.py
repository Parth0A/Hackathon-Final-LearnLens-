from __future__ import annotations

import re
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Any

from fastapi import HTTPException

from lib.db import db
from models.intelligence import ResourceXRay
from services.curriculum import CONCEPTS, CONCEPT_BY_ID, PREREQUISITES
from services.storage import get_object


CONCEPT_ALIASES: dict[str, tuple[str, ...]] = {
    "arrays": ("array", "arrays", "index", "contiguous"),
    "linked_list": ("linked list", "linked-list", "linkedlist"),
    "node": ("node", "nodes", "pointer", "reference"),
    "traversal": ("traversal", "traverse", "visit each", "iterate"),
    "insertion": ("insertion", "insert", "adding a node"),
    "lifo": ("lifo", "last in first out", "last-in first-out", "last item"),
    "stack": ("stack", "undo", "browser back"),
    "push": ("push", "push operation"),
    "pop": ("pop", "pop operation", "underflow"),
    "fifo": ("fifo", "first in first out", "first-in first-out", "first item"),
    "queue": ("queue", "printer queue", "waiting line"),
    "enqueue": ("enqueue", "enqueue operation"),
    "dequeue": ("dequeue", "dequeue operation"),
}


def _normalise(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower()).strip()


def _extract_pdf(data: bytes) -> tuple[str, int, str | None]:
    try:
        from pypdf import PdfReader

        reader = PdfReader(BytesIO(data))
        pages = []
        for page in reader.pages:
            pages.append(page.extract_text() or "")
        text = "\n".join(pages).strip()
        warning = None if text else "The PDF contains no extractable text; image-only pages are not analyzed."
        return text, len(reader.pages), warning
    except Exception as exc:
        return "", 0, f"PDF text extraction failed: {exc.__class__.__name__}"


async def _resource_text(item: dict[str, Any]) -> tuple[str, int, str | None]:
    if item.get("kind") == "note":
        return item.get("content") or "", 0, None

    if not item.get("storage_path"):
        return "", 0, "Stored file is unavailable."

    content, _ = await get_object(item["storage_path"])
    extension = Path(item.get("name") or "").suffix.lower()
    if extension == ".pdf" or "pdf" in (item.get("content_type") or "").lower():
        text, pages, warning = _extract_pdf(content)
        return text, pages, warning

    if extension in {".txt", ".md", ".csv"} or (item.get("content_type") or "").startswith("text/"):
        try:
            return content.decode("utf-8", errors="replace"), 0, None
        except Exception:
            return "", 0, "Text file could not be decoded."

    return "", 0, "This resource type is stored, but text extraction is not implemented yet."


def _contains(text: str, aliases: tuple[str, ...]) -> bool:
    return any(alias in text for alias in aliases)


def _difficulty(text: str) -> dict[str, int]:
    counts = {"easy": 0, "moderate": 0, "difficult": 0}
    patterns = {
        "easy": ("define", "what is", "identify", "basic", "simple", "meaning"),
        "moderate": ("explain", "compare", "differentiate", "implement", "trace", "operation"),
        "difficult": ("analyze", "design", "optimize", "prove", "complexity", "derive"),
    }
    for level, words in patterns.items():
        counts[level] = sum(len(re.findall(r"\b" + re.escape(word) + r"\b", text)) for word in words)
    if sum(counts.values()) == 0:
        counts["moderate"] = 1
    return counts


def _question_patterns(text: str) -> dict[str, int]:
    patterns = {
        "definition": r"\b(what is|define|meaning of)\b",
        "comparison": r"\b(compare|differentiate|difference between|distinguish)\b",
        "application": r"\b(example|use case|used for|scenario|application)\b",
        "procedure": r"\b(how to|steps|operation|algorithm|insert|remove|push|pop|enqueue|dequeue)\b",
        "analysis": r"\b(analyze|complexity|trace|why|derive|optimize)\b",
    }
    return {name: len(re.findall(pattern, text)) for name, pattern in patterns.items()}


def analyze_resource(item: dict[str, Any], text: str, warning: str | None) -> ResourceXRay:
    normalized = _normalise(text)
    matched: list[dict[str, Any]] = []
    for concept in CONCEPTS:
        aliases = CONCEPT_ALIASES.get(concept["id"], (concept["name"].lower(),))
        occurrences = sum(normalized.count(alias) for alias in aliases)
        if occurrences:
            matched.append({
                "concept_id": concept["id"],
                "name": concept["name"],
                "mentions": occurrences,
                "difficulty": concept["difficulty"],
            })

    matched.sort(key=lambda value: (-value["mentions"], value["name"]))
    covered = {item["concept_id"] for item in matched}
    prerequisites = []
    relationships = []
    for parent, child in PREREQUISITES:
        if parent in covered or child in covered:
            parent_name = CONCEPT_BY_ID[parent]["name"]
            child_name = CONCEPT_BY_ID[child]["name"]
            relationships.append({"from": parent_name, "to": child_name, "type": "prerequisite"})
        if child in covered and parent not in covered:
            prerequisites.append(parent_name if (parent_name := CONCEPT_BY_ID[parent]["name"]) else parent)

    topics = [item["name"] for item in matched[:8]]
    important = [item["name"] for item in matched if item["mentions"] >= max(2, matched[0]["mentions"] // 2)] if matched else []
    if not important:
        important = topics[:5]

    return ResourceXRay(
        item_id=item["id"],
        resource_name=item["name"],
        resource_type=item.get("content_type") or item.get("kind", "resource"),
        extracted_text_chars=len(text),
        extraction_warning=warning,
        topics=topics,
        concepts=matched,
        prerequisites=list(dict.fromkeys(prerequisites)),
        difficulty_distribution=_difficulty(normalized),
        question_patterns=_question_patterns(normalized),
        important_areas=important,
        relationships=relationships,
    )


def _retention_status(mastery: float, updated_at: str | None) -> tuple[str, str]:
    if not updated_at:
        return "REVISION NEEDED", "Start a short retrieval check."
    try:
        updated = datetime.fromisoformat(updated_at.replace("Z", "+00:00"))
        age_days = max(0.0, (datetime.now(timezone.utc) - updated).total_seconds() / 86400)
    except (TypeError, ValueError):
        age_days = 999.0

    if mastery < 0.4:
        return "REVISION NEEDED", "Relearn the concept before retrieval practice."
    if mastery < 0.65:
        return "AT RISK", "Do a short retrieval check and one targeted practice question."
    if age_days >= 14:
        return "STARTING TO DECAY", "Run a retrieval check this week."
    if age_days >= 7:
        return "STARTING TO DECAY", "Schedule a quick retrieval check."
    return "STABLE", "Continue with the current learning path."


async def build_overview(student_id: str, owner_id: str | None = None) -> dict[str, Any]:
    states = await db.learning_states.find({"student_id": student_id}).to_list(100)
    gaps = await db.learning_gaps.find({"student_id": student_id, "status": "active"}, {"_id": 0}).sort("created_at", -1).to_list(100)
    state_map = {item["concept_id"]: item for item in states}
    gap_map = {item["concept_id"]: item for item in gaps}

    fingerprint = []
    retention = []
    for concept in CONCEPTS:
        state = state_map.get(concept["id"], {})
        mastery = float(state.get("mastery", 0.0))
        gap = gap_map.get(concept["id"])
        fingerprint.append({
            "concept_id": concept["id"],
            "topic": concept["name"],
            "mastery": round(mastery, 4),
            "status": state.get("recovery_status", "not_started"),
            "root_gap": state.get("root_gap"),
            "confidence": state.get("confidence"),
            "attempts": state.get("attempts", 0),
            "updated_at": state.get("updated_at"),
        })
        status, action = _retention_status(mastery, state.get("updated_at"))
        scheduled = await db.retention_actions.find_one({"student_id": student_id, "concept_id": concept["id"], "status": "scheduled"}, sort=[("scheduled_for", -1)])
        retention.append({
            "concept_id": concept["id"],
            "topic": concept["name"],
            "mastery": round(mastery, 4),
            "last_updated": state.get("updated_at") or "",
            "status": status,
            "next_action": action,
            "next_revision_at": scheduled.get("scheduled_for") if scheduled else None,
        })

    ranked = sorted(
        fingerprint,
        key=lambda item: (
            0 if item["concept_id"] in gap_map else 1,
            item["mastery"],
            0 if item["attempts"] else 1,
        ),
    )
    task_records = {item["concept_id"]: item for item in await db.intelligence_tasks.find({"student_id": student_id}).to_list(100)}
    study_plan = []
    for index, item in enumerate(ranked[:6]):
        if item["mastery"] >= 0.8 and item["concept_id"] not in gap_map:
            continue
        gap = gap_map.get(item["concept_id"])
        if gap:
            reason = "Active root gap detected from your assessment evidence."
            priority = "HIGH"
            minutes = 35
            activity = "Targeted intervention"
        elif item["mastery"] < 0.5:
            reason = "Low current mastery; build the foundation before advancing."
            priority = "HIGH"
            minutes = 35
            activity = "Learn + retrieval practice"
        elif item["mastery"] < 0.7:
            reason = "Partial mastery; reinforce with targeted practice."
            priority = "MEDIUM"
            minutes = 25
            activity = "Practice + explain"
        else:
            reason = "Mostly learned; use a short retrieval check to retain it."
            priority = "NORMAL"
            minutes = 15
            activity = "Retrieval check"
        study_plan.append({
            "concept_id": item["concept_id"],
            "topic": item["topic"],
            "priority": priority,
            "reason": reason,
            "estimated_minutes": minutes,
            "activity": activity,
            "status": task_records.get(item["concept_id"], {}).get("status", "planned"),
        })

    recent_xrays = []
    if owner_id:
        recent_xrays = await db.resource_xrays.find({"owner_id": owner_id}, {"_id": 0}).sort("updated_at", -1).to_list(100)

    completed_tasks = await db.intelligence_tasks.count_documents({"student_id": student_id, "status": "completed"})
    scheduled_revisions = await db.retention_actions.count_documents({"student_id": student_id, "status": "scheduled"})
    metrics = {
        "overall_mastery": round(sum(item["mastery"] for item in fingerprint) / len(fingerprint), 4) if fingerprint else 0.0,
        "active_gaps": len(gaps),
        "planned_tasks": len(study_plan),
        "completed_tasks": completed_tasks,
        "scheduled_revisions": scheduled_revisions,
        "resources_analyzed": len(recent_xrays),
    }

    return {
        "student_id": student_id,
        "fingerprint": fingerprint,
        "gaps": gaps,
        "study_plan": study_plan,
        "retention": retention,
        "metrics": metrics,
        "resource_xrays": recent_xrays[:10],
    }


async def xray_library_item(item_id: str, user: dict[str, Any]) -> ResourceXRay:
    item = await db.library_items.find_one({"id": item_id, "owner_id": user["id"], "is_deleted": False})
    if not item:
        raise HTTPException(status_code=404, detail="Library item not found")

    try:
        text, _pages, warning = await _resource_text(item)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Unable to read the selected resource: {exc.__class__.__name__}") from exc

    result = analyze_resource(item, text, warning)
    payload = result.model_dump()
    payload["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.resource_xrays.update_one(
        {"item_id": item_id, "owner_id": user["id"]},
        {"$set": payload, "$setOnInsert": {"created_at": payload["updated_at"]}},
        upsert=True,
    )
    return result

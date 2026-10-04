from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException

from ai.mock_provider import MockAIProvider
from knowledge.mock_retriever import MockKnowledgeRetriever
from lib.db import db
from models.learning import (
    AssessmentResult, AssessmentSession, Concept, ConceptState, CompleteInterventionRequest,
    DashboardResponse, Evidence, Intervention, LearningGap, LearningPathResponse,
    PathItem, PracticeResult, PracticeSubmission, Question, RadarResponse, ResetResponse,
    RetestResult, RetestSession, StartAssessmentRequest, StartInterventionRequest,
    StartRetestRequest, SubmitAssessmentRequest, SubmitRetestRequest, Student, PublicQuestion,
    TeacherOverviewResponse, TeacherStudentActivity,
)
from services.curriculum import ASSESSMENT_QUESTION_IDS, CONCEPT_BY_ID, PRACTICE_QUESTION_IDS, QUESTION_BY_ID, RETEST_QUESTION_IDS
from services.debugger import diagnose_root_gap
from services.intervention import select_intervention_type
from services.mastery import calculate_mastery
from services.recovery import recovery_status
from services.seeding import DEMO_STUDENT, ensure_seeded, now_iso, reset_demo
from services.auth import require_own_student, require_role, require_user


router = APIRouter()
mock_ai = MockAIProvider()
mock_retriever = MockKnowledgeRetriever()


def question_model(document: dict[str, Any]) -> Question:
    return Question(**{key: document[key] for key in ("id", "text", "options", "correct_answer", "concept_id", "prerequisite_concept_id", "difficulty", "misconception_tag", "source")})


async def get_questions(ids: list[str]) -> list[PublicQuestion]:
    documents = await db.questions.find({"id": {"$in": ids}}).to_list(100)
    ordered = {item["id"]: item for item in documents}
    return [PublicQuestion(**{key: ordered[item][key] for key in ("id", "text", "options", "concept_id", "prerequisite_concept_id", "difficulty", "misconception_tag", "source")}) for item in ids if item in ordered]


async def get_states(student_id: str) -> list[ConceptState]:
    records = await db.learning_states.find({"student_id": student_id}).to_list(100)
    return [ConceptState(**record) for record in records]


async def get_gap(student_id: str) -> LearningGap | None:
    record = await db.learning_gaps.find_one({"student_id": student_id, "status": "active"}, sort=[("created_at", -1)])
    if record:
        return LearningGap(**record)

    # Keep recovery available when the assessment has already written the diagnosed
    # root gap into learning state but the gap record is temporarily out of sync.
    state = await db.learning_states.find_one({"student_id": student_id, "concept_id": "stack"})
    if state and state.get("root_gap"):
        root_gap = str(state["root_gap"])
        root_state = await db.learning_states.find_one({"student_id": student_id, "concept_id": root_gap})
        return LearningGap(
            id=f"state-{student_id}-{root_gap}",
            student_id=student_id,
            concept_id="stack",
            root_gap=root_gap,
            confidence=float(state.get("confidence", 0.0)),
            evidence=state.get("evidence", []),
            mastery=float((root_state or {}).get("mastery", state.get("mastery", 0.0))),
            status="active",
            created_at=str(state.get("updated_at") or now_iso()),
        )
    return None


async def ensure_student(student_id: str) -> dict[str, Any]:
    student = await db.students.find_one({"id": student_id})
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")
    return student


def state_document(student_id: str, concept_id: str, values: dict[str, Any], previous: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "student_id": student_id, "concept_id": concept_id,
        "mastery": float(values.get("mastery", previous.get("mastery", 0.0) if previous else 0.0)),
        "attempts": int(values.get("attempts", previous.get("attempts", 0) if previous else 0)),
        "correct_attempts": int(values.get("correct_attempts", previous.get("correct_attempts", 0) if previous else 0)),
        "incorrect_attempts": int(values.get("incorrect_attempts", previous.get("incorrect_attempts", 0) if previous else 0)),
        "root_gap": values.get("root_gap", previous.get("root_gap") if previous else None),
        "confidence": values.get("confidence", previous.get("confidence") if previous else None),
        "recovery_status": values.get("recovery_status", previous.get("recovery_status", "not_started") if previous else "not_started"),
        "updated_at": now_iso(),
    }


async def record_learning_history(student_id: str, label: str, mastery: float) -> None:
    await db.learning_history.insert_one({
        "id": str(uuid4()), "student_id": student_id, "label": label,
        "mastery": round(float(mastery), 4), "created_at": now_iso(),
    })


def elapsed_seconds(started_at: str | None) -> int:
    if not started_at:
        return 0
    try:
        started = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
        return max(0, int((datetime.now(timezone.utc) - started).total_seconds()))
    except (TypeError, ValueError):
        return 0


async def path_for(student_id: str) -> LearningPathResponse:
    concepts = await db.concepts.find().to_list(100)
    states = {item["concept_id"]: item for item in await db.learning_states.find({"student_id": student_id}).to_list(100)}
    edges = await db.prerequisites.find().to_list(100)
    prerequisites: dict[str, list[str]] = {}
    for edge in edges:
        prerequisites.setdefault(edge["dependent_concept_id"], []).append(edge["prerequisite_concept_id"])
    preferred_order = ["arrays", "linked_list", "node", "traversal", "insertion", "lifo", "stack", "push", "pop", "fifo", "queue", "enqueue", "dequeue"]
    concept_map = {item["id"]: item for item in concepts}
    items: list[PathItem] = []
    for order, concept_id in enumerate(preferred_order, start=1):
        state = states.get(concept_id, {})
        mastery = float(state.get("mastery", 0.0))
        prereqs = prerequisites.get(concept_id, [])
        prereqs_recovered = all(float(states.get(parent, {}).get("mastery", 0.0)) >= 0.8 for parent in prereqs)
        if mastery >= 0.8:
            status = "recovered"
        elif state.get("recovery_status") == "in_recovery":
            status = "in_recovery"
        elif not prereqs_recovered:
            status = "locked"
        elif mastery > 0:
            status = "current"
        else:
            status = "available"
        items.append(PathItem(concept_id=concept_id, name=concept_map.get(concept_id, {"name": concept_id})["name"], status=status, mastery=mastery, order=order, prerequisite_ids=prereqs))
    current = next((item.concept_id for item in items if item.status in {"in_recovery", "current"}), "arrays")
    return LearningPathResponse(student_id=student_id, items=items, current_concept=current)


@router.get("/health")
async def health() -> dict[str, str]:
    """Liveness/readiness probe used by deployment and CI to gate on the backend."""
    try:
        from lib.db import client
        await client.admin.command("ping")
        mongo = "up"
    except Exception:
        mongo = "down"
    return {"status": "ok" if mongo == "up" else "degraded", "service": "learning-recovery", "mongo": mongo}


@router.get("/concepts", response_model=list[Concept])
async def concepts() -> list[Concept]:
    await ensure_seeded()
    return [Concept(**item) for item in await db.concepts.find().to_list(100)]


@router.get("/questions", response_model=list[PublicQuestion])
async def questions(user: dict = Depends(require_user)) -> list[PublicQuestion]:
    if user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Student access required")
    await ensure_seeded()
    documents = await db.questions.find().to_list(100)
    return [PublicQuestion(**{key: item[key] for key in ("id", "text", "options", "concept_id", "prerequisite_concept_id", "difficulty", "misconception_tag", "source")}) for item in documents]


@router.post("/assessment/start", response_model=AssessmentSession)
async def start_assessment(request: StartAssessmentRequest, user: dict = Depends(require_user)) -> AssessmentSession:
    require_own_student(user, request.student_id)
    await ensure_seeded()
    await ensure_student(request.student_id)
    return AssessmentSession(student_id=request.student_id, question_count=len(ASSESSMENT_QUESTION_IDS), questions=await get_questions(ASSESSMENT_QUESTION_IDS), focus="Data Structures · LIFO/FIFO diagnostic")


@router.post("/assessment/submit", response_model=AssessmentResult)
async def submit_assessment(request: SubmitAssessmentRequest, user: dict = Depends(require_user)) -> AssessmentResult:
    require_own_student(user, request.student_id)
    await ensure_seeded()
    await ensure_student(request.student_id)
    question_ids = [answer.question_id for answer in request.answers]
    if any(question_id not in ASSESSMENT_QUESTION_IDS for question_id in question_ids):
        raise HTTPException(status_code=422, detail="One or more questions are not part of this assessment")
    if len(set(question_ids)) != len(question_ids):
        raise HTTPException(status_code=422, detail="Each assessment question can be answered only once")
    question_docs = await db.questions.find({"id": {"$in": question_ids}}).to_list(100)
    question_map = {item["id"]: item for item in question_docs}
    if not request.answers:
        raise HTTPException(status_code=422, detail="Choose at least one answer before submitting")
    timestamp = now_iso()
    for answer in request.answers:
        question = question_map.get(answer.question_id)
        if not question or answer.selected_answer not in question["options"]:
            raise HTTPException(status_code=422, detail=f"Invalid answer for {answer.question_id}")
        await db.question_attempts.insert_one({
            "id": str(uuid4()), "student_id": request.student_id, "question_id": question["id"],
            "concept_id": question["concept_id"], "selected_answer": answer.selected_answer,
            "correct": answer.selected_answer == question["correct_answer"], "misconception_tag": question["misconception_tag"], "timestamp": timestamp,
        })
    attempts = await db.question_attempts.find({"student_id": request.student_id}).to_list(1000)
    mastery = calculate_mastery(attempts)
    for concept_id, values in mastery.items():
        previous = await db.learning_states.find_one({"student_id": request.student_id, "concept_id": concept_id})
        await db.learning_states.update_one({"student_id": request.student_id, "concept_id": concept_id}, {"$set": state_document(request.student_id, concept_id, values, previous)}, upsert=True)
    states = {item["concept_id"]: item for item in await db.learning_states.find({"student_id": request.student_id}).to_list(100)}
    diagnosis = diagnose_root_gap(attempts, states)
    gap_model = None
    if diagnosis:
        gap_id = str(uuid4())
        gap_doc = {"id": gap_id, "student_id": request.student_id, "concept_id": diagnosis["concept_id"], "root_gap": diagnosis["root_gap"], "confidence": diagnosis["confidence"], "evidence": diagnosis["evidence"], "mastery": diagnosis["mastery"], "status": "active", "created_at": timestamp}
        await db.learning_gaps.update_many({"student_id": request.student_id, "status": "active"}, {"$set": {"status": "superseded"}})
        await db.learning_gaps.insert_one(gap_doc)
        await db.learning_states.update_one({"student_id": request.student_id, "concept_id": "stack"}, {"$set": {"root_gap": "lifo", "confidence": diagnosis["confidence"], "recovery_status": "in_recovery", "updated_at": now_iso()}})
        await db.learning_states.update_one({"student_id": request.student_id, "concept_id": "lifo"}, {"$set": {"recovery_status": "in_recovery", "updated_at": now_iso()}})
        await db.activity_events.insert_one({"student_id": request.student_id, "type": "gap_detected", "label": "Detected LIFO learning gap", "detail": "Repeated FIFO/LIFO confusion is blocking Stack.", "created_at": timestamp})
        gap_model = LearningGap(**gap_doc)
    correct = sum(1 for item in request.answers if question_map[item.question_id]["correct_answer"] == item.selected_answer)
    await db.activity_events.insert_one({"student_id": request.student_id, "type": "assessment_completed", "label": "Completed Data Structures assessment", "detail": f"{correct} of {len(request.answers)} correct", "created_at": timestamp})
    result_states = await get_states(request.student_id)
    overall_after = round(sum(float(item.mastery) for item in result_states) / len(result_states), 4) if result_states else 0.0
    await record_learning_history(request.student_id, "Assessment", overall_after)
    duration = elapsed_seconds(request.started_at)
    if duration:
        await db.activity_events.insert_one({"student_id": request.student_id, "type": "learning_time", "label": "Assessment study time", "detail": "Time spent completing the assessment.", "duration_seconds": duration, "created_at": timestamp})
    return AssessmentResult(score=round(correct / len(request.answers), 2), correct=correct, total=len(request.answers), attempts_saved=len(request.answers), detected_gap=gap_model, states=result_states)


@router.get("/learning-state/{student_id}", response_model=list[ConceptState])
async def learning_state(student_id: str, user: dict = Depends(require_user)) -> list[ConceptState]:
    require_own_student(user, student_id)
    await ensure_seeded()
    await ensure_student(student_id)
    return await get_states(student_id)


@router.get("/gaps/{student_id}", response_model=list[LearningGap])
async def gaps(student_id: str, user: dict = Depends(require_user)) -> list[LearningGap]:
    require_own_student(user, student_id)
    await ensure_seeded()
    await ensure_student(student_id)
    return [LearningGap(**item) for item in await db.learning_gaps.find({"student_id": student_id, "status": "active"}).sort("created_at", -1).to_list(100)]


@router.get("/gaps/{student_id}/{concept_id}", response_model=LearningGap)
async def gap_detail(student_id: str, concept_id: str, user: dict = Depends(require_user)) -> LearningGap:
    require_own_student(user, student_id)
    await ensure_seeded()
    await ensure_student(student_id)
    record = await db.learning_gaps.find_one({"student_id": student_id, "concept_id": concept_id, "status": "active"}, sort=[("created_at", -1)])
    if not record:
        raise HTTPException(status_code=404, detail="No active learning gap for this concept")
    return LearningGap(**record)


@router.post("/interventions/start", response_model=Intervention)
async def start_intervention(request: StartInterventionRequest, user: dict = Depends(require_user)) -> Intervention:
    require_own_student(user, request.student_id)
    await ensure_seeded()
    await ensure_student(request.student_id)
    gap = await get_gap(request.student_id)
    if not gap:
        raise HTTPException(status_code=409, detail="Complete an assessment to identify a recovery gap first")
    if request.concept_id != gap.root_gap:
        raise HTTPException(status_code=409, detail="Intervention must target the active root learning gap")
    previous = await db.interventions.find({"student_id": request.student_id, "root_gap": gap.root_gap}).sort("created_at", 1).to_list(20)
    intervention_type = select_intervention_type(previous)
    _ = mock_retriever.retrieve(request.concept_id, gap.root_gap)
    content = mock_ai.generate_intervention(gap.root_gap, intervention_type, [item.model_dump() for item in gap.evidence])
    state = await db.learning_states.find_one({"student_id": request.student_id, "concept_id": gap.root_gap})
    doc = {"id": str(uuid4()), "student_id": request.student_id, "concept_id": request.concept_id, "root_gap": gap.root_gap, "type": intervention_type, "title": content["title"], "content": content, "created_at": now_iso(), "completed": False, "result": None, "mastery_before": float(state.get("mastery", gap.mastery) if state else gap.mastery)}
    doc["started_at"] = doc["created_at"]
    await db.interventions.insert_one(doc)
    return Intervention(**doc)


@router.post("/interventions/{intervention_id}/complete", response_model=Intervention)
async def complete_intervention(intervention_id: str, request: CompleteInterventionRequest, user: dict = Depends(require_user)) -> Intervention:
    record = await db.interventions.find_one({"id": intervention_id})
    if not record:
        raise HTTPException(status_code=404, detail="Intervention not found")
    require_own_student(user, record["student_id"])
    completed_at = now_iso()
    duration_seconds = elapsed_seconds(record.get("started_at") or record.get("created_at")) if request.completed else 0
    await db.interventions.update_one(
        {"id": intervention_id},
        {"$set": {"completed": request.completed, "result": request.result, "completed_at": completed_at, "duration_seconds": duration_seconds}},
    )
    record.update({"completed": request.completed, "result": request.result, "completed_at": completed_at, "duration_seconds": duration_seconds})
    await db.activity_events.insert_one({"student_id": record["student_id"], "type": "intervention_completed", "label": f"Started {record['type'].replace('_', ' ')}", "detail": "Targeted recovery practice is ready.", "created_at": now_iso()})
    return Intervention(**record)


@router.post("/practice/submit", response_model=PracticeResult)
async def submit_practice(request: PracticeSubmission, user: dict = Depends(require_user)) -> PracticeResult:
    require_own_student(user, request.student_id)
    intervention = await db.interventions.find_one({"id": request.intervention_id, "student_id": request.student_id})
    if not intervention:
        raise HTTPException(status_code=404, detail="Intervention not found")
    if not intervention.get("completed"):
        raise HTTPException(status_code=409, detail="Complete the intervention before targeted practice")
    question = QUESTION_BY_ID.get(request.question_id)
    if not question or request.question_id not in PRACTICE_QUESTION_IDS:
        raise HTTPException(status_code=422, detail="That question is not part of this targeted practice")
    if request.selected_answer not in question["options"]:
        raise HTTPException(status_code=422, detail="Choose one of the provided options")
    existing = await db.practice_attempts.find_one({"student_id": request.student_id, "intervention_id": request.intervention_id, "question_id": request.question_id})
    if not existing:
        await db.practice_attempts.insert_one({"id": str(uuid4()), "student_id": request.student_id, "intervention_id": request.intervention_id, "question_id": request.question_id, "selected_answer": request.selected_answer, "correct": request.selected_answer == question["correct_answer"], "created_at": now_iso()})
    completed = await db.practice_attempts.count_documents({"student_id": request.student_id, "intervention_id": request.intervention_id})
    return PracticeResult(correct=request.selected_answer == question["correct_answer"], correct_answer=question["correct_answer"], practice_completed=completed, practice_target=3, retest_unlocked=completed >= 3, question_id=request.question_id)


@router.post("/retest/start", response_model=RetestSession)
async def start_retest(request: StartRetestRequest, user: dict = Depends(require_user)) -> RetestSession:
    require_own_student(user, request.student_id)
    await ensure_seeded()
    await ensure_student(request.student_id)
    if request.concept_id != "lifo":
        raise HTTPException(status_code=422, detail="Retest is currently supported for the active LIFO recovery path")
    intervention = await db.interventions.find_one(
        {"student_id": request.student_id, "root_gap": request.concept_id, "completed": True},
        sort=[("created_at", -1)],
    )
    if not intervention:
        raise HTTPException(status_code=409, detail="Start the targeted intervention before the retest")
    practice_count = await db.practice_attempts.count_documents(
        {"student_id": request.student_id, "intervention_id": intervention["id"]}
    )
    if practice_count < 3:
        raise HTTPException(status_code=409, detail="Complete all 3 targeted practice questions before the retest")
    state = await db.learning_states.find_one({"student_id": request.student_id, "concept_id": request.concept_id})
    retest_id = str(uuid4())
    await db.retests.insert_one({"id": retest_id, "student_id": request.student_id, "concept_id": request.concept_id, "intervention_id": intervention["id"], "created_at": now_iso(), "status": "started", "mastery_before": float(state.get("mastery", 0.0) if state else 0.0)})
    return RetestSession(id=retest_id, student_id=request.student_id, concept_id=request.concept_id, questions=await get_questions(RETEST_QUESTION_IDS), mastery_before=float(state.get("mastery", 0.0) if state else 0.0), practice_completed=practice_count)


@router.post("/retest/submit", response_model=RetestResult)
async def submit_retest(request: SubmitRetestRequest, user: dict = Depends(require_user)) -> RetestResult:
    require_own_student(user, request.student_id)
    retest = await db.retests.find_one({"id": request.retest_id, "student_id": request.student_id})
    if not retest:
        raise HTTPException(status_code=404, detail="Retest not found")
    if retest.get("status") != "started":
        raise HTTPException(status_code=409, detail="This retest has already been completed")
    if any(item.question_id not in RETEST_QUESTION_IDS for item in request.answers):
        raise HTTPException(status_code=422, detail="One or more questions are not part of this retest")
    if len(set(item.question_id for item in request.answers)) != len(request.answers):
        raise HTTPException(status_code=422, detail="Each retest question can be answered only once")
    question_docs = await db.questions.find({"id": {"$in": [item.question_id for item in request.answers]}}).to_list(100)
    question_map = {item["id"]: item for item in question_docs}
    if not request.answers:
        raise HTTPException(status_code=422, detail="Choose answers before submitting the retest")
    for answer in request.answers:
        question = question_map.get(answer.question_id)
        if not question or answer.selected_answer not in question["options"]:
            raise HTTPException(status_code=422, detail=f"Invalid answer for {answer.question_id}")
    correct = sum(1 for item in request.answers if item.selected_answer == question_map[item.question_id]["correct_answer"])
    score = round(correct / len(request.answers), 2)
    mastery_before = float(retest.get("mastery_before", 0.0))
    mastery_after = max(mastery_before, score)
    status = recovery_status(mastery_after)
    await db.retests.update_one({"id": request.retest_id}, {"$set": {"score": score, "mastery_after": mastery_after, "status": status, "completed_at": now_iso()}})
    await db.learning_states.update_one({"student_id": request.student_id, "concept_id": "lifo"}, {"$set": {"mastery": mastery_after, "attempts": len(request.answers), "correct_attempts": correct, "incorrect_attempts": len(request.answers) - correct, "recovery_status": status.lower(), "updated_at": now_iso()}})
    intervention = await db.interventions.find_one(
        {"id": retest.get("intervention_id"), "student_id": request.student_id},
    )
    if intervention:
        await db.interventions.update_one({"id": intervention["id"]}, {"$set": {"result": status, "mastery_after": mastery_after}})
    unlocked = None
    if status == "RECOVERED":
        unlocked = "stack"
        await db.learning_states.update_one({"student_id": request.student_id, "concept_id": "stack"}, {"$set": {"mastery": max(0.45, float((await db.learning_states.find_one({"student_id": request.student_id, "concept_id": "stack"}) or {}).get("mastery", 0.45))), "recovery_status": "available", "root_gap": None, "updated_at": now_iso()}})
        await db.learning_gaps.update_many({"student_id": request.student_id, "root_gap": "lifo", "status": "active"}, {"$set": {"status": "recovered"}})
    await db.activity_events.insert_one({"student_id": request.student_id, "type": "retest_completed", "label": f"Retest {status.lower().replace('_', ' ')}", "detail": f"{round(score * 100)}% after recovery practice.", "created_at": now_iso()})
    await record_learning_history(request.student_id, "Retest", mastery_after)
    return RetestResult(id=request.retest_id, score=score, correct=correct, total=len(request.answers), mastery_before=mastery_before, mastery_after=mastery_after, status=status, improvement=round(mastery_after - mastery_before, 2), unlocked_concept=unlocked)


@router.get("/learning-path/{student_id}", response_model=LearningPathResponse)
async def learning_path(student_id: str, user: dict = Depends(require_user)) -> LearningPathResponse:
    require_own_student(user, student_id)
    await ensure_seeded()
    await ensure_student(student_id)
    return await path_for(student_id)


@router.get("/dashboard/{student_id}", response_model=DashboardResponse)
async def dashboard(student_id: str, user: dict = Depends(require_user)) -> DashboardResponse:
    require_own_student(user, student_id)
    await ensure_seeded()
    student = await ensure_student(student_id)
    states = await db.learning_states.find({"student_id": student_id}).to_list(100)
    gaps = await db.learning_gaps.find({"student_id": student_id, "status": "active"}).to_list(100)
    events = await db.activity_events.find({"student_id": student_id}).sort("created_at", -1).limit(8).to_list(8)
    interventions = await db.interventions.find({"student_id": student_id}).sort("created_at", -1).to_list(20)
    recovered_count = sum(1 for item in states if float(item.get("mastery", 0)) >= 0.8)
    overall = round(sum(float(item.get("mastery", 0)) for item in states) / len(states), 2) if states else 0.0
    current = (await path_for(student_id)).current_concept
    assessment_count = await db.activity_events.count_documents({"student_id": student_id, "type": "assessment_completed"})
    learning_events = await db.activity_events.find({"student_id": student_id, "type": "learning_time"}).to_list(1000)
    learning_time = sum(int(item.get("duration_seconds", 0)) for item in learning_events)
    history = await db.learning_history.find({"student_id": student_id}).sort("created_at", 1).to_list(100)
    recovery_time = sum(int(item.get("duration_seconds", 0)) for item in interventions if item.get("completed"))
    return DashboardResponse(
        student=Student(**student), overall_mastery=overall, recovered_count=recovered_count,
        active_gaps=len(gaps), current_concept=current, current_gap=gaps[0]["root_gap"] if gaps else None,
        assessment_count=assessment_count, learning_time_seconds=learning_time, recovery_time_seconds=recovery_time,
        recent_activity=[{"label": item.get("label"), "detail": item.get("detail"), "created_at": item.get("created_at"), "type": item.get("type")} for item in events],
        mastery_history=[{"label": item.get("label", "Learning activity"), "mastery": round(float(item.get("mastery", 0)) * 100)} for item in history],
        concept_mastery=[{"concept_id": item["concept_id"], "name": CONCEPT_BY_ID.get(item["concept_id"], {"name": item["concept_id"]})["name"], "mastery": round(float(item.get("mastery", 0)) * 100), "status": item.get("recovery_status", "not_started")} for item in states],
        intervention_effectiveness=[{"type": item.get("type"), "before": round(float(item.get("mastery_before", 0)) * 100), "after": round(float(item.get("mastery_after", item.get("mastery_before", 0))) * 100), "result": item.get("result") or "IN PROGRESS"} for item in interventions],
    )

@router.get("/teacher/radar", response_model=RadarResponse)
async def teacher_radar(teacher: dict = Depends(require_role("teacher"))) -> RadarResponse:
    await ensure_seeded()
    classrooms = await db.classrooms.find({"owner_id": teacher["id"]}).to_list(100)
    classroom_ids = [item["id"] for item in classrooms]
    memberships = await db.classroom_memberships.find({"classroom_id": {"$in": classroom_ids}}).to_list(1000)
    student_ids = list({item["student_id"] for item in memberships})
    students = await db.students.find({"id": {"$in": student_ids}}).to_list(1000)
    states = await db.learning_states.find({"student_id": {"$in": student_ids}}).to_list(1000)
    gaps = await db.learning_gaps.find({"student_id": {"$in": student_ids}, "status": {"$in": ["active", "recovered"]}}).to_list(1000)
    interventions = await db.interventions.find({"student_id": {"$in": student_ids}}).to_list(1000)
    average = round(sum(float(item.get("mastery", 0)) for item in states) / len(states), 2) if states else 0.0
    gap_history = await db.learning_gaps.find({"student_id": {"$in": student_ids}}).to_list(5000)
    historical_by_root: dict[str, set[str]] = {}
    active_by_root: dict[str, set[str]] = {}
    for gap in gap_history:
        root = gap["root_gap"]
        historical_by_root.setdefault(root, set()).add(gap["student_id"])
        if gap["status"] == "active":
            active_by_root.setdefault(root, set()).add(gap["student_id"])
    gap_counts = {root: len(students_set) for root, students_set in active_by_root.items()}
    recovery_comparison = []
    for gap_id in sorted(historical_by_root):
        before_count = len(historical_by_root[gap_id])
        after_count = len(active_by_root.get(gap_id, set()))
        recovery_comparison.append({
            "concept_id": gap_id,
            "name": CONCEPT_BY_ID.get(gap_id, {"name": gap_id})["name"],
            "before": before_count,
            "after": after_count,
            "recovered": max(0, before_count - after_count),
        })
    misconception_attempts = await db.question_attempts.find({
        "student_id": {"$in": student_ids},
        "misconception_tag": "FIFO_LIFO_CONFUSION",
    }).to_list(5000)
    return RadarResponse(
        class_mastery=average,
        students_needing_attention=[{"student_id": student["id"], "name": student["name"], "gap": next((gap["root_gap"] for gap in gaps if gap["student_id"] == student["id"] and gap["status"] == "active"), None), "priority": "high"} for student in students if any(gap["student_id"] == student["id"] and gap["status"] == "active" for gap in gaps)],
        common_gaps=[{"concept_id": gap_id, "name": CONCEPT_BY_ID.get(gap_id, {"name": gap_id})["name"], "students": count, "label": f"{CONCEPT_BY_ID.get(gap_id, {'name': gap_id})['name']} prerequisite gap"} for gap_id, count in sorted(gap_counts.items(), key=lambda entry: -entry[1])],
        misconceptions=[{"tag": "FIFO_LIFO_CONFUSION", "label": "LIFO/FIFO confusion", "occurrences": len([item for item in misconception_attempts if not item.get("correct")])}],
        intervention_results=[{"type": item.get("type", "unknown"), "result": item.get("result") or "IN PROGRESS", "student_id": item.get("student_id"), "improvement": round((float(item.get("mastery_after", item.get("mastery_before", 0))) - float(item.get("mastery_before", 0))) * 100)} for item in interventions],
        recovery_comparison=recovery_comparison,
    )


ACTIVE_WINDOW_MINUTES = 30


@router.get("/teacher/overview", response_model=TeacherOverviewResponse)
async def teacher_overview(teacher: dict = Depends(require_role("teacher"))) -> TeacherOverviewResponse:
    await ensure_seeded()
    classrooms = await db.classrooms.find({"owner_id": teacher["id"]}).to_list(100)
    classroom_ids = [item["id"] for item in classrooms]
    memberships = await db.classroom_memberships.find({"classroom_id": {"$in": classroom_ids}}).to_list(1000) if classroom_ids else []
    student_ids = sorted({item["student_id"] for item in memberships})
    assessments_count = await db.classroom_assessments.count_documents({"classroom_id": {"$in": classroom_ids}}) if classroom_ids else 0
    if not student_ids:
        return TeacherOverviewResponse(students_enrolled=0, active_now=0, active_window_minutes=ACTIVE_WINDOW_MINUTES, assessments=assessments_count, needs_attention=0, class_mastery=None, students=[])
    students = {item["id"]: item for item in await db.students.find({"id": {"$in": student_ids}}).to_list(1000)}
    states = await db.learning_states.find({"student_id": {"$in": student_ids}}).to_list(1000)
    gaps = await db.learning_gaps.find({"student_id": {"$in": student_ids}, "status": "active"}).to_list(1000)
    needs_attention_ids = {item["student_id"] for item in gaps}
    class_mastery = round(sum(float(item.get("mastery", 0.0)) for item in states) / len(states), 2) if states else None
    now = datetime.now(timezone.utc)
    cutoff = (now - timedelta(minutes=ACTIVE_WINDOW_MINUTES)).isoformat()
    user_docs = await db.users.find({"student_id": {"$in": student_ids}}).to_list(1000)
    user_to_student = {item["id"]: item.get("student_id") for item in user_docs}
    recent_sessions = await db.sessions.find({"user_id": {"$in": list(user_to_student)}, "created_at": {"$gte": cutoff}, "expires_at": {"$gt": now.isoformat()}}).to_list(1000)
    active_ids = {user_to_student[item["user_id"]] for item in recent_sessions if user_to_student.get(item["user_id"])}
    events = await db.activity_events.find({"student_id": {"$in": student_ids}}).sort("created_at", -1).to_list(5000)
    latest_by_student: dict[str, dict[str, Any]] = {}
    for item in events:
        latest_by_student.setdefault(item["student_id"], item)
        if item.get("created_at", "") >= cutoff:
            active_ids.add(item["student_id"])
    states_by_student: dict[str, list[dict[str, Any]]] = {}
    for item in states:
        states_by_student.setdefault(item["student_id"], []).append(item)
    roster: list[TeacherStudentActivity] = []
    for student_id in student_ids:
        latest = latest_by_student.get(student_id)
        student_states = states_by_student.get(student_id, [])
        if student_id in needs_attention_ids:
            status = "needs_attention"
        elif any(item.get("recovery_status") == "in_recovery" for item in student_states):
            status = "in_recovery"
        elif student_states:
            status = "on_track"
        else:
            status = "not_started"
        roster.append(TeacherStudentActivity(
            student_id=student_id,
            name=students.get(student_id, {}).get("name", student_id),
            active=student_id in active_ids,
            last_activity_label=latest.get("label") if latest else None,
            last_activity_at=latest.get("created_at") if latest else None,
            learning_status=status,
        ))
    return TeacherOverviewResponse(
        students_enrolled=len(student_ids),
        active_now=len(active_ids),
        active_window_minutes=ACTIVE_WINDOW_MINUTES,
        assessments=assessments_count,
        needs_attention=len(needs_attention_ids),
        class_mastery=class_mastery,
        students=roster,
    )


@router.post("/demo/reset", response_model=ResetResponse)
async def demo_reset(user: dict = Depends(require_user)) -> ResetResponse:
    require_own_student(user, DEMO_STUDENT["id"])
    await reset_demo()
    return ResetResponse(message="Demo Student reset to the initial recovery scenario", student=Student(**DEMO_STUDENT), initial_mastery={"lifo": 0.42, "stack": 0.45})
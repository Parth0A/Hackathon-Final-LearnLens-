import secrets
import string
from io import BytesIO
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pypdf import PdfReader

from lib.db import db
from models.access import (Classroom, ClassroomAssessment, ClassroomAssessmentCreate, ClassroomAssessmentResult,
    ClassroomAssessmentSubmission, ClassroomCreateRequest, ClassroomJoinRequest, RosterStudent,
    PaperGenerateRequest, PaperGenerateResponse, PaperQuestionAnalysis, PaperXRay)
from models.learning import Question, PublicQuestion
from services.curriculum import CONCEPT_BY_ID
from services.auth import require_role, require_user
from services.mastery import calculate_mastery
from services.debugger import diagnose_root_gap
from services.seeding import now_iso


router = APIRouter(prefix="/classrooms")


def make_code() -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(7))


async def classroom_model(item: dict[str, Any]) -> Classroom:
    count = await db.classroom_memberships.count_documents({"classroom_id": item["id"]})
    return Classroom(**item, student_count=count)


async def require_class_access(classroom_id: str, user: dict[str, Any]) -> dict[str, Any]:
    classroom = await db.classrooms.find_one({"id": classroom_id})
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")
    if user["role"] == "teacher" and classroom["owner_id"] == user["id"]:
        return classroom
    if user["role"] == "student" and await db.classroom_memberships.find_one({"classroom_id": classroom_id, "student_id": user.get("student_id")}):
        return classroom
    raise HTTPException(status_code=403, detail="You do not have access to this classroom")


@router.get("", response_model=list[Classroom])
async def list_classrooms(user: dict = Depends(require_user)) -> list[Classroom]:
    if user["role"] == "teacher":
        records = await db.classrooms.find({"owner_id": user["id"]}).sort("created_at", -1).to_list(100)
    else:
        memberships = await db.classroom_memberships.find({"student_id": user.get("student_id")}).to_list(100)
        records = await db.classrooms.find({"id": {"$in": [item["classroom_id"] for item in memberships]}}).sort("created_at", -1).to_list(100)
    return [await classroom_model(item) for item in records]


@router.post("", response_model=Classroom)
async def create_classroom(payload: ClassroomCreateRequest, teacher: dict = Depends(require_role("teacher"))) -> Classroom:
    code = make_code()
    while await db.classrooms.find_one({"code": code}):
        code = make_code()
    item = {"id": str(uuid4()), "owner_id": teacher["id"], "name": payload.name, "subject": payload.subject, "class_division": payload.class_division, "academic_year": payload.academic_year, "code": code, "join_link": f"/join/{code}", "created_at": now_iso()}
    await db.classrooms.insert_one(item)
    return await classroom_model(item)


@router.post("/join", response_model=Classroom)
async def join_classroom(payload: ClassroomJoinRequest, student: dict = Depends(require_role("student"))) -> Classroom:
    classroom = await db.classrooms.find_one({"code": payload.code.upper()})
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom code not found")
    membership = {"id": str(uuid4()), "classroom_id": classroom["id"], "student_id": student["student_id"], "user_id": student["id"], "joined_at": now_iso()}
    await db.classroom_memberships.update_one({"classroom_id": classroom["id"], "student_id": student["student_id"]}, {"$setOnInsert": membership}, upsert=True)
    return await classroom_model(classroom)



def _paper_question_metadata(question: dict[str, Any]) -> dict[str, Any]:
    text = question.get("text", "")
    difficulty = question.get("difficulty", "moderate").lower()
    if any(word in text.lower() for word in ("implement", "write", "calculate", "trace", "design")):
        question_type, cognitive = "Problem solving", "Problem solving"
    elif any(word in text.lower() for word in ("which", "what is", "define", "identify")):
        question_type, cognitive = "Conceptual", ("Recall" if difficulty == "easy" else "Understanding")
    else:
        question_type, cognitive = "Application", "Application"
    marks = 2 if difficulty == "easy" else 4 if difficulty == "moderate" else 6
    concept = CONCEPT_BY_ID.get(question["concept_id"], {"name": question["concept_id"]})["name"]
    prerequisite = question.get("prerequisite_concept_id")
    return {"question_id": question["id"], "text": text, "concept_id": question["concept_id"], "concept": concept, "difficulty": difficulty, "question_type": question_type, "cognitive_level": cognitive, "marks": marks, "prerequisite": CONCEPT_BY_ID.get(prerequisite, {}).get("name") if prerequisite else None}


def _build_xray(question_docs: list[dict[str, Any]]) -> PaperXRay:
    details = [_paper_question_metadata(question) for question in question_docs]
    difficulty = {"easy": 0, "moderate": 0, "difficult": 0}
    types: dict[str, int] = {}
    cognitive: dict[str, int] = {}
    concept_counts: dict[str, int] = {}
    for item in details:
        difficulty[item["difficulty"]] = difficulty.get(item["difficulty"], 0) + 1
        types[item["question_type"]] = types.get(item["question_type"], 0) + 1
        cognitive[item["cognitive_level"]] = cognitive.get(item["cognitive_level"], 0) + 1
        concept_counts[item["concept_id"]] = concept_counts.get(item["concept_id"], 0) + 1
    ordered = sorted(difficulty.items(), key=lambda pair: pair[1], reverse=True)
    overall = ordered[0][0] if ordered and ordered[0][1] else "not assessed"
    if len(concept_counts) <= 1 and len(details) > 1:
        balance = "Heavily focused on one concept"
    elif ordered and ordered[0][1] / max(1, len(details)) >= 0.75:
        balance = "Concentrated around one difficulty level"
    else:
        balance = "Broad concept and difficulty coverage"
    concepts = [{"concept_id": cid, "name": CONCEPT_BY_ID.get(cid, {"name": cid})["name"], "questions": count, "percentage": round(count / len(details) * 100) if details else 0} for cid, count in sorted(concept_counts.items(), key=lambda pair: -pair[1])]
    return PaperXRay(question_count=len(details), concepts=concepts, difficulty_distribution=difficulty, overall_difficulty=overall, question_types=types, cognitive_distribution=cognitive, balance=balance, questions=[PaperQuestionAnalysis(**item) for item in details])


@router.post("/{classroom_id}/papers/generate", response_model=PaperGenerateResponse)
async def generate_paper(classroom_id: str, payload: PaperGenerateRequest, teacher: dict = Depends(require_role("teacher"))) -> PaperGenerateResponse:
    classroom = await db.classrooms.find_one({"id": classroom_id, "owner_id": teacher["id"]})
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")
    query: dict[str, Any] = {}
    if payload.topic_ids:
        query["concept_id"] = {"$in": payload.topic_ids}
    if payload.difficulty != "any":
        query["difficulty"] = payload.difficulty
    candidates = await db.questions.find(query).to_list(1000)
    if len(candidates) < payload.question_count:
        raise HTTPException(status_code=422, detail="Not enough approved questions match those paper settings")
    candidates.sort(key=lambda item: (item.get("concept_id", ""), item.get("difficulty", ""), item.get("id", "")))
    selected: list[dict[str, Any]] = []
    seen_concepts: set[str] = set()
    remaining = candidates.copy()
    while remaining and len(selected) < payload.question_count:
        preferred = next((item for item in remaining if item.get("concept_id") not in seen_concepts), remaining[0])
        selected.append(preferred)
        seen_concepts.add(preferred.get("concept_id", ""))
        remaining.remove(preferred)
    question_ids = [item["id"] for item in selected]
    return PaperGenerateResponse(title=payload.title, question_ids=question_ids, questions=[Question(**item) for item in selected], xray=_build_xray(selected))


def _build_uploaded_xray(text: str, page_count: int) -> PaperXRay:
    import re
    lines = [re.sub(r"\s+", " ", line).strip() for line in text.splitlines() if line.strip()]
    question_lines = [line for line in lines if re.match(r"^(?:Q(?:uestion)?\s*)?\d{1,2}[.)\-:]\s+", line, re.I) or "?" in line][:30]
    details = []
    concept_words = {"lifo":"lifo", "stack":"stack", "fifo":"fifo", "queue":"queue", "linked list":"linked_list", "array":"arrays", "traversal":"traversal", "insertion":"insertion"}
    for index, line in enumerate(question_lines, 1):
        lower = line.lower()
        concept_id = next((cid for word, cid in concept_words.items() if word in lower), "arrays")
        if any(w in lower for w in ("implement", "write", "calculate", "trace", "design", "program", "algorithm")):
            difficulty, cognitive, qtype, marks = "difficult", "Problem solving", "Problem solving", 6
        elif any(w in lower for w in ("define", "what is", "identify", "list", "state", "name")):
            difficulty, cognitive, qtype, marks = "easy", "Recall", "Conceptual", 2
        else:
            difficulty, cognitive, qtype, marks = "moderate", "Understanding", "Conceptual", 4
        match = re.search(r"\b([1-9][0-9]?)\s*(?:marks?|m)\b", lower)
        if match: marks = int(match.group(1))
        details.append({"question_id": f"pdf-q{index}", "text": line, "concept_id": concept_id, "concept": CONCEPT_BY_ID.get(concept_id, {"name": concept_id})["name"], "difficulty": difficulty, "question_type": qtype, "cognitive_level": cognitive, "marks": marks, "prerequisite": None, "page": None, "section": None, "keywords": [concept_id], "quality_flags": []})
    if not details:
        details.append({"question_id":"pdf-q1","text":"No numbered question text could be extracted from this PDF.","concept_id":"arrays","concept":"Arrays","difficulty":"not assessed","question_type":"Unknown","cognitive_level":"Unknown","marks":0,"prerequisite":None,"page":None,"section":None,"keywords":[],"quality_flags":["Review this PDF manually; no question structure was detected."]})
    difficulty = {k: sum(1 for x in details if x["difficulty"] == k) for k in ("easy","moderate","difficult")}
    types = {x["question_type"]: sum(1 for y in details if y["question_type"] == x["question_type"]) for x in details}
    cognitive = {x["cognitive_level"]: sum(1 for y in details if y["cognitive_level"] == x["cognitive_level"]) for x in details}
    concepts = {x["concept_id"]: sum(1 for y in details if y["concept_id"] == x["concept_id"]) for x in details}
    total_marks = sum(x["marks"] for x in details)
    dominant = max(difficulty, key=difficulty.get) if any(difficulty.values()) else "not assessed"
    balance = "Heavily focused on one concept" if len(concepts) == 1 and len(details) > 1 else ("Concentrated around one difficulty level" if difficulty.get(dominant, 0) / max(1,len(details)) >= .75 else "Broad concept and difficulty coverage")
    checks = []
    if len(concepts) == 1 and len(details) > 1: checks.append("Review concept coverage: most questions target one concept.")
    if difficulty.get(dominant, 0) / max(1,len(details)) >= .75: checks.append("Review difficulty balance: most questions share one difficulty level.")
    return PaperXRay(question_count=len(details), page_count=page_count, extracted_text_chars=len(text), extraction_warning="Scanned/image-only PDFs may need manual review." if not question_lines else None, total_marks=total_marks, average_marks=round(total_marks/max(1,len(details)),2), marks_distribution={str(m):sum(1 for x in details if x["marks"]==m) for m in sorted(set(x["marks"] for x in details))}, concepts=[{"concept_id":cid,"name":CONCEPT_BY_ID.get(cid,{"name":cid})["name"],"questions":n,"percentage":round(n/len(details)*100)} for cid,n in concepts.items()], difficulty_distribution=difficulty, overall_difficulty=dominant, question_types=types, cognitive_distribution=cognitive, prerequisite_coverage={}, balance=balance, quality_checks=checks, questions=[PaperQuestionAnalysis(**x) for x in details])


async def _xray_pdf_bytes(raw: bytes) -> PaperXRay:
    if len(raw) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Question paper PDF must be 10 MB or smaller")
    try:
        reader = PdfReader(BytesIO(raw))
        text = "\n".join(page.extract_text() or "" for page in reader.pages[:30])
    except Exception as exc:
        raise HTTPException(status_code=422, detail="Could not read this PDF question paper") from exc
    return _build_uploaded_xray(text, min(len(reader.pages), 30))


@router.post("/{classroom_id}/papers/xray/upload", response_model=PaperXRay)
async def xray_uploaded_paper(classroom_id: str, file: UploadFile = File(...), teacher: dict = Depends(require_role("teacher"))) -> PaperXRay:
    classroom = await db.classrooms.find_one({"id": classroom_id, "owner_id": teacher["id"]})
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=415, detail="X-Ray currently accepts PDF question papers only")
    raw = await file.read()
    return await _xray_pdf_bytes(raw)


@router.post("/{classroom_id}/papers/xray/library/{item_id}", response_model=PaperXRay)
async def xray_library_paper(classroom_id: str, item_id: str, teacher: dict = Depends(require_role("teacher"))) -> PaperXRay:
    from services.storage import get_object
    classroom = await db.classrooms.find_one({"id": classroom_id, "owner_id": teacher["id"]})
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")
    item = await db.library_items.find_one({"id": item_id, "owner_id": teacher["id"], "is_deleted": False, "kind": "file"})
    if not item:
        raise HTTPException(status_code=404, detail="Library file not found")
    if item.get("content_type") != "application/pdf" and not str(item.get("name", "")).lower().endswith(".pdf"):
        raise HTTPException(status_code=415, detail="Question Paper X-Ray currently accepts PDF files only")
    if not item.get("storage_path"):
        raise HTTPException(status_code=409, detail="This Library file has no stored file content")
    raw, _ = await get_object(item["storage_path"])
    return await _xray_pdf_bytes(raw)
@router.post("/{classroom_id}/papers/xray", response_model=PaperXRay)
async def xray_paper(classroom_id: str, question_ids: list[str], teacher: dict = Depends(require_role("teacher"))) -> PaperXRay:
    classroom = await db.classrooms.find_one({"id": classroom_id, "owner_id": teacher["id"]})
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")
    if not question_ids or len(question_ids) > 30 or len(set(question_ids)) != len(question_ids):
        raise HTTPException(status_code=422, detail="Provide 1 to 30 unique question IDs")
    documents = await db.questions.find({"id": {"$in": question_ids}}).to_list(100)
    if len(documents) != len(question_ids):
        raise HTTPException(status_code=422, detail="One or more questions do not exist")
    ordered = {item["id"]: item for item in documents}
    return _build_xray([ordered[item] for item in question_ids])


@router.get("/{classroom_id}/roster", response_model=list[RosterStudent])
async def roster(classroom_id: str, teacher: dict = Depends(require_role("teacher"))) -> list[RosterStudent]:
    classroom = await db.classrooms.find_one({"id": classroom_id, "owner_id": teacher["id"]})
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")
    memberships = await db.classroom_memberships.find({"classroom_id": classroom_id}).to_list(1000)
    student_ids = [item["student_id"] for item in memberships]
    users = {item.get("student_id"): item for item in await db.users.find({"student_id": {"$in": student_ids}}).to_list(1000)}
    return [RosterStudent(student_id=item["student_id"], name=users.get(item["student_id"], {}).get("name", "Demo learner"), email=users.get(item["student_id"], {}).get("email", "demo@learnlens.local"), joined_at=item["joined_at"]) for item in memberships]


@router.get("/{classroom_id}/assessments", response_model=list[ClassroomAssessment])
async def list_assessments(classroom_id: str, user: dict = Depends(require_user)) -> list[ClassroomAssessment]:
    await require_class_access(classroom_id, user)
    query: dict[str, Any] = {"classroom_id": classroom_id}
    if user["role"] == "student":
        query["published"] = True
    records = await db.classroom_assessments.find(query).sort("created_at", -1).to_list(100)
    result: list[ClassroomAssessment] = []
    for item in records:
        question_docs = await db.questions.find({"id": {"$in": item["question_ids"]}}).to_list(100)
        ordered = {question["id"]: question for question in question_docs}
        questions = [PublicQuestion(**{key: ordered[qid][key] for key in ("id", "text", "options", "concept_id", "prerequisite_concept_id", "difficulty", "misconception_tag", "source")}) for qid in item["question_ids"] if qid in ordered]
        count = await db.classroom_assessment_results.count_documents({"assessment_id": item["id"]})
        result.append(ClassroomAssessment(**item, questions=questions, submission_count=count))
    return result


@router.post("/{classroom_id}/assessments", response_model=ClassroomAssessment)
async def create_assessment(classroom_id: str, payload: ClassroomAssessmentCreate, teacher: dict = Depends(require_role("teacher"))) -> ClassroomAssessment:
    classroom = await db.classrooms.find_one({"id": classroom_id, "owner_id": teacher["id"]})
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")
    questions = await db.questions.find({"id": {"$in": payload.question_ids}}).to_list(100)
    if len(questions) != len(set(payload.question_ids)):
        raise HTTPException(status_code=422, detail="One or more questions do not exist")
    item = {"id": str(uuid4()), "classroom_id": classroom_id, "teacher_id": teacher["id"], "title": payload.title, "question_ids": payload.question_ids, "published": payload.published, "created_at": now_iso()}
    await db.classroom_assessments.insert_one(item)
    ordered = {question["id"]: question for question in questions}
    return ClassroomAssessment(**item, questions=[PublicQuestion(**{key: ordered[qid][key] for key in ("id", "text", "options", "concept_id", "prerequisite_concept_id", "difficulty", "misconception_tag", "source")}) for qid in payload.question_ids], submission_count=0)


@router.post("/assessments/{assessment_id}/submit", response_model=ClassroomAssessmentResult)
async def submit_classroom_assessment(assessment_id: str, payload: ClassroomAssessmentSubmission, student: dict = Depends(require_role("student"))) -> ClassroomAssessmentResult:
    assessment = await db.classroom_assessments.find_one({"id": assessment_id, "published": True})
    if not assessment:
        raise HTTPException(status_code=404, detail="Published assessment not found")
    await require_class_access(assessment["classroom_id"], student)
    if await db.classroom_assessment_results.find_one({"assessment_id": assessment_id, "student_id": student["student_id"]}):
        raise HTTPException(status_code=409, detail="This assessment has already been submitted")
    question_docs = await db.questions.find({"id": {"$in": assessment["question_ids"]}}).to_list(100)
    question_map = {item["id"]: item for item in question_docs}
    if len(payload.answers) != len(assessment["question_ids"]):
        raise HTTPException(status_code=422, detail="Answer every question before submitting")
    correct = 0
    submitted_at = now_iso()
    attempt_docs = []
    for answer in payload.answers:
        question = question_map.get(answer.question_id)
        if not question or answer.selected_answer not in question["options"]:
            raise HTTPException(status_code=422, detail=f"Invalid answer for {answer.question_id}")
        is_correct = answer.selected_answer == question["correct_answer"]
        correct += int(is_correct)
        attempt_docs.append({"id": str(uuid4()), "assessment_id": assessment_id, "classroom_id": assessment["classroom_id"], "student_id": student["student_id"], "question_id": question["id"], "concept_id": question["concept_id"], "selected_answer": answer.selected_answer, "correct": is_correct, "misconception_tag": question["misconception_tag"], "timestamp": submitted_at})
    await db.classroom_question_attempts.insert_many(attempt_docs)
    await db.question_attempts.insert_many([{key: value for key, value in item.items() if key != "assessment_id" and key != "classroom_id"} for item in attempt_docs])
    result = {"id": str(uuid4()), "assessment_id": assessment_id, "student_id": student["student_id"], "correct": correct, "total": len(payload.answers), "score": round(correct / len(payload.answers), 2), "attempts_saved": len(attempt_docs), "submitted_at": submitted_at}
    await db.classroom_assessment_results.insert_one(result)
    all_attempts = await db.question_attempts.find({"student_id": student["student_id"]}).to_list(1000)
    mastery = calculate_mastery(all_attempts)
    for concept_id, values in mastery.items():
        await db.learning_states.update_one(
            {"student_id": student["student_id"], "concept_id": concept_id},
            {"$set": {**values, "updated_at": submitted_at}},
            upsert=True,
        )

    # Classroom assessments must feed the same learning debugger as the
    # standalone assessment flow; otherwise classroom results would update
    # mastery but never create a root-gap/intervention path.
    states = {item["concept_id"]: item for item in await db.learning_states.find({"student_id": student["student_id"]}).to_list(100)}
    diagnosis = diagnose_root_gap(all_attempts, states)
    if diagnosis:
        gap_doc = {
            "id": str(uuid4()),
            "student_id": student["student_id"],
            "concept_id": diagnosis["concept_id"],
            "root_gap": diagnosis["root_gap"],
            "confidence": diagnosis["confidence"],
            "evidence": diagnosis["evidence"],
            "mastery": diagnosis["mastery"],
            "status": "active",
            "created_at": submitted_at,
        }
        await db.learning_gaps.update_many(
            {"student_id": student["student_id"], "status": "active"},
            {"$set": {"status": "superseded"}},
        )
        await db.learning_gaps.insert_one(gap_doc)
        await db.learning_states.update_one(
            {"student_id": student["student_id"], "concept_id": diagnosis["concept_id"]},
            {"$set": {"root_gap": diagnosis["root_gap"], "confidence": diagnosis["confidence"], "recovery_status": "in_recovery", "updated_at": submitted_at}},
        )
        await db.learning_states.update_one(
            {"student_id": student["student_id"], "concept_id": diagnosis["root_gap"]},
            {"$set": {"recovery_status": "in_recovery", "updated_at": submitted_at}},
        )
        await db.activity_events.insert_one({
            "student_id": student["student_id"],
            "type": "gap_detected",
            "label": f"Detected {diagnosis['root_gap']} learning gap",
            "detail": "Classroom assessment evidence identified a prerequisite learning gap.",
            "created_at": submitted_at,
        })

    await db.activity_events.insert_one({
        "student_id": student["student_id"],
        "type": "assessment_completed",
        "label": f"Completed classroom assessment: {assessment['title']}",
        "detail": f"{correct} of {len(payload.answers)} correct",
        "created_at": submitted_at,
    })
    overall_after = round(sum(float(item.get("mastery", 0.0)) for item in states.values()) / len(states), 4) if states else 0.0
    await db.learning_history.insert_one({
        "id": str(uuid4()),
        "student_id": student["student_id"],
        "label": "Classroom Assessment",
        "mastery": overall_after,
        "created_at": submitted_at,
    })
    return ClassroomAssessmentResult(**result)
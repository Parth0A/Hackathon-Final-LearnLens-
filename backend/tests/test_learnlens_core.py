"""Core LearnLens regression coverage for auth, persistence boundaries, debugger, and mock intervention seams."""

import pytest

pytestmark = pytest.mark.xdist_group(name="demo_student")

import os
import uuid

from services.curriculum import CONCEPTS, QUESTIONS
QUESTION_BY_ID = {item["id"]: item for item in QUESTIONS}

import pytest


def test_new_student_starts_empty_and_cannot_read_demo(client):
    suffix = uuid.uuid4().hex[:10]
    email = f"learnlens-test-{suffix}@example.com"
    registered = client.post("/auth/register", json={"email": email, "password": "TestPassword123!", "name": "Isolation Test", "role": "student", "class_name": "Engineering"})
    assert registered.status_code == 200, registered.text
    student_id = registered.json()["user"]["student_id"]
    dashboard = client.get(f"/dashboard/{student_id}")
    assert dashboard.status_code == 200, dashboard.text
    body = dashboard.json()
    assert body["overall_mastery"] == 0
    assert body["assessment_count"] == 0
    assert body["learning_time_seconds"] == 0
    assert body["recovery_time_seconds"] == 0
    assert body["mastery_history"] == []
    assert body["recent_activity"] == []
    forbidden = client.get("/dashboard/demo-student")
    assert forbidden.status_code == 403, forbidden.text


def test_assessment_started_at_persists_real_learning_time(client):
    client.post("/demo/reset")
    start = client.post("/assessment/start", json={"student_id": "demo-student"})
    assert start.status_code == 200, start.text
    questions = start.json()["questions"]
    answers = [{"question_id": q["id"], "selected_answer": q["options"][0]} for q in questions]
    started_at = "2026-09-20T00:00:00+00:00"
    submitted = client.post("/assessment/submit", json={"student_id": "demo-student", "answers": answers, "started_at": started_at})
    assert submitted.status_code == 200, submitted.text
    dashboard = client.get("/dashboard/demo-student")
    assert dashboard.status_code == 200, dashboard.text
    body = dashboard.json()
    assert body["assessment_count"] == 1
    assert body["learning_time_seconds"] > 0
    assert len(body["mastery_history"]) == 1


def test_retest_requires_targeted_intervention_practice(client):
    client.post("/demo/reset")
    response = client.post("/retest/start", json={"student_id": "demo-student", "concept_id": "lifo"})
    assert response.status_code == 409, response.text


@pytest.mark.parametrize("path", ["/assessment/start", "/learning-state/demo-student", "/gaps/demo-student", "/dashboard/demo-student"])
@pytest.mark.asyncio
async def test_protected_learning_routes_reject_anonymous(path, aclient):
    response = await (aclient.get(path) if path.startswith(("/learning-state", "/gaps", "/dashboard")) else aclient.post(path, json={"student_id": "demo-student"}))
    assert response.status_code == 401


def test_learning_debugger_recovers_lifo_and_unlocks_stack(client):
    suffix = uuid.uuid4().hex[:10]
    email = f"learnlens-debugger-{suffix}@example.com"
    registered = client.post("/auth/register", json={"email": email, "password": "TestPassword123!", "name": "Debugger Flow Test", "role": "student", "class_name": "Engineering"})
    assert registered.status_code == 200, registered.text
    student_id = registered.json()["user"]["student_id"]
    start = client.post("/assessment/start", json={"student_id": student_id})
    assert start.status_code == 200, start.text
    questions = {item["id"]: item for item in start.json()["questions"]}
    answers = [{"question_id": qid, "selected_answer": next(option for option in questions[qid]["options"] if option != questions[qid]["correct_answer"])} for qid in ("q08", "q09", "q10")]
    submitted = client.post("/assessment/submit", json={"student_id": student_id, "answers": answers})
    assert submitted.status_code == 200, submitted.text
    gap = submitted.json()["detected_gap"]
    assert gap["root_gap"] == "lifo"
    intervention = client.post("/interventions/start", json={"student_id": student_id, "concept_id": "lifo"})
    assert intervention.status_code == 200, intervention.text
    intervention_body = intervention.json()
    assert intervention_body["root_gap"] == "lifo"
    completed = client.post(f"/interventions/{intervention_body['id']}/complete", json={"completed": True, "result": "practice_ready"})
    assert completed.status_code == 200, completed.text
    for qid in ("q09", "q10", "q30"):
        practice = client.post("/practice/submit", json={"student_id": student_id, "intervention_id": intervention_body["id"], "question_id": qid, "selected_answer": questions.get(qid, {}).get("correct_answer") or {"q09": "LIFO", "q10": "C", "q30": "Stack → LIFO"}[qid]})
        assert practice.status_code == 200, practice.text
    assert practice.json()["retest_unlocked"] is True
    retest = client.post("/retest/start", json={"student_id": student_id, "concept_id": "lifo"})
    assert retest.status_code == 200, retest.text
    retest_questions = {item["id"]: item for item in retest.json()["questions"]}
    retest_answers = [{"question_id": qid, "selected_answer": retest_questions[qid]["correct_answer"]} for qid in ("q11", "q29", "q32")]
    result = client.post("/retest/submit", json={"student_id": student_id, "retest_id": retest.json()["id"], "answers": retest_answers})
    assert result.status_code == 200, result.text
    body = result.json()
    assert body["status"] == "RECOVERED"
    assert body["unlocked_concept"] == "stack"
    gaps = client.get(f"/gaps/{student_id}")
    assert gaps.status_code == 200, gaps.text
    assert gaps.json() == []
    path = client.get(f"/learning-path/{student_id}")
    assert path.status_code == 200, path.text
    stack = next(item for item in path.json()["items"] if item["concept_id"] == "stack")
    assert stack["status"] == "current"
    dashboard = client.get(f"/dashboard/{student_id}")
    assert dashboard.status_code == 200, dashboard.text
    assert [item["label"] for item in dashboard.json()["mastery_history"]] == ["Assessment", "Retest"]


def test_mock_ai_and_retriever_are_deterministic_prototype_seams():
    from ai.mock_provider import MockAIProvider
    from knowledge.mock_retriever import MockKnowledgeRetriever
    ai = MockAIProvider()
    retriever = MockKnowledgeRetriever()
    evidence = [{"text": "Repeated FIFO/LIFO confusion", "kind": "misconception"}]
    content = ai.generate_intervention("lifo", "worked_example", evidence)
    sources = retriever.retrieve("stack", "lifo")
    assert content["title"] == "Work through a stack example"
    assert "LIFO" in content["explanation"] or "Last-In, First-Out" in content["explanation"]
    assert sources[0]["status"] == "mock_approved_content"
    assert sources[0]["concept"] == "lifo"


def test_logout_invalidates_session_and_session_endpoint(client):
    me = client.get("/auth/me")
    assert me.status_code == 200, me.text
    logged_out = client.post("/auth/logout")
    assert logged_out.status_code == 204, logged_out.text
    session = client.get("/auth/session")
    assert session.status_code == 200
    assert session.json() is None
    protected = client.get(f"/dashboard/{me.json()['student_id']}")
    assert protected.status_code == 401


def test_student_cannot_access_another_student_profile(client):
    suffix = uuid.uuid4().hex[:10]
    email = f"learnlens-isolation-{suffix}@example.com"
    registered = client.post("/auth/register", json={"email": email, "password": "TestPassword123!", "name": "Second Student", "role": "student", "class_name": "Engineering"})
    assert registered.status_code == 200, registered.text
    second_student_id = registered.json()["user"]["student_id"]
    own = client.get(f"/dashboard/{second_student_id}")
    assert own.status_code == 200, own.text
    other = client.get("/dashboard/demo-student")
    assert other.status_code == 403, other.text


def test_student_a_cannot_access_or_mutate_student_b_learning_data(client):
    suffix = uuid.uuid4().hex[:10]
    email_b = f"learnlens-student-b-{suffix}@example.com"
    registered = client.post("/auth/register", json={"email": email_b, "password": "TestPassword123!", "name": "Student B", "role": "student", "class_name": "Engineering"})
    assert registered.status_code == 200, registered.text
    student_b = registered.json()["user"]["student_id"]
    email_a = os.environ.get("DEMO_STUDENT_EMAIL")
    password_a = os.environ.get("DEMO_STUDENT_PASSWORD")
    assert email_a and password_a
    logged_in_a = client.post("/auth/login", json={"email": email_a, "password": password_a})
    assert logged_in_a.status_code == 200, logged_in_a.text
    student_a = logged_in_a.json()["user"]["student_id"]
    assert student_a != student_b
    for path in (f"/learning-state/{student_b}", f"/gaps/{student_b}", f"/gaps/{student_b}/lifo", f"/learning-path/{student_b}", f"/dashboard/{student_b}"):
        response = client.get(path)
        assert response.status_code == 403, f"{path}: {response.status_code} {response.text}"
    assert client.post("/assessment/start", json={"student_id": student_b}).status_code == 403
    assert client.post("/assessment/submit", json={"student_id": student_b, "answers": []}).status_code == 403
    assert client.post("/interventions/start", json={"student_id": student_b, "concept_id": "lifo"}).status_code == 403
    assert client.post("/practice/submit", json={"student_id": student_b, "intervention_id": "not-student-a", "question_id": "q09", "selected_answer": "LIFO"}).status_code == 403
    assert client.post("/retest/start", json={"student_id": student_b, "concept_id": "lifo"}).status_code == 403
    # The demo-reset endpoint is intentionally restricted to the demo student; Student A is the demo student here.
    reset = client.post("/demo/reset")
    assert reset.status_code == 200, reset.text

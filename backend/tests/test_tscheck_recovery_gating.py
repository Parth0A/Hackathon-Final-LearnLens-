"""Criterion: Recovery Center provides real content and gates targeted practice."""

import pytest

pytestmark = pytest.mark.xdist_group(name="demo_student")

PRACTICE_IDS = ["q09", "q10", "q30"]


def _seed_gap(client) -> None:
    client.post("/demo/reset")
    start = client.post("/assessment/start", json={"student_id": "demo-student"})
    questions = start.json()["questions"]
    answers = [{"question_id": q["id"], "selected_answer": q["options"][0]} for q in questions]
    client.post("/assessment/submit", json={"student_id": "demo-student", "answers": answers})


def test_intervention_content_is_deterministic_and_practice_gates_retest(client) -> None:
    _seed_gap(client)

    started = client.post("/interventions/start", json={"student_id": "demo-student", "concept_id": "lifo"})
    assert started.status_code == 200, started.text
    intervention = started.json()
    assert intervention["type"] == "simple_explanation"
    assert intervention["root_gap"] == "lifo"
    content = intervention["content"]
    assert "lifo" in content["title"].lower() or "LIFO" in content["title"]
    assert len(content["visual"]) > 0
    assert content["example"]

    complete = client.post(f"/interventions/{intervention['id']}/complete", json={"completed": True, "result": "started_practice"})
    assert complete.status_code == 200, complete.text

    # Retest is blocked before all 3 practice questions are submitted.
    blocked = client.post("/retest/start", json={"student_id": "demo-student", "concept_id": "lifo"})
    assert blocked.status_code == 409, blocked.text

    all_questions = client.get("/questions").json()
    qmap = {q["id"]: q for q in all_questions}

    for index, qid in enumerate(PRACTICE_IDS, start=1):
        answer = qmap[qid]["correct_answer"]
        resp = client.post("/practice/submit", json={"student_id": "demo-student", "intervention_id": intervention["id"], "question_id": qid, "selected_answer": answer})
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["practice_completed"] == index
        assert body["practice_target"] == 3
        assert body["retest_unlocked"] == (index >= 3)

    unlocked = client.post("/retest/start", json={"student_id": "demo-student", "concept_id": "lifo"})
    assert unlocked.status_code == 200, unlocked.text
    assert unlocked.json()["practice_completed"] == 3


def test_practice_rejects_question_outside_targeted_set(client) -> None:
    _seed_gap(client)
    started = client.post("/interventions/start", json={"student_id": "demo-student", "concept_id": "lifo"})
    intervention_id = started.json()["id"]
    complete = client.post(f"/interventions/{intervention_id}/complete", json={"completed": True, "result": "started_practice"})
    assert complete.status_code == 200, complete.text
    resp = client.post("/practice/submit", json={"student_id": "demo-student", "intervention_id": intervention_id, "question_id": "q01", "selected_answer": "O(1)"})
    assert resp.status_code == 422, resp.text

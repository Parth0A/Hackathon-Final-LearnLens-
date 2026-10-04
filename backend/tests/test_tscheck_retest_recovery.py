"""Criterion: Retest measures recovery and updates the learning path."""

import pytest

from services.curriculum import QUESTION_BY_ID

pytestmark = pytest.mark.xdist_group(name="demo_student")

PRACTICE_IDS = ["q09", "q10", "q30"]
RETEST_IDS = ["q11", "q29", "q32"]


def _reach_retest_unlocked(client) -> dict:
    client.post("/demo/reset")
    start = client.post("/assessment/start", json={"student_id": "demo-student"})
    questions = start.json()["questions"]
    answers = [{"question_id": q["id"], "selected_answer": q["options"][0]} for q in questions]
    client.post("/assessment/submit", json={"student_id": "demo-student", "answers": answers})
    started = client.post("/interventions/start", json={"student_id": "demo-student", "concept_id": "lifo"})
    intervention = started.json()
    client.post(f"/interventions/{intervention['id']}/complete", json={"completed": True, "result": "started_practice"})
    all_questions = QUESTION_BY_ID
    for qid in PRACTICE_IDS:
        client.post("/practice/submit", json={"student_id": "demo-student", "intervention_id": intervention["id"], "question_id": qid, "selected_answer": all_questions[qid]["correct_answer"]})
    return intervention


def test_three_correct_retest_answers_recover_lifo_and_unlock_stack(client) -> None:
    _reach_retest_unlocked(client)
    pre_states = {item["concept_id"]: item for item in client.get("/learning-state/demo-student").json()}
    expected_mastery_before = pre_states["lifo"]["mastery"]

    retest = client.post("/retest/start", json={"student_id": "demo-student", "concept_id": "lifo"})
    assert retest.status_code == 200, retest.text
    session = retest.json()
    assert session["mastery_before"] == expected_mastery_before
    assert len(session["questions"]) == 3

    all_questions = {q["id"]: q for q in client.get("/questions").json()}
    answers = [{"question_id": qid, "selected_answer": all_questions[qid]["correct_answer"]} for qid in RETEST_IDS]
    submit = client.post("/retest/submit", json={"student_id": "demo-student", "retest_id": session["id"], "answers": answers})
    assert submit.status_code == 200, submit.text
    result = submit.json()
    assert result["status"] == "RECOVERED"
    assert result["mastery_before"] == expected_mastery_before
    assert result["mastery_after"] >= 0.8
    assert result["improvement"] > 0
    assert result["unlocked_concept"] == "stack"

    path = client.get("/learning-path/demo-student")
    assert path.status_code == 200, path.text
    items = {item["concept_id"]: item for item in path.json()["items"]}
    assert items["lifo"]["status"] == "recovered"
    assert items["stack"]["status"] != "locked"

    gaps = client.get("/gaps/demo-student")
    assert gaps.json() == []


def test_retest_404_for_unknown_retest_id(client) -> None:
    resp = client.post("/retest/submit", json={"student_id": "demo-student", "retest_id": "not-a-real-id", "answers": [{"question_id": "q11", "selected_answer": "A stack of plates"}]})
    assert resp.status_code == 404, resp.text

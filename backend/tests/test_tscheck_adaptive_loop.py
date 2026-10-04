"""Criterion: Adaptive loop changes strategy after a weak retest."""

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
        client.post("/practice/submit", json={"student_id": "demo-student", "intervention_id": intervention["id"], "question_id": qid, "selected_answer": QUESTION_BY_ID[qid]["correct_answer"]})
    return intervention


def _wrong_answer(question: dict) -> str:
    return next(option for option in QUESTION_BY_ID[question["id"]]["options"] if option != QUESTION_BY_ID[question["id"]]["correct_answer"])


def test_weak_retest_yields_not_recovered_and_next_intervention_is_different(client) -> None:
    first_intervention = _reach_retest_unlocked(client)
    assert first_intervention["type"] == "simple_explanation"

    retest = client.post("/retest/start", json={"student_id": "demo-student", "concept_id": "lifo"})
    session = retest.json()
    all_questions = QUESTION_BY_ID
    wrong_answers = [{"question_id": qid, "selected_answer": _wrong_answer(all_questions[qid])} for qid in RETEST_IDS]
    submit = client.post("/retest/submit", json={"student_id": "demo-student", "retest_id": session["id"], "answers": wrong_answers})
    assert submit.status_code == 200, submit.text
    result = submit.json()
    assert result["status"] in {"NOT_RECOVERED", "PARTIALLY_RECOVERED"}
    assert result["unlocked_concept"] is None

    # Path stays gated since LIFO was not recovered.
    path = client.get("/learning-path/demo-student")
    items = {item["concept_id"]: item for item in path.json()["items"]}
    assert items["lifo"]["status"] != "recovered"

    # The adaptive loop must offer a different intervention type next time.
    second = client.post("/interventions/start", json={"student_id": "demo-student", "concept_id": "lifo"})
    assert second.status_code == 200, second.text
    second_intervention = second.json()
    assert second_intervention["type"] == "visual_explanation"
    assert second_intervention["type"] != first_intervention["type"]

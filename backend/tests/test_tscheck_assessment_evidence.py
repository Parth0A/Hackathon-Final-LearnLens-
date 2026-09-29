"""Criterion: Assessment stores question-level evidence and detects the root gap."""

import pytest

pytestmark = pytest.mark.xdist_group(name="demo_student")


def test_first_option_pattern_stores_attempts_and_detects_lifo_gap(client) -> None:
    reset = client.post("/demo/reset")
    assert reset.status_code == 200, reset.text
    start = client.post("/assessment/start", json={"student_id": "demo-student"})
    assert start.status_code == 200, start.text
    session = start.json()
    assert session["question_count"] == 10
    assert len(session["questions"]) == 10
    answers = [{"question_id": q["id"], "selected_answer": q["options"][0]} for q in session["questions"]]
    submit = client.post("/assessment/submit", json={"student_id": "demo-student", "answers": answers})
    assert submit.status_code == 200, submit.text
    result = submit.json()
    assert result["attempts_saved"] == 10
    assert result["total"] == 10
    assert result["detected_gap"] is not None
    assert result["detected_gap"]["root_gap"] == "lifo"
    assert result["detected_gap"]["concept_id"] == "stack"
    assert result["detected_gap"]["confidence"] > 0
    states = {item["concept_id"]: item for item in result["states"]}
    assert states["lifo"]["attempts"] > 0
    assert states["stack"]["attempts"] > 0
    assert 0.0 <= states["lifo"]["mastery"] <= 1.0
    stored = client.get("/learning-state/demo-student")
    assert stored.status_code == 200, stored.text
    stored_map = {item["concept_id"]: item for item in stored.json()}
    assert stored_map["lifo"]["attempts"] == states["lifo"]["attempts"]
    assert stored_map["stack"]["root_gap"] == "lifo"


def test_submit_rejects_invalid_student_and_invalid_answer(client) -> None:
    missing_student = client.post("/assessment/submit", json={"student_id": "no-such-student", "answers": []})
    assert missing_student.status_code == 403, missing_student.text

    reset = client.post("/demo/reset")
    assert reset.status_code == 200

    bad_answer = client.post(
        "/assessment/submit",
        json={"student_id": "demo-student", "answers": [{"question_id": "q08", "selected_answer": "not-a-real-option"}]},
    )
    assert bad_answer.status_code == 422, bad_answer.text

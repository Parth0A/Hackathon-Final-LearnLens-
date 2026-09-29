"""Criterion: Curriculum graph, question bank, validation, and error states are real."""

import pytest

# /demo/reset here touches the shared demo-student row, so this file joins the same
# worker group as the other demo-student tests to avoid cross-module races.
pytestmark = pytest.mark.xdist_group(name="demo_student")


def test_concept_graph_question_bank_and_error_states(client) -> None:
    concepts = client.get("/concepts")
    assert concepts.status_code == 200, concepts.text
    concept_list = concepts.json()
    assert len(concept_list) >= 13
    concept_ids = {c["id"] for c in concept_list}
    for expected in ("lifo", "stack", "push", "pop", "fifo", "queue", "enqueue", "dequeue"):
        assert expected in concept_ids

    questions = client.get("/questions")
    assert questions.status_code == 200, questions.text
    question_list = questions.json()
    assert len(question_list) >= 30
    for question in question_list[:3]:
        assert question["concept_id"]
        assert question["difficulty"]
        assert question["misconception_tag"]
        assert question["source"]["source"]

    client.post("/demo/reset")
    path = client.get("/learning-path/demo-student")
    assert path.status_code == 200, path.text
    items = {item["concept_id"]: item for item in path.json()["items"]}
    assert "lifo" in items["stack"]["prerequisite_ids"]
    assert "stack" in items["push"]["prerequisite_ids"]
    assert "stack" in items["pop"]["prerequisite_ids"]
    assert "fifo" in items["queue"]["prerequisite_ids"]
    assert "queue" in items["enqueue"]["prerequisite_ids"]
    assert "queue" in items["dequeue"]["prerequisite_ids"]

    invalid_student = client.get("/dashboard/no-such-student")
    assert invalid_student.status_code == 403, invalid_student.text
    assert "detail" in invalid_student.json()

    invalid_answer = client.post(
        "/assessment/submit",
        json={"student_id": "demo-student", "answers": [{"question_id": "q08", "selected_answer": "totally-invalid-option"}]},
    )
    assert invalid_answer.status_code == 422, invalid_answer.text
    assert "detail" in invalid_answer.json()

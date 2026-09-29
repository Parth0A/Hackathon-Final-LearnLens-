"""Criterion: Why Am I Stuck explains the diagnosis from stored evidence."""

import pytest

pytestmark = pytest.mark.xdist_group(name="demo_student")


def _seed_gap(client) -> None:
    client.post("/demo/reset")
    start = client.post("/assessment/start", json={"student_id": "demo-student"})
    questions = start.json()["questions"]
    answers = [{"question_id": q["id"], "selected_answer": q["options"][0]} for q in questions]
    client.post("/assessment/submit", json={"student_id": "demo-student", "answers": answers})


def test_gap_detail_exposes_evidence_and_prerequisite_edge(client) -> None:
    _seed_gap(client)

    gaps = client.get("/gaps/demo-student")
    assert gaps.status_code == 200, gaps.text
    gap_list = gaps.json()
    assert len(gap_list) == 1
    assert gap_list[0]["root_gap"] == "lifo"
    assert gap_list[0]["concept_id"] == "stack"

    detail = client.get("/gaps/demo-student/stack")
    assert detail.status_code == 200, detail.text
    gap = detail.json()
    assert gap["root_gap"] == "lifo"
    assert gap["concept_id"] == "stack"
    assert 0 < gap["confidence"] <= 1
    assert len(gap["evidence"]) > 0
    tags = " ".join(str(item) for item in gap["evidence"])
    assert "FIFO" in tags or "LIFO" in tags

    prereqs = client.get("/concepts")
    concept_ids = {c["id"] for c in prereqs.json()}
    assert "lifo" in concept_ids and "stack" in concept_ids

    states = client.get("/learning-state/demo-student")
    state_map = {item["concept_id"]: item for item in states.json()}
    assert state_map["stack"]["root_gap"] == "lifo"
    assert state_map["stack"]["confidence"] == gap["confidence"]


def test_gap_detail_404_for_concept_without_active_gap(client) -> None:
    client.post("/demo/reset")
    detail = client.get("/gaps/demo-student/push")
    assert detail.status_code == 404, detail.text

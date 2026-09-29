"""Criterion: Dashboard and Teacher Radar reflect shared learning state."""

import pytest

pytestmark = pytest.mark.xdist_group(name="demo_student")


def test_dashboard_and_radar_update_after_assessment(client, teacher_client) -> None:
    client.post("/demo/reset")

    before = client.get("/dashboard/demo-student")
    assert before.status_code == 200, before.text
    before_body = before.json()
    assert before_body["active_gaps"] == 0
    assert before_body["assessment_count"] == 0

    start = client.post("/assessment/start", json={"student_id": "demo-student"})
    assert start.status_code == 200, start.text
    questions = start.json()["questions"]
    answers = [{"question_id": q["id"], "selected_answer": q["options"][0]} for q in questions]
    submitted = client.post("/assessment/submit", json={"student_id": "demo-student", "answers": answers})
    assert submitted.status_code == 200, submitted.text

    after = client.get("/dashboard/demo-student")
    assert after.status_code == 200, after.text
    after_body = after.json()
    assert after_body["active_gaps"] == 1
    assert after_body["current_gap"] == "lifo"
    assert after_body["assessment_count"] == 1
    labels = [event["type"] for event in after_body["recent_activity"]]
    assert "assessment_completed" in labels
    assert "gap_detected" in labels

    radar = teacher_client.get("/teacher/radar")
    assert radar.status_code == 200, radar.text
    radar_body = radar.json()
    attention_ids = [s["student_id"] for s in radar_body["students_needing_attention"]]
    assert "demo-student" in attention_ids
    gap_ids = [g["concept_id"] for g in radar_body["common_gaps"]]
    assert "lifo" in gap_ids

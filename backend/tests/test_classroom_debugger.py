"""Regression coverage for classroom assessments feeding the learning debugger."""

import uuid


def test_classroom_assessment_feeds_learning_debugger(teacher_client, client):
    suffix = uuid.uuid4().hex[:10]

    # Create a fresh student so the test starts with no learning history.
    registered = client.post(
        "/auth/register",
        json={
            "email": f"learnlens-classroom-{suffix}@example.com",
            "password": "TestPassword123!",
            "name": "Classroom Debugger Student",
            "role": "student",
            "class_name": "Engineering",
        },
    )
    assert registered.status_code == 200, registered.text
    student_id = registered.json()["user"]["student_id"]

    # Teacher owns the classroom and publishes a small assessment containing
    # the known FIFO/LIFO diagnostic pattern.
    classroom = teacher_client.post(
        "/classrooms",
        json={
            "name": f"Debugger Classroom {suffix}",
            "subject": "Data Structures",
            "class_division": "A",
            "academic_year": "2026-27",
        },
    )
    assert classroom.status_code == 200, classroom.text
    classroom_id = classroom.json()["id"]

    joined = client.post(
        "/classrooms/join",
        json={"code": classroom.json()["code"]},
    )
    assert joined.status_code == 200, joined.text

    assessment = teacher_client.post(
        f"/classrooms/{classroom_id}/assessments",
        json={
            "title": "FIFO LIFO Diagnostic",
            "question_ids": ["q08", "q09", "q10"],
            "published": True,
        },
    )
    assert assessment.status_code == 200, assessment.text
    assessment_id = assessment.json()["id"]

    # Intentionally answer the diagnostic questions incorrectly.
    assessment_questions = {q["id"]: q for q in assessment.json()["questions"]}
    answers = [
        {
            "question_id": qid,
            "selected_answer": next(
                option
                for option in assessment_questions[qid]["options"]
                if option != QUESTION_BY_ID[qid]["correct_answer"]
            ),
        }
        for qid in ("q08", "q09", "q10")
    ]

    submitted = client.post(
        f"/classrooms/assessments/{assessment_id}/submit",
        json={"answers": answers},
    )
    assert submitted.status_code == 200, submitted.text
    result = submitted.json()
    assert result["correct"] == 0
    assert result["total"] == 3
    assert result["score"] == 0
    assert result["attempts_saved"] == 3

    # The classroom submission must enter the same debugger pipeline as the
    # standalone assessment: root gap, active gap, and recovery state.
    state = client.get(f"/learning-state/{student_id}")
    assert state.status_code == 200, state.text
    states = state.json()
    lifo = next(item for item in states if item["concept_id"] == "lifo")
    stack = next(item for item in states if item["concept_id"] == "stack")
    assert lifo["mastery"] == 0
    assert lifo["recovery_status"] == "in_recovery"
    assert stack["root_gap"] == "lifo"
    assert stack["recovery_status"] == "in_recovery"

    gaps = client.get(f"/gaps/{student_id}")
    assert gaps.status_code == 200, gaps.text
    active_gaps = gaps.json()
    assert len(active_gaps) == 1
    assert active_gaps[0]["root_gap"] == "lifo"
    assert active_gaps[0]["concept_id"] == "stack"
    assert active_gaps[0]["status"] == "active"

    # Persistence/visibility: dashboard and history reflect the classroom event.
    dashboard = client.get(f"/dashboard/{student_id}")
    assert dashboard.status_code == 200, dashboard.text
    body = dashboard.json()
    assert body["assessment_count"] == 1
    assert body["mastery_history"]
    assert body["mastery_history"][-1]["label"] == "Classroom Assessment"

    activity_labels = [item["label"] for item in body["recent_activity"]]
    assert any("classroom assessment" in label.lower() for label in activity_labels)
    assert any("lifo" in label.lower() for label in activity_labels)

    # Teacher can see the submitted result through the owned classroom.
    assessments = teacher_client.get(f"/classrooms/{classroom_id}/assessments")
    assert assessments.status_code == 200, assessments.text
    published = next(item for item in assessments.json() if item["id"] == assessment_id)
    assert published["submission_count"] == 1

    roster = teacher_client.get(f"/classrooms/{classroom_id}/roster")
    assert roster.status_code == 200, roster.text
    assert any(item["student_id"] == student_id for item in roster.json())

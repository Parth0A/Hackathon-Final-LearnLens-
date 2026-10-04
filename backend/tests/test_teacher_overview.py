"""Tests for GET /api/teacher/overview (LearnLens teacher dashboard additions)."""

import os

import httpx

BASE_URL = os.environ.get("BACKEND_URL", "http://localhost:8001").rstrip("/")
API_URL = f"{BASE_URL}/api"
TEACHER = {"email": os.environ.get("DEMO_TEACHER_EMAIL", ""), "password": os.environ.get("DEMO_TEACHER_PASSWORD", "")}
STUDENT = {"email": os.environ.get("DEMO_STUDENT_EMAIL", ""), "password": os.environ.get("DEMO_STUDENT_PASSWORD", "")}


def _login(creds: dict) -> httpx.Client:
    assert creds["email"] and creds["password"], "Missing DEMO_TEACHER_/DEMO_STUDENT_ test credentials"
    session = httpx.Client(base_url=API_URL, timeout=15)
    response = session.post("/auth/login", json=creds)
    assert response.status_code == 200, response.text
    return session


def test_overview_requires_auth():
    response = httpx.get(f"{API_URL}/teacher/overview", timeout=15)
    assert response.status_code == 401


def test_overview_forbidden_for_student():
    session = _login(STUDENT)
    response = session.get("/teacher/overview")
    assert response.status_code == 403
    assert "Teacher" in response.json().get("detail", "")


def test_overview_shape_and_values_for_teacher():
    session = _login(TEACHER)
    response = session.get("/teacher/overview")
    assert response.status_code == 200, response.text
    data = response.json()
    for key in ["students_enrolled", "active_now", "active_window_minutes",
                "assessments", "needs_attention", "class_mastery", "students"]:
        assert key in data, f"missing {key}"
    assert data["active_window_minutes"] == 30
    assert data["students_enrolled"] >= 1
    assert isinstance(data["class_mastery"], (float, int))
    assert 0.0 <= data["class_mastery"] <= 1.0
    assert isinstance(data["students"], list) and len(data["students"]) == data["students_enrolled"]
    names = {s["name"] for s in data["students"]}
    for expected in ["Demo Student", "Maya Patel", "Jon Bell", "Priya Shah", "Leo Martin"]:
        assert expected in names, f"missing student {expected}"
    for entry in data["students"]:
        for key in ["student_id", "name", "active", "last_activity_label",
                    "last_activity_at", "learning_status"]:
            assert key in entry, f"student entry missing {key}"
        assert entry["learning_status"] in {"needs_attention", "in_recovery", "on_track", "not_started"}


def test_overview_active_now_consistency():
    session = _login(TEACHER)
    response = session.get("/teacher/overview")
    data = response.json()
    active_from_roster = sum(1 for x in data["students"] if x["active"])
    assert data["active_now"] >= active_from_roster

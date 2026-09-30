"""Tests for GET /api/teacher/overview (LearnLens teacher dashboard additions)."""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://lens-inspect-2.preview.emergentagent.com").rstrip("/")
TEACHER = {"email": "teacher@learnlens.demo", "password": "LearnLens#Teacher1"}
STUDENT = {"email": "student@learnlens.demo", "password": "LearnLens#Student1"}


def _login(creds):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, r.text
    return s


def test_overview_requires_auth():
    r = requests.get(f"{BASE_URL}/api/teacher/overview", timeout=15)
    assert r.status_code == 401


def test_overview_forbidden_for_student():
    s = _login(STUDENT)
    r = s.get(f"{BASE_URL}/api/teacher/overview", timeout=15)
    assert r.status_code == 403
    assert "Teacher" in r.json().get("detail", "")


def test_overview_shape_and_values_for_teacher():
    s = _login(TEACHER)
    r = s.get(f"{BASE_URL}/api/teacher/overview", timeout=15)
    assert r.status_code == 200
    data = r.json()
    # Top-level shape
    for key in ["students_enrolled", "active_now", "active_window_minutes",
                "assessments", "needs_attention", "class_mastery", "students"]:
        assert key in data, f"missing {key}"
    assert data["active_window_minutes"] == 30
    assert data["students_enrolled"] == 5
    assert data["assessments"] == 0
    assert data["needs_attention"] == 0
    assert isinstance(data["class_mastery"], (float, int))
    assert 0.0 <= data["class_mastery"] <= 1.0
    # Students array
    assert isinstance(data["students"], list) and len(data["students"]) == 5
    names = {s["name"] for s in data["students"]}
    for expected in ["Demo Student", "Maya Patel", "Jon Bell", "Priya Shah", "Leo Martin"]:
        assert expected in names, f"missing student {expected}"
    for entry in data["students"]:
        for key in ["student_id", "name", "active", "last_activity_label",
                    "last_activity_at", "learning_status"]:
            assert key in entry, f"student entry missing {key}"
        assert entry["learning_status"] in {"needs_attention", "in_recovery", "on_track", "not_started"}


def test_overview_active_now_consistency():
    s = _login(TEACHER)
    r = s.get(f"{BASE_URL}/api/teacher/overview", timeout=15)
    data = r.json()
    active_from_roster = sum(1 for x in data["students"] if x["active"])
    # active_now should be at least the number of active students in the returned roster
    # (roster is scoped to owned classrooms; active_now uses same scope)
    assert data["active_now"] >= active_from_roster or data["active_now"] == active_from_roster

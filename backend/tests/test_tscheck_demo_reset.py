"""Criterion: Demo reset restores the controlled initial state."""

import pytest

# All demo-student tests share one mutable singleton row in the backend (there is no
# per-test student fixture in this API), so every module that touches demo-student is
# pinned to the same xdist worker to avoid cross-file races under -n 2 --dist loadscope.
pytestmark = pytest.mark.xdist_group(name="demo_student")


def test_reset_restores_initial_mastery_and_clears_gaps(client) -> None:
    resp = client.post("/demo/reset")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["student"]["id"] == "demo-student"
    assert body["initial_mastery"]["lifo"] == 0.42
    assert body["initial_mastery"]["stack"] == 0.45

    states = client.get("/learning-state/demo-student")
    assert states.status_code == 200, states.text
    state_map = {item["concept_id"]: item for item in states.json()}
    assert state_map["lifo"]["mastery"] == 0.42
    assert state_map["stack"]["mastery"] == 0.45
    assert state_map["lifo"]["recovery_status"] == "in_recovery"
    assert state_map["lifo"]["attempts"] == 0

    gaps = client.get("/gaps/demo-student")
    assert gaps.status_code == 200, gaps.text
    assert gaps.json() == []

    dashboard = client.get("/dashboard/demo-student")
    assert dashboard.status_code == 200, dashboard.text
    dash_body = dashboard.json()
    assert dash_body["active_gaps"] == 0
    assert dash_body["current_gap"] is None

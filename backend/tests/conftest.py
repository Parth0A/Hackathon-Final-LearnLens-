"""Pre-scaffolded pytest fixtures for the FastAPI backend.

Tests hit the live uvicorn process managed by supervisor (not an in-process ASGI app), so
the app under test is the same one the frontend and Playwright see. Do NOT re-create this
file — add app-specific fixtures below the marker at the bottom.
"""

import os

import httpx
import pytest
import pytest_asyncio

BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8001")
API_URL = f"{BACKEND_URL}/api"


def api_url(path: str = "") -> str:
    return f"{API_URL}{path}"


@pytest.fixture(scope="session")
def backend_url() -> str:
    return BACKEND_URL


def _login(c: httpx.Client, email_env: str, password_env: str) -> None:
    email = os.environ.get(email_env)
    password = os.environ.get(password_env)
    if not email or not password:
        pytest.fail(f"Missing {email_env}/{password_env} test credentials")
    response = c.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text


@pytest.fixture
def client():
    with httpx.Client(base_url=API_URL, timeout=30.0) as c:
        _login(c, "DEMO_STUDENT_EMAIL", "DEMO_STUDENT_PASSWORD")
        yield c


@pytest.fixture
def teacher_client():
    with httpx.Client(base_url=API_URL, timeout=30.0) as c:
        _login(c, "DEMO_TEACHER_EMAIL", "DEMO_TEACHER_PASSWORD")
        yield c


@pytest_asyncio.fixture
async def aclient():
    async with httpx.AsyncClient(base_url=API_URL, timeout=30.0) as c:
        yield c

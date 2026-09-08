import os
import uuid
import pytest
import requests
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def student_user(base_url, api):
    """Create a fresh student user; each xdist worker gets its own."""
    sid = f"TEST-{uuid.uuid4().hex[:8]}"
    r = api.post(f"{base_url}/api/auth/student-login", json={"name": "TEST Student", "student_id": sid})
    assert r.status_code == 200, r.text
    return r.json()

"""Full backend API test suite for Ahmad Classes MVP.

Each test class is self-contained (no cross-class state) because pytest-xdist
loadscope pins classes to different workers.
"""
import io
import time
import uuid
import pytest
import requests


# ---------------------------------------------------------------- Health
def test_health(base_url, api):
    r = api.get(f"{base_url}/api/")
    assert r.status_code == 200
    assert r.json().get("ok") is True


# ---------------------------------------------------------------- Auth
class TestAuth:
    def test_student_login_creates_user(self, base_url, api):
        sid = f"TEST-{uuid.uuid4().hex[:8]}"
        r = api.post(f"{base_url}/api/auth/student-login", json={"name": "TEST S", "student_id": sid})
        assert r.status_code == 200, r.text
        u = r.json()
        assert u["role"] == "student"
        assert u["student_id"] == sid
        assert u["id"] and u["name"] == "TEST S"

        # Idempotent second login returns same id
        r2 = api.post(f"{base_url}/api/auth/student-login", json={"name": "TEST S", "student_id": sid})
        assert r2.status_code == 200
        assert r2.json()["id"] == u["id"]

    def test_admin_login_success(self, base_url, api):
        r = api.post(f"{base_url}/api/auth/admin-login", json={"username": "admin", "password": "admin123"})
        assert r.status_code == 200, r.text
        assert r.json()["role"] == "admin"

    def test_admin_login_wrong_password(self, base_url, api):
        r = api.post(f"{base_url}/api/auth/admin-login", json={"username": "admin", "password": "wrong"})
        assert r.status_code == 401


# ---------------------------------------------------------------- Batches
class TestBatches:
    def test_list_seeded_batches(self, base_url, api):
        r = api.get(f"{base_url}/api/batches")
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list) and len(items) >= 3

    def test_get_batch_detail_and_404(self, base_url, api):
        items = api.get(f"{base_url}/api/batches").json()
        r = api.get(f"{base_url}/api/batches/{items[0]['id']}")
        assert r.status_code == 200 and r.json()["id"] == items[0]["id"]
        r2 = api.get(f"{base_url}/api/batches/does-not-exist")
        assert r2.status_code == 404

    def test_create_purchase_and_list_user_batches(self, base_url, api, student_user):
        payload = {"title": "TEST_Batch", "subject": "TS", "description": "d", "price": 999}
        r = api.post(f"{base_url}/api/batches", json=payload)
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["hero_image"]  # default filled
        # GET verify
        assert api.get(f"{base_url}/api/batches/{b['id']}").status_code == 200

        r2 = api.post(f"{base_url}/api/batches/{b['id']}/purchase", json={"user_id": student_user["id"]})
        assert r2.status_code == 200 and r2.json().get("success") is True

        r3 = api.get(f"{base_url}/api/users/{student_user['id']}/batches")
        assert r3.status_code == 200
        assert b["id"] in [x["id"] for x in r3.json()]


# ---------------------------------------------------------------- Live
class TestLive:
    def test_start_current_end_creates_note(self, base_url, api):
        r = api.post(f"{base_url}/api/live/start", json={
            "title": "TEST_Live", "subject": "Physics",
            "youtube_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        })
        assert r.status_code == 200, r.text
        live = r.json()
        assert live["is_live"] is True
        live_id = live["id"]

        r2 = api.get(f"{base_url}/api/live/current")
        assert r2.status_code == 200
        assert r2.json() and r2.json()["id"] == live_id

        r3 = api.post(f"{base_url}/api/live/{live_id}/end")
        assert r3.status_code == 200
        note_id = r3.json()["recorded_note_id"]

        r4 = api.get(f"{base_url}/api/notes/{note_id}")
        assert r4.status_code == 200
        n = r4.json()
        assert n["kind"] == "video" and "youtube.com" in n["storage_path"]


# ---------------------------------------------------------------- Polls
class TestPolls:
    def test_poll_full_flow(self, base_url, api, student_user):
        r = api.post(f"{base_url}/api/polls", json={"question": "TEST?", "options": ["A", "B", "C"]})
        assert r.status_code == 200
        p = r.json()
        pid = p["id"]
        assert p["is_open"] and p["votes"] == [0, 0, 0]

        rc = api.get(f"{base_url}/api/polls/current")
        assert rc.status_code == 200 and rc.json() is not None

        v = api.post(f"{base_url}/api/polls/{pid}/vote", json={"user_id": student_user["id"], "option_index": 1})
        assert v.status_code == 200
        assert v.json()["votes"][1] == 1

        # duplicate rejected
        v2 = api.post(f"{base_url}/api/polls/{pid}/vote", json={"user_id": student_user["id"], "option_index": 0})
        assert v2.status_code == 400

        c = api.post(f"{base_url}/api/polls/{pid}/close")
        assert c.status_code == 200 and c.json()["is_open"] is False


# ---------------------------------------------------------------- Chat
class TestChat:
    def test_post_and_list_chat(self, base_url, api, student_user):
        r = api.post(f"{base_url}/api/chat", json={
            "user_id": student_user["id"], "user_name": student_user["name"], "message": "TEST hello"
        })
        assert r.status_code == 200
        assert r.json()["message"] == "TEST hello"

        r2 = api.get(f"{base_url}/api/chat")
        assert r2.status_code == 200
        assert any(m["message"] == "TEST hello" for m in r2.json())


# ---------------------------------------------------------------- Notes
class TestNotes:
    def test_list_and_filters(self, base_url, api):
        r = api.get(f"{base_url}/api/notes")
        assert r.status_code == 200 and len(r.json()) >= 4

        r2 = api.get(f"{base_url}/api/notes", params={"kind": "pdf"})
        assert r2.status_code == 200
        assert all(n["kind"] == "pdf" for n in r2.json())

        r3 = api.get(f"{base_url}/api/notes", params={"subject": "Physics"})
        assert r3.status_code == 200
        assert all(n["subject"] == "Physics" for n in r3.json())


# ---------------------------------------------------------------- Quizzes
class TestQuizzes:
    def test_list_get_create_submit_scores(self, base_url, api, student_user):
        r = api.get(f"{base_url}/api/quizzes")
        assert r.status_code == 200
        quizzes = r.json()
        assert len(quizzes) >= 2
        quiz = quizzes[0]

        r2 = api.get(f"{base_url}/api/quizzes/{quiz['id']}")
        assert r2.status_code == 200
        assert "correct_index" in r2.json()["questions"][0]

        create_payload = {
            "title": "TEST_Quiz", "subject": "TS", "duration_seconds": 60,
            "questions": [
                {"q": "2+2?", "options": ["3", "4"], "correct_index": 1},
                {"q": "3+3?", "options": ["6", "7"], "correct_index": 0},
            ],
        }
        rc = api.post(f"{base_url}/api/quizzes", json=create_payload)
        assert rc.status_code == 200

        # Submit all correct answers for seeded quiz
        answers = [q["correct_index"] for q in quiz["questions"]]
        rs = api.post(f"{base_url}/api/quizzes/{quiz['id']}/submit",
                      json={"user_id": student_user["id"], "answers": answers})
        assert rs.status_code == 200, rs.text
        s = rs.json()
        assert s["correct"] == len(answers) and s["score"] == 100

        rg = api.get(f"{base_url}/api/users/{student_user['id']}/quiz-scores")
        assert rg.status_code == 200
        subs = rg.json()
        assert len(subs) >= 1 and subs[0]["user_id"] == student_user["id"]


# ---------------------------------------------------------------- Analytics
class TestAnalytics:
    def test_admin_analytics(self, base_url, api):
        r = api.get(f"{base_url}/api/admin/analytics")
        assert r.status_code == 200
        data = r.json()
        for k in ["students", "batches", "quizzes", "submissions", "live_active", "notes"]:
            assert k in data and isinstance(data[k], int)


# ---------------------------------------------------------------- Upload / files
def _make_pdf_bytes() -> bytes:
    return (
        b"%PDF-1.4\n"
        b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
        b"2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n"
        b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 144]/Contents 4 0 R>>endobj\n"
        b"4 0 obj<</Length 44>>stream\nBT /F1 18 Tf 20 100 Td (TEST PDF) Tj ET\nendstream endobj\n"
        b"xref\n0 5\n0000000000 65535 f \n0000000010 00000 n \n0000000053 00000 n \n"
        b"0000000102 00000 n \n0000000160 00000 n \ntrailer<</Size 5/Root 1 0 R>>\nstartxref\n250\n%%EOF\n"
    )


class TestUpload:
    def test_upload_and_fetch_pdf(self, base_url):
        pdf = _make_pdf_bytes()
        files = {"file": ("test.pdf", io.BytesIO(pdf), "application/pdf")}
        data = {"title": "TEST_Note", "subject": "TEST", "kind": "pdf"}
        r = requests.post(f"{base_url}/api/upload", files=files, data=data, timeout=180)
        assert r.status_code == 200, r.text
        note = r.json()
        assert note["kind"] == "pdf" and note["storage_path"]

        r2 = requests.get(f"{base_url}/api/files/{note['storage_path']}", timeout=60)
        assert r2.status_code == 200
        assert r2.content == pdf


# ---------------------------------------------------------------- AI streaming
class TestAI:
    def test_ai_chat_streams(self, base_url):
        with requests.post(
            f"{base_url}/api/ai/chat",
            json={"session_id": f"TEST-{uuid.uuid4().hex[:6]}", "message": "Say hi in 3 words"},
            stream=True, timeout=60,
        ) as r:
            assert r.status_code == 200, r.text
            assert "text/plain" in r.headers.get("content-type", "")
            received = b""
            start = time.time()
            for chunk in r.iter_content(chunk_size=64):
                if chunk:
                    received += chunk
                    if len(received) >= 3:
                        break
                if time.time() - start > 45:
                    break
            assert len(received) > 0, "No streamed bytes from AI endpoint"

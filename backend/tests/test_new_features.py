"""Test suite for the 9 new/changed endpoints (iteration 2):
   UPI payments, leaderboard, push registration (fail-soft),
   live-start push broadcast, AI quiz/batch generators, AI photo (vision) streaming.
"""
import io
import time
import uuid
import urllib.parse

import pytest
import requests


# ---------------------------------------------------------------- helpers
def _tiny_jpeg_bytes() -> bytes:
    """Create a tiny (~2KB) synthetic JPEG in memory using Pillow."""
    try:
        from PIL import Image
    except Exception:
        pytest.skip("Pillow not installed")
    buf = io.BytesIO()
    img = Image.new("RGB", (64, 64), color=(200, 220, 240))
    img.save(buf, format="JPEG", quality=60)
    return buf.getvalue()


# ---------------------------------------------------------------- UPI payments
class TestUPIPayments:
    def test_checkout_returns_upi_url_with_tr_param(self, base_url, api, student_user):
        batches = api.get(f"{base_url}/api/batches").json()
        assert batches, "No seeded batches"
        batch = batches[0]

        r = api.post(
            f"{base_url}/api/batches/{batch['id']}/checkout",
            json={"user_id": student_user["id"]},
        )
        assert r.status_code == 200, r.text
        j = r.json()
        for k in ["payment_id", "amount", "vpa", "payee_name", "upi_url"]:
            assert k in j, f"Missing key {k} in checkout response"

        assert j["upi_url"].startswith("upi://pay?"), f"upi_url malformed: {j['upi_url']}"
        assert j["amount"] == batch["price"]
        assert j["vpa"] and "@" in urllib.parse.unquote(j["vpa"])
        assert j["payee_name"]

        # Verify tr param equals payment_id
        query = urllib.parse.urlparse(j["upi_url"].replace("upi://", "http://")).query
        params = dict(urllib.parse.parse_qsl(query))
        assert params.get("tr") == j["payment_id"], f"tr param != payment_id: {params}"
        assert params.get("pa") == j["vpa"]
        assert params.get("am") == str(batch["price"])
        assert params.get("cu") == "INR"

    def test_get_payment_returns_pending(self, base_url, api, student_user):
        batches = api.get(f"{base_url}/api/batches").json()
        chk = api.post(
            f"{base_url}/api/batches/{batches[0]['id']}/checkout",
            json={"user_id": student_user["id"]},
        ).json()
        pid = chk["payment_id"]

        r = api.get(f"{base_url}/api/payments/{pid}")
        assert r.status_code == 200
        p = r.json()
        assert p["id"] == pid
        assert p["status"] == "pending"
        assert p["user_id"] == student_user["id"]
        assert p["batch_id"] == batches[0]["id"]
        assert p["amount"] == batches[0]["price"]

    def test_confirm_marks_paid_enrolls_user_and_idempotent(self, base_url, api, student_user):
        batches = api.get(f"{base_url}/api/batches").json()
        batch = batches[1] if len(batches) > 1 else batches[0]
        chk = api.post(
            f"{base_url}/api/batches/{batch['id']}/checkout",
            json={"user_id": student_user["id"]},
        ).json()
        pid = chk["payment_id"]

        r = api.post(f"{base_url}/api/payments/{pid}/confirm")
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["status"] == "paid"
        assert j["batch_id"] == batch["id"]

        # Verify persisted
        g = api.get(f"{base_url}/api/payments/{pid}").json()
        assert g["status"] == "paid"

        # Verify user enrollment
        ub = api.get(f"{base_url}/api/users/{student_user['id']}/batches").json()
        assert batch["id"] in [b["id"] for b in ub]

        # Idempotent confirm
        r2 = api.post(f"{base_url}/api/payments/{pid}/confirm")
        assert r2.status_code == 200
        assert r2.json()["status"] == "already_paid"
        assert r2.json()["batch_id"] == batch["id"]

    def test_confirm_unknown_payment_404(self, base_url, api):
        r = api.post(f"{base_url}/api/payments/does-not-exist/confirm")
        assert r.status_code == 404


# ---------------------------------------------------------------- Leaderboard
class TestLeaderboard:
    def test_leaderboard_sorted_and_shape(self, base_url, api):
        # Ensure at least one submission exists by submitting a quiz
        sid = f"TEST-{uuid.uuid4().hex[:8]}"
        u = api.post(f"{base_url}/api/auth/student-login",
                     json={"name": "TEST LB", "student_id": sid}).json()
        quizzes = api.get(f"{base_url}/api/quizzes").json()
        assert quizzes
        quiz = quizzes[0]
        answers = [q["correct_index"] for q in quiz["questions"]]
        api.post(f"{base_url}/api/quizzes/{quiz['id']}/submit",
                 json={"user_id": u["id"], "answers": answers})

        r = api.get(f"{base_url}/api/leaderboard")
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        assert len(rows) >= 1
        # Sorted by total_score desc
        scores = [row["total_score"] for row in rows]
        assert scores == sorted(scores, reverse=True), f"Not sorted desc: {scores}"
        for row in rows:
            for k in ["user_id", "name", "total_score", "attempts", "avg_score"]:
                assert k in row, f"Missing key {k} in leaderboard row"
            assert isinstance(row["attempts"], int) and row["attempts"] >= 1


# ---------------------------------------------------------------- Push (fail-soft)
class TestPushRegister:
    def test_register_push_placeholder_key_fail_soft(self, base_url, api, student_user):
        r = api.post(f"{base_url}/api/register-push", json={
            "user_id": student_user["id"],
            "platform": "ios",
            "device_token": "TEST_TOKEN_" + uuid.uuid4().hex[:8],
        })
        assert r.status_code == 201, r.text
        j = r.json()
        assert j.get("status") in ("queued", "registered"), f"Unexpected: {j}"


# ---------------------------------------------------------------- Live start push non-blocking
class TestLiveStartPushSafe:
    def test_live_start_ok_even_with_placeholder_push_key(self, base_url, api):
        r = api.post(f"{base_url}/api/live/start", json={
            "title": "TEST_PushSafe",
            "subject": "Physics",
            "youtube_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        })
        assert r.status_code == 200, r.text
        live = r.json()
        assert live["is_live"] is True
        # End it to keep DB clean
        api.post(f"{base_url}/api/live/{live['id']}/end")


# ---------------------------------------------------------------- AI generators
class TestAIGenerators:
    def test_generate_quiz_returns_three_mcqs(self, base_url, api):
        r = requests.post(
            f"{base_url}/api/ai/generate-quiz",
            json={"topic": "Newton laws", "subject": "Physics", "num_questions": 3},
            timeout=90,
        )
        assert r.status_code == 200, r.text
        j = r.json()
        assert "questions" in j
        qs = j["questions"]
        assert isinstance(qs, list) and len(qs) == 3, f"Expected 3 questions, got {len(qs)}"
        for q in qs:
            assert q.get("q") and isinstance(q["q"], str)
            assert isinstance(q.get("options"), list) and len(q["options"]) == 4
            assert all(isinstance(o, str) for o in q["options"])
            assert isinstance(q.get("correct_index"), int) and 0 <= q["correct_index"] <= 3

    def test_write_batch_returns_description(self, base_url, api):
        r = requests.post(
            f"{base_url}/api/ai/write-batch",
            json={"title": "Physics Booster", "subject": "Physics"},
            timeout=90,
        )
        assert r.status_code == 200, r.text
        j = r.json()
        assert "description" in j
        desc = j["description"]
        assert isinstance(desc, str) and len(desc.strip()) > 0
        # ≥ 20 words
        assert len(desc.split()) >= 20, f"Description too short ({len(desc.split())} words): {desc}"


# ---------------------------------------------------------------- AI Photo vision streaming
class TestAIPhoto:
    def test_ai_photo_streams_text_plain(self, base_url):
        img = _tiny_jpeg_bytes()
        assert 500 < len(img) < 5000, f"Image size out of expected range: {len(img)}"

        files = {"file": ("test.jpg", io.BytesIO(img), "image/jpeg")}
        data = {
            "session_id": f"TEST-{uuid.uuid4().hex[:6]}",
            "question": "Describe this image very briefly in 5 words.",
        }
        with requests.post(
            f"{base_url}/api/ai/photo",
            files=files, data=data,
            stream=True, timeout=90,
        ) as r:
            assert r.status_code == 200, r.text
            ctype = r.headers.get("content-type", "")
            assert "text/plain" in ctype, f"Expected text/plain, got {ctype}"

            received = b""
            start = time.time()
            first_byte_at = None
            for chunk in r.iter_content(chunk_size=64):
                if chunk:
                    if first_byte_at is None:
                        first_byte_at = time.time() - start
                    received += chunk
                    if len(received) >= 8:
                        break
                if time.time() - start > 60:
                    break
            assert len(received) > 0, "No bytes streamed from /ai/photo"
            # First byte should arrive within a reasonable time (Gemini vision can be slow)
            assert first_byte_at is not None and first_byte_at < 45, (
                f"First byte took {first_byte_at:.1f}s"
            )

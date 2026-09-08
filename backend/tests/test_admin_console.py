"""Iteration 3: Admin console CRUD tests.
Covers:
  * POST/GET/DELETE /api/batches
  * POST /api/upload (PDF + fake video/mp4), GET /api/notes, GET /api/files/{path}, DELETE /api/notes/{id}
  * POST /api/quizzes
"""
import io
import uuid
import pytest
import requests


# ---------------------------------------------------------------- Batches
class TestBatchesAdminCRUD:
    def test_create_batch_default_hero_image_when_empty(self, base_url, api):
        payload = {
            "title": f"TEST_Batch_{uuid.uuid4().hex[:6]}",
            "subject": "Physics",
            "description": "Temp batch for admin console test",
            "price": 1499,
            "duration_weeks": 10,
            "lessons": 20,
            "instructor": "Test Sir",
            "hero_image": "",  # explicit empty -> default should kick in
        }
        r = api.post(f"{base_url}/api/batches", json=payload)
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["id"] and isinstance(b["id"], str)
        assert b["title"] == payload["title"]
        assert b["hero_image"], "hero_image should be filled with default"
        assert b["hero_image"].startswith("http")

        # GET list contains it
        lst = api.get(f"{base_url}/api/batches").json()
        assert any(x["id"] == b["id"] for x in lst)

        # DELETE
        d = api.delete(f"{base_url}/api/batches/{b['id']}")
        assert d.status_code == 200, d.text
        assert d.json().get("success") is True

        # GET single now 404
        g = api.get(f"{base_url}/api/batches/{b['id']}")
        assert g.status_code == 404

    def test_delete_unknown_batch_returns_404(self, base_url, api):
        r = api.delete(f"{base_url}/api/batches/does-not-exist-{uuid.uuid4().hex[:6]}")
        assert r.status_code == 404


# ---------------------------------------------------------------- Notes upload
_TINY_PDF = (
    b"%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
    b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
    b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 100 100]>>endobj\n"
    b"xref\n0 4\n0000000000 65535 f \ntrailer<</Size 4/Root 1 0 R>>\n%%EOF"
)


class TestNotesUploadAndDelete:
    def test_upload_pdf_then_get_file_then_delete(self, base_url):
        files = {"file": ("test.pdf", io.BytesIO(_TINY_PDF), "application/pdf")}
        data = {"title": f"TEST_PDF_{uuid.uuid4().hex[:6]}", "subject": "Physics", "kind": "pdf"}
        r = requests.post(f"{base_url}/api/upload", files=files, data=data, timeout=60)
        assert r.status_code == 200, r.text
        note = r.json()
        assert note["id"] and note["storage_path"]
        assert note["kind"] == "pdf"
        assert note["title"] == data["title"]

        # GET /notes contains it
        lst = requests.get(f"{base_url}/api/notes", timeout=30).json()
        assert any(n["id"] == note["id"] for n in lst)

        # GET the bytes back via /files/{path}
        fr = requests.get(f"{base_url}/api/files/{note['storage_path']}", timeout=60)
        assert fr.status_code == 200, fr.text
        assert fr.content == _TINY_PDF

        # DELETE the note
        dr = requests.delete(f"{base_url}/api/notes/{note['id']}", timeout=30)
        assert dr.status_code == 200
        assert dr.json().get("success") is True

        # 404 on second delete
        dr2 = requests.delete(f"{base_url}/api/notes/{note['id']}", timeout=30)
        assert dr2.status_code == 404

    def test_upload_fake_video_mp4(self, base_url):
        fake_bytes = b"\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom" + b"A" * (2 * 1024 * 1024)
        files = {"file": ("clip.mp4", io.BytesIO(fake_bytes), "video/mp4")}
        data = {"title": f"TEST_VID_{uuid.uuid4().hex[:6]}", "subject": "Physics", "kind": "video"}
        r = requests.post(f"{base_url}/api/upload", files=files, data=data, timeout=120)
        assert r.status_code == 200, r.text
        note = r.json()
        assert note["kind"] == "video"
        assert note["storage_path"]

        # Verify listed with kind=video filter
        lst = requests.get(f"{base_url}/api/notes?kind=video", timeout=30).json()
        assert any(n["id"] == note["id"] for n in lst)

        # cleanup
        requests.delete(f"{base_url}/api/notes/{note['id']}", timeout=30)

    def test_delete_unknown_note_returns_404(self, base_url):
        r = requests.delete(f"{base_url}/api/notes/does-not-exist-{uuid.uuid4().hex[:6]}", timeout=30)
        assert r.status_code == 404


# ---------------------------------------------------------------- Quizzes
class TestQuizCreate:
    def test_create_quiz_manual(self, base_url, api):
        payload = {
            "title": f"TEST_Quiz_{uuid.uuid4().hex[:6]}",
            "subject": "Physics",
            "duration_seconds": 180,
            "questions": [
                {"q": "2+2?", "options": ["1", "2", "3", "4"], "correct_index": 3},
            ],
        }
        r = api.post(f"{base_url}/api/quizzes", json=payload)
        assert r.status_code == 200, r.text
        q = r.json()
        assert q["id"] and q["title"] == payload["title"]
        assert len(q["questions"]) == 1

        # Verify via GET
        g = api.get(f"{base_url}/api/quizzes/{q['id']}").json()
        assert g["id"] == q["id"]

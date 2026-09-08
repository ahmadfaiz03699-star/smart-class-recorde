import os
import uuid
import logging
import asyncio
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Optional, Any

from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form, Response, Depends
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from dotenv import load_dotenv
import requests

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")
ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# ------------------------------------------------------------------
# Object Storage
# ------------------------------------------------------------------
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
APP_NAME = "ahmad-classes"
_storage_key: Optional[str] = None


def _init_storage() -> Optional[str]:
    global _storage_key
    if _storage_key:
        return _storage_key
    if not EMERGENT_LLM_KEY:
        return None
    try:
        r = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_LLM_KEY}, timeout=30)
        r.raise_for_status()
        _storage_key = r.json()["storage_key"]
        return _storage_key
    except Exception as e:
        logger.warning(f"Object storage init failed: {e}")
        return None


def _put_object(path: str, data: bytes, content_type: str) -> dict:
    key = _init_storage()
    if not key:
        raise HTTPException(500, "Storage not configured")
    r = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data,
        timeout=120,
    )
    r.raise_for_status()
    return r.json()


def _get_object(path: str):
    key = _init_storage()
    if not key:
        raise HTTPException(500, "Storage not configured")
    r = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if r.status_code == 500:
        raise HTTPException(404, "File not found")
    r.raise_for_status()
    return r.content, r.headers.get("Content-Type", "application/octet-stream")


# ------------------------------------------------------------------
# Models
# ------------------------------------------------------------------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class StudentLoginIn(BaseModel):
    name: str
    student_id: str


class AdminLoginIn(BaseModel):
    username: str
    password: str


class User(BaseModel):
    id: str
    name: str
    student_id: Optional[str] = None
    role: str  # "student" | "admin"
    enrolled_batches: List[str] = []


class Batch(BaseModel):
    id: str
    title: str
    subject: str
    description: str
    price: int
    duration_weeks: int
    lessons: int
    instructor: str
    hero_image: str
    created_at: str


class BatchCreate(BaseModel):
    title: str
    subject: str
    description: str
    price: int
    duration_weeks: int = 12
    lessons: int = 30
    instructor: str = "Ahmad Sir"
    hero_image: str = ""


class PurchaseIn(BaseModel):
    user_id: str


class LiveClass(BaseModel):
    id: str
    title: str
    subject: str
    youtube_url: str
    started_at: str
    ended_at: Optional[str] = None
    is_live: bool
    batch_id: Optional[str] = None


class LiveStartIn(BaseModel):
    title: str
    subject: str
    youtube_url: str
    batch_id: Optional[str] = None


class Poll(BaseModel):
    id: str
    live_id: Optional[str] = None
    question: str
    options: List[str]
    votes: List[int]
    is_open: bool
    created_at: str


class PollCreate(BaseModel):
    question: str
    options: List[str]
    live_id: Optional[str] = None


class VoteIn(BaseModel):
    user_id: str
    option_index: int


class ChatMessageIn(BaseModel):
    user_id: str
    user_name: str
    message: str
    live_id: Optional[str] = None


class Quiz(BaseModel):
    id: str
    title: str
    subject: str
    duration_seconds: int
    questions: List[dict]  # {q, options:[...], correct_index}
    created_at: str


class QuizCreate(BaseModel):
    title: str
    subject: str
    duration_seconds: int = 300
    questions: List[dict]


class QuizSubmitIn(BaseModel):
    user_id: str
    answers: List[int]


class Note(BaseModel):
    id: str
    title: str
    subject: str
    kind: str  # "pdf" | "video"
    storage_path: str
    thumbnail: Optional[str] = None
    uploaded_at: str


class AIChatIn(BaseModel):
    session_id: str
    message: str


class AnalyzeIn(BaseModel):
    session_id: str
    note_id: str
    question: str = "Please summarize this document and highlight the key concepts."


# ------------------------------------------------------------------
# Auth
# ------------------------------------------------------------------
@api_router.post("/auth/student-login", response_model=User)
async def student_login(body: StudentLoginIn):
    existing = await db.users.find_one({"student_id": body.student_id, "role": "student"}, {"_id": 0})
    if existing:
        return User(**existing)
    user = User(id=str(uuid.uuid4()), name=body.name, student_id=body.student_id, role="student").dict()
    await db.users.insert_one(user)
    user.pop("_id", None)
    return User(**user)


@api_router.post("/auth/admin-login", response_model=User)
async def admin_login(body: AdminLoginIn):
    if body.username != ADMIN_USERNAME or body.password != ADMIN_PASSWORD:
        raise HTTPException(401, "Invalid admin credentials")
    admin = await db.users.find_one({"role": "admin"}, {"_id": 0})
    if not admin:
        admin = User(id=str(uuid.uuid4()), name="Ahmad Sir (Admin)", role="admin").dict()
        await db.users.insert_one(admin)
        admin.pop("_id", None)
    return User(**admin)


@api_router.get("/users/{user_id}", response_model=User)
async def get_user(user_id: str):
    u = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not u:
        raise HTTPException(404, "User not found")
    return User(**u)


# ------------------------------------------------------------------
# Batches
# ------------------------------------------------------------------
@api_router.get("/batches", response_model=List[Batch])
async def list_batches():
    items = await db.batches.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [Batch(**b) for b in items]


@api_router.get("/batches/{batch_id}", response_model=Batch)
async def get_batch(batch_id: str):
    b = await db.batches.find_one({"id": batch_id}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Batch not found")
    return Batch(**b)


@api_router.post("/batches", response_model=Batch)
async def create_batch(body: BatchCreate):
    batch = Batch(
        id=str(uuid.uuid4()),
        created_at=now_iso(),
        **body.dict(),
    ).dict()
    if not batch["hero_image"]:
        batch["hero_image"] = "https://images.pexels.com/photos/7548729/pexels-photo-7548729.jpeg"
    await db.batches.insert_one(batch)
    batch.pop("_id", None)
    return Batch(**batch)


@api_router.post("/batches/{batch_id}/purchase")
async def purchase_batch(batch_id: str, body: PurchaseIn):
    b = await db.batches.find_one({"id": batch_id}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Batch not found")
    await db.users.update_one({"id": body.user_id}, {"$addToSet": {"enrolled_batches": batch_id}})
    return {"success": True, "message": f"Enrolled in {b['title']}"}


@api_router.get("/users/{user_id}/batches", response_model=List[Batch])
async def user_batches(user_id: str):
    u = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not u:
        return []
    ids = u.get("enrolled_batches", [])
    items = await db.batches.find({"id": {"$in": ids}}, {"_id": 0}).to_list(200)
    return [Batch(**b) for b in items]


# ------------------------------------------------------------------
# Live class + Polls + Chat
# ------------------------------------------------------------------
@api_router.get("/live/current")
async def current_live():
    live = await db.live_classes.find_one({"is_live": True}, {"_id": 0}, sort=[("started_at", -1)])
    return live or None


@api_router.post("/live/start", response_model=LiveClass)
async def start_live(body: LiveStartIn):
    await db.live_classes.update_many({"is_live": True}, {"$set": {"is_live": False, "ended_at": now_iso()}})
    live = LiveClass(
        id=str(uuid.uuid4()),
        started_at=now_iso(),
        is_live=True,
        **body.dict(),
    ).dict()
    await db.live_classes.insert_one(live)
    live.pop("_id", None)
    return LiveClass(**live)


@api_router.post("/live/{live_id}/end")
async def end_live(live_id: str):
    live = await db.live_classes.find_one({"id": live_id}, {"_id": 0})
    if not live:
        raise HTTPException(404, "Live class not found")
    await db.live_classes.update_one({"id": live_id}, {"$set": {"is_live": False, "ended_at": now_iso()}})
    # Save as recorded
    note = Note(
        id=str(uuid.uuid4()),
        title=live["title"],
        subject=live["subject"],
        kind="video",
        storage_path=live["youtube_url"],  # store URL for recorded youtube video
        thumbnail="https://images.pexels.com/photos/5905902/pexels-photo-5905902.jpeg",
        uploaded_at=now_iso(),
    ).dict()
    await db.notes.insert_one(note)
    return {"success": True, "recorded_note_id": note["id"]}


@api_router.post("/polls", response_model=Poll)
async def create_poll(body: PollCreate):
    p = Poll(
        id=str(uuid.uuid4()),
        question=body.question,
        options=body.options,
        votes=[0] * len(body.options),
        is_open=True,
        live_id=body.live_id,
        created_at=now_iso(),
    ).dict()
    await db.polls.insert_one(p)
    p.pop("_id", None)
    return Poll(**p)


@api_router.get("/polls/current")
async def current_poll():
    p = await db.polls.find_one({"is_open": True}, {"_id": 0}, sort=[("created_at", -1)])
    return p or None


@api_router.post("/polls/{poll_id}/vote", response_model=Poll)
async def vote_poll(poll_id: str, body: VoteIn):
    p = await db.polls.find_one({"id": poll_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Poll not found")
    if not p["is_open"]:
        raise HTTPException(400, "Poll closed")
    if body.option_index < 0 or body.option_index >= len(p["options"]):
        raise HTTPException(400, "Invalid option")
    # Prevent double voting
    existing = await db.poll_votes.find_one({"poll_id": poll_id, "user_id": body.user_id})
    if existing:
        raise HTTPException(400, "Already voted")
    await db.poll_votes.insert_one({"poll_id": poll_id, "user_id": body.user_id, "option": body.option_index})
    p["votes"][body.option_index] += 1
    await db.polls.update_one({"id": poll_id}, {"$set": {"votes": p["votes"]}})
    return Poll(**p)


@api_router.post("/polls/{poll_id}/close", response_model=Poll)
async def close_poll(poll_id: str):
    p = await db.polls.find_one({"id": poll_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Poll not found")
    await db.polls.update_one({"id": poll_id}, {"$set": {"is_open": False}})
    p["is_open"] = False
    return Poll(**p)


@api_router.post("/chat")
async def post_chat(body: ChatMessageIn):
    msg = {
        "id": str(uuid.uuid4()),
        "user_id": body.user_id,
        "user_name": body.user_name,
        "message": body.message,
        "live_id": body.live_id,
        "created_at": now_iso(),
    }
    await db.chat_messages.insert_one(msg)
    msg.pop("_id", None)
    return msg


@api_router.get("/chat")
async def list_chat(live_id: Optional[str] = None, limit: int = 50):
    q = {"live_id": live_id} if live_id else {}
    items = await db.chat_messages.find(q, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return list(reversed(items))


# ------------------------------------------------------------------
# Notes / Files
# ------------------------------------------------------------------
@api_router.get("/notes", response_model=List[Note])
async def list_notes(subject: Optional[str] = None, kind: Optional[str] = None):
    q: dict = {}
    if subject:
        q["subject"] = subject
    if kind:
        q["kind"] = kind
    items = await db.notes.find(q, {"_id": 0}).sort("uploaded_at", -1).to_list(500)
    return [Note(**n) for n in items]


@api_router.get("/notes/{note_id}", response_model=Note)
async def get_note(note_id: str):
    n = await db.notes.find_one({"id": note_id}, {"_id": 0})
    if not n:
        raise HTTPException(404, "Note not found")
    return Note(**n)


@api_router.post("/upload", response_model=Note)
async def upload_note(
    file: UploadFile = File(...),
    title: str = Form(...),
    subject: str = Form(...),
    kind: str = Form("pdf"),
):
    data = await file.read()
    ext = (file.filename or "file.bin").rsplit(".", 1)[-1].lower()
    path = f"{APP_NAME}/uploads/admin/{uuid.uuid4()}.{ext}"
    content_type = file.content_type or ("application/pdf" if ext == "pdf" else "application/octet-stream")
    await run_in_threadpool(_put_object, path, data, content_type)
    note = Note(
        id=str(uuid.uuid4()),
        title=title,
        subject=subject,
        kind=kind,
        storage_path=path,
        uploaded_at=now_iso(),
    ).dict()
    await db.notes.insert_one(note)
    note.pop("_id", None)
    return Note(**note)


@api_router.get("/files/{path:path}")
async def get_file(path: str):
    content, content_type = await run_in_threadpool(_get_object, path)
    return Response(content=content, media_type=content_type)


# ------------------------------------------------------------------
# Quizzes
# ------------------------------------------------------------------
@api_router.get("/quizzes", response_model=List[Quiz])
async def list_quizzes():
    items = await db.quizzes.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [Quiz(**q) for q in items]


@api_router.get("/quizzes/{quiz_id}", response_model=Quiz)
async def get_quiz(quiz_id: str):
    q = await db.quizzes.find_one({"id": quiz_id}, {"_id": 0})
    if not q:
        raise HTTPException(404, "Quiz not found")
    return Quiz(**q)


@api_router.post("/quizzes", response_model=Quiz)
async def create_quiz(body: QuizCreate):
    q = Quiz(
        id=str(uuid.uuid4()),
        created_at=now_iso(),
        **body.dict(),
    ).dict()
    await db.quizzes.insert_one(q)
    q.pop("_id", None)
    return Quiz(**q)


@api_router.post("/quizzes/{quiz_id}/submit")
async def submit_quiz(quiz_id: str, body: QuizSubmitIn):
    q = await db.quizzes.find_one({"id": quiz_id}, {"_id": 0})
    if not q:
        raise HTTPException(404, "Quiz not found")
    correct = 0
    for i, question in enumerate(q["questions"]):
        if i < len(body.answers) and body.answers[i] == question.get("correct_index"):
            correct += 1
    total = len(q["questions"])
    score = round((correct / total) * 100) if total else 0
    record = {
        "id": str(uuid.uuid4()),
        "quiz_id": quiz_id,
        "user_id": body.user_id,
        "answers": body.answers,
        "correct": correct,
        "total": total,
        "score": score,
        "submitted_at": now_iso(),
    }
    await db.quiz_submissions.insert_one(record)
    record.pop("_id", None)
    return record


@api_router.get("/users/{user_id}/quiz-scores")
async def user_scores(user_id: str):
    items = await db.quiz_submissions.find({"user_id": user_id}, {"_id": 0}).sort("submitted_at", -1).to_list(200)
    return items


# ------------------------------------------------------------------
# AI Tutor + File Analysis
# ------------------------------------------------------------------
async def _stream_gemini(session_id: str, message: str, file_path: Optional[str] = None, mime: Optional[str] = None):
    from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone, FileContentWithMimeType

    system = (
        "You are Ahmad Classes AI Tutor: an expert coach for classes 9-12 (Physics, Chemistry, Maths, "
        "Biology, English). Explain step-by-step, use simple language and examples, use markdown when helpful. "
        "If asked something outside academics, gently steer back to studies."
    )
    chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=session_id, system_message=system).with_model(
        "gemini", "gemini-3-flash-preview"
    )

    files = []
    if file_path and mime:
        files.append(FileContentWithMimeType(file_path=file_path, mime_type=mime))

    async for ev in chat.stream_message(UserMessage(text=message, file_contents=files) if files else UserMessage(text=message)):
        if isinstance(ev, TextDelta):
            yield ev.content
        elif isinstance(ev, StreamDone):
            break


@api_router.post("/ai/chat")
async def ai_chat(body: AIChatIn):
    async def gen():
        async for token in _stream_gemini(body.session_id, body.message):
            yield token

    return StreamingResponse(
        gen(),
        media_type="text/plain",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@api_router.post("/ai/analyze")
async def ai_analyze(body: AnalyzeIn):
    note = await db.notes.find_one({"id": body.note_id}, {"_id": 0})
    if not note:
        raise HTTPException(404, "Note not found")
    if note["kind"] != "pdf":
        raise HTTPException(400, "Only PDF notes can be analyzed")

    # Fetch bytes from storage and save to temp file
    content, mime = await run_in_threadpool(_get_object, note["storage_path"])
    tmp = Path(f"/tmp/{uuid.uuid4()}.pdf")
    tmp.write_bytes(content)

    async def gen():
        try:
            async for token in _stream_gemini(body.session_id, body.question, str(tmp), "application/pdf"):
                yield token
        finally:
            try:
                tmp.unlink()
            except Exception:
                pass

    return StreamingResponse(
        gen(),
        media_type="text/plain",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ------------------------------------------------------------------
# Admin analytics
# ------------------------------------------------------------------
@api_router.get("/admin/analytics")
async def admin_analytics():
    students = await db.users.count_documents({"role": "student"})
    batches = await db.batches.count_documents({})
    quizzes = await db.quizzes.count_documents({})
    submissions = await db.quiz_submissions.count_documents({})
    live_active = await db.live_classes.count_documents({"is_live": True})
    notes = await db.notes.count_documents({})
    return {
        "students": students,
        "batches": batches,
        "quizzes": quizzes,
        "submissions": submissions,
        "live_active": live_active,
        "notes": notes,
    }


# ------------------------------------------------------------------
# Seed
# ------------------------------------------------------------------
async def seed():
    if await db.batches.count_documents({}) == 0:
        seed_batches = [
            {
                "title": "Class 12 Physics Booster",
                "subject": "Physics",
                "description": "Complete class 12 physics with numericals, past papers, and live doubt sessions.",
                "price": 2999,
                "duration_weeks": 24,
                "lessons": 60,
                "instructor": "Ahmad Sir",
                "hero_image": "https://images.unsplash.com/photo-1635372722656-389f87a941b7?q=85&w=1400",
            },
            {
                "title": "Chemistry Foundation 11-12",
                "subject": "Chemistry",
                "description": "Organic, Inorganic, Physical chemistry — mastered with concept maps and formula sheets.",
                "price": 2499,
                "duration_weeks": 20,
                "lessons": 45,
                "instructor": "Sara Ma'am",
                "hero_image": "https://images.pexels.com/photos/2280571/pexels-photo-2280571.jpeg",
            },
            {
                "title": "Maths Crash Course",
                "subject": "Maths",
                "description": "Calculus + Algebra crash course with 200+ solved problems.",
                "price": 1999,
                "duration_weeks": 8,
                "lessons": 25,
                "instructor": "Bilal Sir",
                "hero_image": "https://images.pexels.com/photos/6238297/pexels-photo-6238297.jpeg",
            },
        ]
        for b in seed_batches:
            batch = Batch(id=str(uuid.uuid4()), created_at=now_iso(), **b).dict()
            await db.batches.insert_one(batch)
        logger.info("Seeded batches")

    if await db.quizzes.count_documents({}) == 0:
        quizzes = [
            {
                "title": "Physics — Laws of Motion",
                "subject": "Physics",
                "duration_seconds": 300,
                "questions": [
                    {"q": "Which law defines force?", "options": ["First law", "Second law", "Third law", "Zeroth law"], "correct_index": 1},
                    {"q": "SI unit of force?", "options": ["Joule", "Newton", "Watt", "Pascal"], "correct_index": 1},
                    {"q": "Action and reaction are ___", "options": ["Equal & same dir", "Equal & opposite", "Unequal", "None"], "correct_index": 1},
                    {"q": "Inertia depends on ___", "options": ["Mass", "Volume", "Colour", "Shape"], "correct_index": 0},
                    {"q": "Momentum = ?", "options": ["m/v", "mv", "m+v", "m-v"], "correct_index": 1},
                ],
            },
            {
                "title": "Chemistry — Periodic Table",
                "subject": "Chemistry",
                "duration_seconds": 240,
                "questions": [
                    {"q": "How many periods in modern periodic table?", "options": ["5", "6", "7", "8"], "correct_index": 2},
                    {"q": "Lightest element?", "options": ["Helium", "Hydrogen", "Lithium", "Oxygen"], "correct_index": 1},
                    {"q": "Symbol of Sodium?", "options": ["So", "Na", "Sd", "N"], "correct_index": 1},
                    {"q": "Noble gas?", "options": ["N2", "O2", "Ne", "Cl"], "correct_index": 2},
                ],
            },
        ]
        for q in quizzes:
            quiz = Quiz(id=str(uuid.uuid4()), created_at=now_iso(), **q).dict()
            await db.quizzes.insert_one(quiz)
        logger.info("Seeded quizzes")

    if await db.notes.count_documents({}) == 0:
        # Seed some recorded videos + placeholder external PDFs (no upload)
        starter = [
            {"title": "Physics — Newton's Laws (Full Lecture)", "subject": "Physics", "kind": "video",
             "storage_path": "https://www.youtube.com/watch?v=kKKM8Y-u7ds",
             "thumbnail": "https://images.pexels.com/photos/5905902/pexels-photo-5905902.jpeg"},
            {"title": "Maths — Calculus Crash Course", "subject": "Maths", "kind": "video",
             "storage_path": "https://www.youtube.com/watch?v=WUvTyaaNkzM",
             "thumbnail": "https://images.pexels.com/photos/6238297/pexels-photo-6238297.jpeg"},
            {"title": "Chemistry — Periodic Table Notes", "subject": "Chemistry", "kind": "pdf",
             "storage_path": "https://www.africau.edu/images/default/sample.pdf",
             "thumbnail": "https://images.pexels.com/photos/2280571/pexels-photo-2280571.jpeg"},
            {"title": "Biology — Human Digestive System", "subject": "Biology", "kind": "pdf",
             "storage_path": "https://www.africau.edu/images/default/sample.pdf",
             "thumbnail": "https://images.pexels.com/photos/8386440/pexels-photo-8386440.jpeg"},
        ]
        for n in starter:
            note = Note(id=str(uuid.uuid4()), uploaded_at=now_iso(), **n).dict()
            await db.notes.insert_one(note)
        logger.info("Seeded notes")


@app.on_event("startup")
async def on_startup():
    await seed()
    # Object storage init (best effort)
    await run_in_threadpool(_init_storage)


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


# health
@api_router.get("/")
async def root():
    return {"ok": True, "app": "Ahmad Classes"}


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

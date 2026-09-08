# Ahmad Classes — Mobile Coaching App (PRD)

## Product
"Ahmad Classes" is a smart mobile coaching institute app for classes 9-12 (Physics, Chemistry, Maths, Biology, English). Students attend live YouTube-embedded classes with real-time polls and chat, buy paid batches, take timed quizzes, and use an AI Tutor (Gemini 3 Flash) that can also analyse uploaded PDF notes. Admins manage everything from a control-center dashboard.

## Roles
- **Student** — logs in with Full Name + Student ID (auto-creates account).
- **Admin** — logs in with username/password (default `admin` / `admin123`).

## Core Flows Implemented (MVP)
### Student
1. Login → home dashboard (upcoming live, my batches, recent quiz scores, quick actions, AI FAB).
2. Classes tab — toggle Videos / Notes, filter by subject; recorded videos and PDF notes open in system browser.
3. Quizzes tab — timed MCQ quiz with progress bar, per-question haptics, result screen with score.
4. Batches tab — marketplace of paid batches with hero + gradient scrim; batch detail with perks and Buy button (mock payment).
5. Live class screen — YouTube WebView player, live discussion chat (polling every 4s), and live poll modal.
6. AI Tutor — streaming chat with Gemini 3 flash preview. "Analyze" mode attaches a PDF note for the AI to summarize.

### Admin
1. Dashboard — analytics grid (students, batches, quizzes, submissions, live active, notes) + quick actions.
2. Live tab — Start / End live class (End auto-saves as recorded video note). Launch and close live polls.
3. Content tab — Upload PDFs / videos to Emergent Object Storage; create timed multi-question quizzes.
4. Batches tab — Create batches; browse existing batches.

## Integrations
- **Emergent LLM key** — Gemini 3 flash preview via `emergentintegrations` for AI Tutor chat and PDF analysis (streaming SSE).
- **Emergent Object Storage** — permanent storage for uploaded notes and videos.

## Tech
- Backend: FastAPI + Motor (MongoDB), routes under `/api/*`.
- Frontend: Expo Router with file-based routes, `(student)` and `(admin)` tab groups.
- Design tokens: `/app/frontend/src/theme.ts` filled from `/app/design_guidelines.json` (Emerald + Rose palette).

## Data Models (MongoDB collections)
- `users`, `batches`, `live_classes`, `polls`, `poll_votes`, `chat_messages`, `notes`, `quizzes`, `quiz_submissions`.

## Notes / Known Limits
- Payment is mocked — real Stripe/Razorpay can be added later.
- Live class discussion uses 4s polling instead of websockets.
- Poll shown to students via full-screen modal from `polls/current`.

## Iteration 3 — Admin Console Fix (Jun 2026)
- Bug: admin saw no feedback on batch create / notes / video upload (RN `Alert.alert` is a no-op on web) → looked broken.
- Fix: `src/utils/notify.ts` (cross-platform alert/confirm), inline success/error banners, saving spinners.
- Upload now via axios with progress bar; 10-min timeout for videos; Library list with delete on Content tab.
- Batches tab shows list with delete. Dashboard "Create Quiz" deep-link (`?tab=quiz`) now honored.
- New endpoints: `DELETE /api/batches/{id}`, `DELETE /api/notes/{id}`.
- Tests: backend/tests/test_admin_console.py (6 pass), test_reports/iteration_3.json (13/13 frontend pass).

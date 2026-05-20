# AI‑First CRM — Prototype

A minimal end‑to‑end prototype implementing the HCP interaction logging flow described in
`AI_First_CRM_HCP_Architecture.md`. It includes a React + Vite frontend, a FastAPI backend,
an optional async MySQL persistence layer, and a lightweight AI adapter for extracting
structured fields from free‑text notes.

Contents
 - Frontend: `frontend/` — React + Vite UI (Log Interaction page)
 - Backend: `backend/` — FastAPI app, AI adapter, DB models

Key features
 - Streamed assistant responses (NDJSON streaming endpoint)
 - Deterministic local extractor with LLM fallback (OpenRouter/OpenAI)
 - Optional async MySQL persistence (aiomysql) with SQLite fallback for local dev
 - Non‑destructive follow‑up merging (preserves existing topics, appends attendees)

Prerequisites
 - Node.js (16+), npm
 - Python 3.11+ and virtualenv
 - Optional: MySQL server for persistent storage

Quickstart (local development)

1. Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1    # PowerShell
pip install -r requirements.txt
# (optional) set environment variables or create backend/.env
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

2. Frontend

```bash
cd frontend
npm install
npm run dev
# Open http://localhost:5173
```

Development notes
 - The Vite dev server proxies `/api/*` to the backend (see frontend/vite config).
 - Backend uses async SQLAlchemy; if `DATABASE_URL` is not set it will fall back to `sqlite+aiosqlite:///./aivoa.db`.

Configuration / Environment
 - `DATABASE_URL` — SQLAlchemy URL (e.g. `mysql+aiomysql://user:pw@host:3306/dbname`).
 - `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` — to enable OpenRouter LLM streaming.
 - `OPENAI_API_KEY` — optional OpenAI fallback.
 - `OPENROUTER_SITE_URL`, `OPENROUTER_APP_NAME` — optional proxy headers.

Files of interest
 - `backend/app/ai_client.py` — AI adapter, deterministic extractor, streaming helpers
 - `backend/app/ai_routes.py` — AI endpoints (`/api/v1/ai/chat`, `/api/v1/ai/chat/stream`)
 - `backend/app/main.py` — FastAPI application and interaction create/patch endpoints
 - `backend/app/db.py`, `backend/app/models.py` — DB setup and `Interaction` model
 - `frontend/src/pages/LogInteractionPage.tsx` — assistant UI and merge logic
 - `frontend/src/components/InteractionForm.tsx` — the form bound to the draft model

Testing & debugging helpers
 - `backend/test_e2e_sequence.py` and `backend/test_extract.py` are simple scripts used
	 during development to validate the local extractor and merge behavior.

Recommended next steps
 - Add Alembic migrations and production DB setup
 - Add unit tests for `ai_client` extractors and frontend merge logic
 - Improve auth and secure API endpoints
 - Render `next_steps` in the UI as a styled assistant card

Contributing
 - Fork the repo, create a branch, and send a PR with a clear description and tests.



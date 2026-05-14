# LastMinuteLegends

AI fitness coach — HeyGen Hackathon.

This branch (`integration-live-agent`) wires the three streams together:

- **Stream 1 (Aadya, external)** — pose-extraction WebSocket at
  `wss://4020-104-7-12-185.ngrok-free.app/stream` (override via
  `NEXT_PUBLIC_POSE_WS_URL`)
- **Stream 2 (Luke, this repo)** — FastAPI orchestrator in `orchestrator.py`
  on `:8001`. Calls Claude for critiques, persists sessions in SQLite,
  drives the LiveAvatar (HeyGen) speech injection
- **Stream 3 (this repo)** — Next.js 14 frontend on `:3000`. Owns
  onboarding, dashboard, the live workout view, and the LiveKit-based
  HeyGen avatar embed

## Run it

You need both services up at the same time. Env keys live in `.env`
(Python — read by `python-dotenv`) and `.env.local` (Next.js — read by
the framework). Neither file is committed.

### 1. Set env keys

```env
# .env.local (Next.js)
NEXT_PUBLIC_POSE_WS_URL=wss://4020-104-7-12-185.ngrok-free.app/stream
LLM_ORCHESTRATOR_URL=http://localhost:8001
HEYGEN_API_KEY=<your liveavatar key>

# .env (Python — same dir, used by orchestrator.py)
ANTHROPIC_API_KEY=<your anthropic key>
HEYGEN_API_KEY=<your liveavatar key>
LIVEAVATAR_DRY_RUN=true   # set to false to actually drive the avatar
DATABASE_URL=./db/fitness.sqlite
```

### 2. Start Luke's orchestrator (terminal A)

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn orchestrator:app --port 8001
```

### 3. Start the frontend (terminal B)

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. First load redirects to `/onboarding`. Finish
the wizard — the frontend POSTs the UserProfile to Luke's `/onboarding`
endpoint so subsequent critique calls find the user. Then click "Start
workout" to see the live agent in action.

## Architecture (request path)

```
Browser camera ──JPEG frames──► ws://Aadya:8000/stream  (Stream 1)
                                              │
                                       ContextBatch
                                              │
                  ┌───────────────────────────┘
                  ▼
        Stream 3 frontend
                  │
        POST /api/critique (Next.js proxy)
                  │
                  ▼
        FastAPI :8001 /analyze?user_id=…  (Stream 2)
                  │
            Claude critique +
       LiveAvatar agent-control commands
                  │
                  ▼
        {analyzed | buffered}  →  back through proxy as a Critique
                  │
                  ▼
        /workout transcript + HeyGenAvatar speak prop
```

The `HeyGenAvatar` component subscribes to the LiveKit room directly using
the credentials minted via `/api/avatar/session` (which calls LiveAvatar's
REST API server-side). Speech commands (`avatar.speak_text`,
`avatar.interrupt`) are published on the `agent-control` data topic;
status events (`avatar.speak_started`, `avatar.speak_ended`) come back on
`agent-response`.

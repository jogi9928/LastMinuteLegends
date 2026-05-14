# CONTEXT.md — Stream 2 API Reference

## CV Input Schema (from Stream 1)

Stream 1 emits a `ContextBatch` every ~2s. See [README.md](README.md) for the
full schema. Top-level shape:

```json
{
  "exercise": "squat",
  "timestamp": 1715000000.0,
  "window_seconds": 1.97,
  "frame_count": 59,
  "keypoints_sequence": [ /* per-frame COCO-17 keypoints, normalised x/y/conf */ ],
  "sampled_images": ["<base64 JPEG with skeleton overlay>", "..."],
  "batch_index": 3
}
```

We pass `sampled_images` as Anthropic image blocks and a downsampled slice of
`keypoints_sequence` as a text block — Claude analyses motion multimodally
instead of relying on pre-computed metrics.

## Critique Cadence

Stream 1 emits a batch every ~2s — calling Claude on every batch is too noisy
and expensive. Orchestrator buffers per `user_id`:
- Accumulate 2 ContextBatches (~4s of motion)
- Fire one Claude call with both batches
- Idle ~4.5s before processing the next pair

Responses from `POST /analyze`:
- `200 OK` with full output schema when a Claude call fires
- `200 OK` with `{"status": "buffered", "pending_batches": n, ...}` while the
  batch is queued but the flush threshold / idle window has not been hit

## UserProfile (from Stream 4 onboarding)
```ts
type UserProfile = {
  goal: "aesthetics" | "strength" | "general_fitness";
  avatar: "male" | "female";
  experience: { years: number; intensity: "beginner" | "intermediate" | "advanced" };
  age: number;
  injuries: string[];
  equipment: "full_gym" | "home_setup" | "dumbbells" | "bodyweight";
  frequency_per_week: number;
  baseline: { weight: number; height: number };
}
```

Stream 4 POSTs this shape on onboarding complete; we persist it into the `users` table (see SQLite Schema below). Field mapping on insert:
- `goal` → `goals` column
- `frequency_per_week` → `frequency` column
- `experience` (nested object) → `experience` TEXT column, JSON-serialized
- `injuries` (array) → `injuries` TEXT column, JSON-serialized
- `baseline.weight` → `weight`, `baseline.height` → `height`
- `avatar`, `age`, `equipment` map 1:1

## Output Schema (to Stream 3 frontend)
### Analyzed response (Claude actually ran)

```json
{
  "status": "analyzed",
  "session_id": "uuid",
  "critique": {
    "summary": "string",
    "positives": ["string"],
    "fixes": [{ "cue": "string", "priority": 1 }]
  },
  "avatar_injected": true,
  "avatar_payloads": [
    { "event": "avatar.interrupt" },
    { "event": "avatar.speak_text", "text": "<top priority-1 cue>" }
  ],
  "memory_snapshot": {
    "recurring_issues": ["string"],
    "trend": "improving | regressing | stable"
  }
}
```

`avatar_payloads` is populated only when at least one fix has `priority == 1`.
In DRY-RUN (default), the payloads are returned for inspection but NOT sent to
LiveAvatar. In LIVE (`LIVEAVATAR_DRY_RUN=false`), the same payloads are pushed
on the agent-control WS topic and `avatar_payloads` mirrors what was sent.

### Buffered response (batch queued, no Claude call yet)

```json
{
  "status": "buffered",
  "pending_batches": 1,
  "seconds_until_ready": 0.0
}
```

The second batch in a pair (and any batch arriving after the 4.5s idle window
has elapsed) returns the analyzed shape above instead.

## LiveAvatar FULL Mode

API base: https://api.liveavatar.com
Auth: X-API-KEY header
Mode: FULL — user converses with avatar + backend injects form critiques
Cost: 2 credits/minute
Docs: https://docs.liveavatar.com/docs/full-mode/events

Session flow:
1. POST /v1/sessions/token — body: {mode: "FULL", avatar_id, avatar_persona: {voice_id, context_id, language: "en"}}
2. POST /v1/sessions/start — returns livekit_url + livekit_client_token
3. Pass livekit credentials to frontend (Stream 3)

Backend WebSocket — agent-control topic commands:
- avatar.interrupt — stops current avatar speech immediately
- avatar.speak_text {"text": "..."} — avatar speaks this text directly
- avatar.speak_response {"text": "..."} — avatar generates LLM response to text
- avatar.start_listening / avatar.stop_listening — toggle listening state

Backend WebSocket — agent-response topic events to listen for:
- user.transcription {"text": "..."} — what the user said
- avatar.speak_started / avatar.speak_ended — avatar speaking state
- session.stopped {"end_reason": "..."} — session ended

Critique injection pattern:
  if form_flaw detected AND priority == HIGH:
      send avatar.interrupt
      send avatar.speak_text {"text": critique_text}
  else:
      skip — do not interrupt conversation for low priority issues

Install agent skills before building:
npx skills add heygen-com/liveavatar-agent-skills

## Running Locally

Stream 1's MoveNet backend binds `:8000` by convention, so our orchestrator
runs on a different port:

```powershell
$env:LIVEAVATAR_DRY_RUN = 'true'
.venv\Scripts\python.exe -m uvicorn orchestrator:app --port 8001
```

`.env` is auto-loaded by `orchestrator.py` via `python-dotenv` (no manual
`Set-Item env:` dance needed).

## Test Bridge — `scripts/bridge_client.py`

Until Stream 3's frontend exists, `scripts/bridge_client.py` plays the
frontend's role: opens the webcam, connects to MoveNet at
`ws://localhost:8000/stream`, streams JPEG frames, and forwards every received
`ContextBatch` to `http://127.0.0.1:8001/analyze`. Press `Q` in the preview
window to quit. Validated end-to-end on real squat data — multimodal critique
runs, priority-1 cues fire the dry-run `avatar.interrupt + avatar.speak_text`
payload pair correctly.

## Claude Call — Robustness Notes

`src/llm/critique.py` uses an assistant-prefill (`"{"`) to force the response
to start as JSON, and a tolerant parser that:
1. Strips markdown fences (` ```json ... ``` `).
2. Falls back to slicing the first balanced `{...}` block out of any prose.
3. Returns a safe priority-3 critique with `_parse_error: true` if all
   parse attempts fail — `/analyze` never 500s on a malformed model response.

Discovered during real-data smoke testing: Haiku occasionally returns
prose-wrapped JSON for sparse keypoint batches. The prefill + fallback
chain handles both cases cleanly.

## FastAPI Endpoint

```python
# orchestrator.py
from fastapi import FastAPI
app = FastAPI()

@app.post("/analyze")
async def analyze(batch: ContextBatch, user_id: str):
    # 1. Append batch to per-user buffer
    # 2. If buffer < 2 or idle window not elapsed → return {"status": "buffered"}
    # 3. Otherwise flush 2 batches, load profile + memory, run multimodal critique
    # 4. If any fix has priority == 1, inject via LiveAvatar agent-control WS
    # 5. Write session to SQLite, return output schema (includes avatar_injected)
    ...
```

**Route:** `POST /analyze`  
**Request:** CV JSON + `user_id` query param  
**Response:** Output schema above

Use `claude-haiku-3-5` during dev, swap to `claude-sonnet-4-20250514` for demo.

## SQLite Schema

```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    goals TEXT, avatar TEXT, experience TEXT,
    age INTEGER, injuries TEXT, equipment TEXT,
    frequency INTEGER, weight REAL, height REAL
);

CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT, exercise TEXT, timestamp TEXT,
    reps INTEGER, depth_degrees REAL,
    knee_valgus_score REAL, tempo_eccentric_sec REAL,
    asymmetry_score REAL, critique_summary TEXT
);

CREATE TABLE form_issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT, issue_type TEXT,
    severity REAL, description TEXT
);
```

**Note (post-ContextBatch pivot):** Raw metric columns (`reps`, `depth_degrees`,
`knee_valgus_score`, `tempo_eccentric_sec`, `asymmetry_score`) are now NULL —
those metrics are no longer computed on the wire. `form_issues.description`
is populated from Claude's `fixes[].cue` strings via `_classify_issue`. Schema
left stable to avoid a mid-build migration.

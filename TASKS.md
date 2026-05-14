# Stream 2 Tasks — LLM Critique + Agent Orchestration

## Hour 0–1: Lock Contracts (BLOCKER FOR EVERYONE)
- [ ] Confirm CV JSON input schema with Aadya
- [ ] Share output JSON schema with Ansh (he needs avatar_video_url for his placeholder)
- [ ] Share users table schema + UserProfile shape with Ansh + Stream 4 so they know what to POST on onboarding complete
- [ ] Create `mocks/cv_output.json` with realistic mock data
- [ ] Branch off: `git checkout -b stream-2-llm`

## Hour 1–2: LLM Critique Pipeline
- [x] Set up project structure + `requirements.txt`
      (anthropic, httpx, fastapi, uvicorn)
- [x] `src/llm/critique.py` — Claude API call, CV JSON + user profile as input
- [x] Prompt: structured output (positives, fixes with priority, summary)
- [x] Test against `mocks/cv_output.json`, verify output matches schema
- [x] Handle low-confidence CV input (fallback to general encouragement)

## Hour 2–3: LiveAvatar FULL Mode Pipeline (DRY-RUN first, LIVE at final smoke test)
Critique pipeline already consumes ContextBatch multimodally; orchestrator
buffers 2 batches + 4.5s idle window per user. Build the LiveAvatar layer in
**dry-run mode** for now — emit the exact payloads we'd send, but do NOT
open the WebSocket or hit `/v1/sessions/*`. The live call only happens at
the Hour 5–6 final smoke test.

- [x] Run: npx skills add heygen-com/liveavatar-agent-skills
- [x] `src/avatar/liveavatar.py` — dry-run-first
      - Build the payload helpers but gate the network calls behind
        `LIVEAVATAR_DRY_RUN` env var (default `"true"`)
      - `inject_critique(text)` should:
          - Construct the two payloads:
              `{"event": "avatar.interrupt"}`
              `{"event": "avatar.speak_text", "text": <critique_text>}`
          - If `DRY_RUN`: print + return them, no network I/O
          - If `DRY_RUN=false`: send them on the agent-control WS
      - Also implement (but do NOT call yet) POST /v1/sessions/token,
        POST /v1/sessions/start, the agent-control WS connect, and the
        agent-response listener — they're needed for the final smoke test
- [x] In `orchestrator.py /analyze`, replace the `avatar_injected = False`
      stub with a call to `liveavatar.inject_critique(...)` when any
      `critique["fixes"][*]["priority"] == 1`. Include the returned dry-run
      payloads in the response under an `avatar_payloads` field so they're
      visible for testing.
- [x] Dry-run test against `mocks/cv_output.json`:
      POST it twice to /analyze (each call buffers; second triggers the
      flush) and verify the response contains the critique JSON and the
      `avatar.interrupt` + `avatar.speak_text` payloads we'd emit.
- [x] Tune buffer/idle thresholds if needed
      (currently `BATCHES_PER_CALL=2`, `IDLE_WINDOW_SEC=4.5`)
- [ ] Coordinate with Ansh (Stream 3): he connects frontend to LiveKit
      using livekit_url + livekit_client_token returned from your endpoint
      (this still requires a live `/v1/sessions/start` call — defer until
      Hour 5-6 final smoke test)

## Hour 3–4: Memory Layer
- [x] `src/memory/store.py` — SQLite, create tables: users, sessions, form_issues
- [x] Write session after each critique run
- [x] Read last N sessions to build prompt context
- [x] Recurring issue detection: same flaw 2+ sessions → escalate priority

## Hour 4–5: Personalization
- [x] Wire memory + user profile (see UserProfile in CONTEXT.md) into critique prompt
- [x] Injury-aware logic: knee injury in onboarding → knee valgus flagged high priority
- [x] `src/llm/briefing.py` — pre-set cue: personalized reminder before each set

## Hour 5–6: API + Integration
- [x] `orchestrator.py` — FastAPI, POST /analyze endpoint
- [x] Coordinate endpoint URL with Stream 4
- [x] Smoke test: mock CV → critique → memory write (orchestrator end-to-end)
- [x] Dry-run smoke test: 2× `mocks/cv_output_dry.json` → /analyze → response
      shape verified (status: buffered → analyzed, critique + avatar_injected
      + avatar_payloads fields present). Priority-1 injection path verified
      separately via standalone `inject_critique` call (see
      `scripts/smoke_dry_run.py`). Real-data priority-1 path through /analyze
      will need a richer fixture (real base64 images + realistic motion)
      once Stream 1 can hand us a captured ContextBatch.
- [ ] **LIVE smoke test (final):** set `LIVEAVATAR_DRY_RUN=false`, call
      `/v1/sessions/start` for real, open the agent-control WS, run the same
      2-batch flow, and verify the avatar actually speaks the critique.
- [ ] Confirm livekit_url + livekit_client_token reach Ansh's frontend and
      avatar renders

## Stretch
- [ ] Debounce/threshold tuning for critique injection (avoid avatar talking over itself)
- [ ] Progress trend: improving / stable / regressing over last N sessions

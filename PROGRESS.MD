# Progress Log — Stream 2

<!-- Claude writes here after completing each task. Format:
## [Task Name]
- Status: done / blocked
- What was done: ...
- Decisions made: ...
- Blockers: ...
-->

## Hour 1–2: LLM Critique Pipeline
- Status: done (rewritten 2026-05-14 for multimodal ContextBatch input)
- What was done: Created `src/` package structure (llm, memory, avatar). Implemented `src/llm/critique.py` — now accepts a list of 1-2 ContextBatches (Stream 1's wire format: per-frame COCO-17 keypoints + base64 skeleton-overlay JPEGs). Builds a multimodal Anthropic message: each batch's `sampled_images` become image blocks, `keypoints_sequence` is downsampled to 8 frames per batch and joined into a text block alongside profile + memory context. Returns `{summary, positives, fixes}` matching the output schema. Low-confidence detection now triggers when total frame_count < 5.
- Decisions made: Used `claude-haiku-4-5` with vision. System prompt kept tight; data goes in the user content. Downsampling keypoints to 8 frames/batch keeps the prompt under a reasonable size while preserving motion shape. Original metric-based critique was removed — Stream 1 doesn't compute reps / depth_degrees / knee_valgus_score on the wire, so we let Claude derive form judgment from raw signals.
- Blockers: None for the rewrite. Live multimodal call not yet retested end-to-end after the rewrite — verify in the Hour 2-3 LiveAvatar build.

## Hour 2–3: LiveAvatar FULL Mode Pipeline
- Status: done (dry-run complete; LIVE mode pending final smoke test)
- What was done: Installed `heygen-com/liveavatar-agent-skills` (3 skills: debug, feedback, integrate). Implemented `src/avatar/liveavatar.py` with full FULL Mode session lifecycle (create_context, create_session_token, start_session, stop_session, keep_alive via REST), LiveKit agent-control channel sender (`_send_to_agent_control` using livekit Python SDK), agent-response listener (`_listen_agent_response`), and `inject_critique(text)` gated behind `LIVEAVATAR_DRY_RUN` env var (default true). Wired `inject_critique` into `/analyze`: fires only when any fix has priority == 1, uses the top priority-1 cue as the spoken text. Added `livekit` to requirements.txt. Dry-run smoke test: 2 ContextBatch POSTs to `/analyze` (first buffered, second flushes), response contained `critique` JSON + `avatar_payloads` with `avatar.interrupt` and `avatar.speak_text` events.
- Decisions made: `inject_critique` only fires for priority-1 fixes — avoids avatar talking over itself for minor cues. DRY_RUN default is true so the pipeline is safe to run without live API credentials. Buffer thresholds (`BATCHES_PER_CALL=2`, `IDLE_WINDOW_SEC=4.5`) left at current values — no tuning needed after smoke test.
- Blockers: LIVE mode (LIVEAVATAR_DRY_RUN=false) requires HEYGEN_API_KEY with active LiveAvatar credits and a real avatar_id + context_id. Deferred to Hour 5-6 final smoke test. Coordinate livekit_url + livekit_client_token handoff to Ansh (Stream 3).

### Full integration smoke test result (2026-05-14, real MoveNet data)
- End-to-end validated: MoveNet Docker (:8000) -> `scripts/bridge_client.py` (webcam) -> orchestrator `/analyze` (:8001) -> multimodal Claude -> dry-run LiveAvatar injection -> response.
- Priority-1 fix detection fired correctly on real squat data showing knee valgus; `inject_critique` emitted both `avatar.interrupt` and `avatar.speak_text` payloads, with Claude generating varied phrasings of the same coaching cue across batches (e.g. "Drive knees out over pinky toes", "screw your feet into the floor").
- Hardened `critique.py` against non-JSON model output: assistant prefill of `"{"` forces JSON start; `_parse_critique_response` strips markdown fences, slices first balanced `{...}`, and falls back to a safe priority-3 critique with `_parse_error: true`. Zero 500s after the fix.
- Added `python-dotenv` so `orchestrator.py` auto-loads `.env`.
- Sidebar observation: model converges on the same fix across consecutive batches once a flaw persists. Recurring-issue memory could surface the cue without re-deriving it each time -- nice-to-have, not blocker.

### Dry-run smoke test result (2026-05-14)
- `scripts/smoke_dry_run.py` runs end-to-end against an orchestrator on :8001 with `LIVEAVATAR_DRY_RUN=true`.
- Flow: POST /onboarding (200 OK) -> POST /analyze x1 (status: buffered, pending=1) -> POST /analyze x2 (status: analyzed).
- Low-confidence fixture `mocks/cv_output_dry.json` (frame_count=2 per batch) routes through the canned `_low_confidence_response` so the structural test does not hit Anthropic. All 8 pipeline-shape checks PASS (critique fields, avatar_injected, avatar_payloads, session_id, memory_snapshot).
- Standalone `inject_critique("...")` call verified the DRY-RUN payload pair: `[{event: avatar.interrupt}, {event: avatar.speak_text, text: ...}]`.
- Gap: priority-1 injection path through `/analyze` was NOT exercised - it requires a fixture with realistic motion + real base64 JPEGs so Claude returns a priority-1 fix. Capture a real ContextBatch from Stream 1 to close this gap before the LIVE smoke test.
- Sidebar finding: `critique.py` crashes with `json.JSONDecodeError` if Claude returns non-JSON (observed when called with sparse keypoints + zero images). Worth hardening with a markdown-fence stripper + retry-or-fallback before the LIVE run.


## Hour 3–4: Memory Layer
- Status: done
- What was done: Implemented `src/memory/store.py` with `init_db()` (creates all 3 tables), `write_session()` (inserts session + form_issues rows), `get_recent_sessions()` (last N sessions with joined issues), `get_recurring_issues()` (issues appearing in 2+ sessions), `upsert_user()` / `get_user()` (UserProfile persistence). Added `_classify_issue()` to bucket raw frame_issue strings into typed categories (knee_valgus, insufficient_depth, poor_tempo, asymmetry) for reliable recurring detection.
- Decisions made: `GROUP BY s.id` on sessions query to avoid row collapse from the LEFT JOIN. DB path from `DATABASE_URL` env var with `./db/fitness.sqlite` default. `upsert_user` uses `ON CONFLICT DO UPDATE` so Stream 4 can POST safely on re-onboard.
- Blockers: None — all logic verified with unit tests.

## Hour 4–5: Personalization
- Status: done
- What was done: Extended `run_critique()` to accept `recent_sessions` and `recurring_issues` from the memory layer. `_build_prompt()` now injects a "Recent Session History" block (last 3 summaries) and a "Recurring Issues" block with an explicit escalation rule. Injury-aware logic already present via the profile section — the rule "elevate any related issue to priority 1" is now reinforced by the recurring issues block so knee injury + knee_valgus recurring = double-flagged priority 1. Created `src/llm/briefing.py` with `generate_briefing()` — calls Haiku for a ≤25-word pre-set reminder personalised to exercise, goal, injuries, recurring issues, and last session's top cues.
- Decisions made: Last 3 session summaries in oldest→newest order so model sees trend direction. Briefing capped at 60 tokens and 25 words — must be glanceable before a set.
- Blockers: None.

## Hour 5–6: API + Integration
- Status: partial — dry-run smoke test PASSED; LIVE smoke test (real LiveAvatar session) still pending
- What was done: Implemented `orchestrator.py` with three FastAPI routes: `POST /analyze`, `POST /onboarding`, `GET /briefing`. `init_db()` called at startup via lifespan. After the architecture pivots, `/analyze` now: (1) accepts a `ContextBatch` Pydantic model matching Stream 1's wire shape; (2) buffers batches per `user_id` (in-memory dict) and only fires Claude when 2 are queued AND ≥4.5s has elapsed since the last call — buffered responses return `{"status": "buffered", "pending_batches": n, "seconds_until_ready": s}`; (3) calls multimodal `run_critique` with the flushed pair; (4) writes via a compat shim that fills `frame_issues` with critique cues and leaves metric columns NULL; (5) returns `avatar_injected: false` as a stub. LiveAvatar injection is the remaining piece.
- Decisions made: Buffer state is in-memory only — resets on restart, fine for hackathon. `BATCHES_PER_CALL=2`, `IDLE_WINDOW_SEC=4.5` exposed as module constants for easy tuning. SQLite schema kept stable; missing metric columns left NULL.
- Blockers: LiveAvatar injection in Hour 2-3. Smoke test from the old metric flow no longer applies — needs re-run end-to-end with mock ContextBatches once LiveAvatar is wired.
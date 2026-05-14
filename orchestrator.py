import os
import time
import uuid
from collections import defaultdict
from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel

from src.memory.store import (
    init_db, get_user, upsert_user,
    write_session, get_recent_sessions, get_recurring_issues,
)
from src.llm.critique import run_critique
from src.llm.briefing import generate_briefing
from src.avatar.liveavatar import inject_critique


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="LastMinuteLegends — Stream 2", lifespan=lifespan)


class ContextBatch(BaseModel):
    exercise: str | None = None
    timestamp: float
    window_seconds: float
    frame_count: int
    keypoints_sequence: list[dict] = []
    sampled_images: list[str] = []
    batch_index: int


BATCHES_PER_CALL = 2
IDLE_WINDOW_SEC = 4.5
_pending: dict[str, list[dict]] = defaultdict(list)
_last_call: dict[str, float] = {}


class UserProfilePayload(BaseModel):
    goal: str
    avatar: str
    experience: dict
    age: int
    injuries: list[str] = []
    equipment: str
    frequency_per_week: int
    baseline: dict


@app.post("/analyze")
async def analyze(batch: ContextBatch, user_id: str = Query(...)):
    user_profile = get_user(user_id)
    if not user_profile:
        raise HTTPException(status_code=404, detail=f"User {user_id} not found. Complete onboarding first.")

    _pending[user_id].append(batch.model_dump())

    now = time.time()
    last = _last_call.get(user_id, 0.0)
    enough_batches = len(_pending[user_id]) >= BATCHES_PER_CALL
    idle_elapsed = (now - last) >= IDLE_WINDOW_SEC

    if not (enough_batches and idle_elapsed):
        return {
            "status": "buffered",
            "pending_batches": len(_pending[user_id]),
            "seconds_until_ready": max(0.0, IDLE_WINDOW_SEC - (now - last)),
        }

    flush = _pending[user_id][:BATCHES_PER_CALL]
    _pending[user_id] = _pending[user_id][BATCHES_PER_CALL:]
    _last_call[user_id] = now

    recent_sessions = get_recent_sessions(user_id, n=5)
    recurring_issues = get_recurring_issues(user_id, min_sessions=2)

    critique = run_critique(flush, user_profile, recent_sessions, recurring_issues)

    has_priority_one = any(f.get("priority") == 1 for f in critique.get("fixes", []))
    avatar_injected = False
    avatar_payloads = []
    if has_priority_one:
        top_cue = next(
            f["cue"] for f in sorted(critique.get("fixes", []), key=lambda f: f.get("priority", 99))
            if f.get("priority") == 1
        )
        avatar_payloads = inject_critique(top_cue)
        avatar_injected = True

    # Compat shim: write_session expects metric fields that no longer exist
    # on the wire. We pass exercise + critique-derived issues; metric columns
    # become NULL. Schema kept stable per CLAUDE.md constraint.
    session_compat = {
        "exercise": flush[-1].get("exercise"),
        "frame_issues": [fix.get("cue", "") for fix in critique.get("fixes", [])],
    }
    session_id = write_session(user_id, session_compat, critique)

    trend = _compute_trend(recent_sessions)

    return {
        "status": "analyzed",
        "session_id": session_id,
        "critique": critique,
        "avatar_injected": avatar_injected,
        "avatar_payloads": avatar_payloads,
        "memory_snapshot": {
            "recurring_issues": recurring_issues,
            "trend": trend,
        },
    }


@app.post("/onboarding")
async def onboarding(user_id: str = Query(...), profile: UserProfilePayload = ...):
    upsert_user(user_id, profile.model_dump())
    return {"status": "ok", "user_id": user_id}


@app.get("/briefing")
async def briefing(user_id: str = Query(...), exercise: str = Query(...)):
    user_profile = get_user(user_id)
    if not user_profile:
        raise HTTPException(status_code=404, detail=f"User {user_id} not found.")

    recent_sessions = get_recent_sessions(user_id, n=1)
    recurring_issues = get_recurring_issues(user_id, min_sessions=2)
    last_critique = None
    if recent_sessions and recent_sessions[0].get("critique_summary"):
        last_critique = {"fixes": [], "summary": recent_sessions[0]["critique_summary"]}

    cue = generate_briefing(exercise, user_profile, recurring_issues, last_critique)
    return {"cue": cue}


def _compute_trend(sessions: list[dict]) -> str:
    if len(sessions) < 2:
        return "stable"
    scores = [s.get("knee_valgus_score") or 0 + (s.get("asymmetry_score") or 0) for s in sessions]
    recent = sum(scores[:2]) / 2
    older = sum(scores[2:]) / max(len(scores[2:]), 1)
    if recent < older - 0.05:
        return "improving"
    if recent > older + 0.05:
        return "regressing"
    return "stable"

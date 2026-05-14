# Stream 2 — LLM Critique + Agent Orchestration

## Repo
https://github.com/jogi9928/LastMinuteLegends.git
Branch: `stream-2-llm`

## Stack
Python — anthropic, fastapi, uvicorn, httpx, sqlite3

## Env Vars
ANTHROPIC_API_KEY, LIVEAVATAR_API_KEY, DATABASE_URL=./db/fitness.sqlite

## Structure
src/llm/critique.py, src/llm/briefing.py, src/memory/store.py,
src/avatar/liveavatar.py, orchestrator.py

## Avatar Architecture
Avatar is LiveAvatar FULL Mode — handles user conversation automatically (STT → LLM → TTS).
Backend connects to the agent-control WebSocket topic to inject HIGH-priority form
critiques (interrupt + speak_text) when CV ContextBatch flags a meaningful flaw.
See CONTEXT.md for the LiveAvatar API and injection pattern.

## API Keys
All keys are in `.env` — never hardcode, never print, never log them.
Access via `os.environ.get("KEY_NAME")` only.
Do not read the `.env` file directly.

## Instructions
1. Read TASKS.md to find the current incomplete task (first unchecked box)
2. Read only that task's section from PROGRESS.md for context
3. Plan first. if change is needed, replan before making change. Complete the task
4. Write a brief update to PROGRESS.md under that task's section (what you did, any blockers, decisions made)
5. Check the box in TASKS.md
6. Stop and confirm before moving to the next task

If a task needs API details, schemas, or DB structure, read CONTEXT.md.

import os
import json
import sqlite3
import uuid
from datetime import datetime, timezone

DB_PATH = os.environ.get("DATABASE_URL", "./db/fitness.sqlite")


def _connect() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with _connect() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                goals TEXT, avatar TEXT, experience TEXT,
                age INTEGER, injuries TEXT, equipment TEXT,
                frequency INTEGER, weight REAL, height REAL
            );

            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                user_id TEXT, exercise TEXT, timestamp TEXT,
                reps INTEGER, depth_degrees REAL,
                knee_valgus_score REAL, tempo_eccentric_sec REAL,
                asymmetry_score REAL, critique_summary TEXT
            );

            CREATE TABLE IF NOT EXISTS form_issues (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT, issue_type TEXT,
                severity REAL, description TEXT
            );
        """)


def write_session(user_id: str, cv_data: dict, critique: dict) -> str:
    session_id = str(uuid.uuid4())
    timestamp = datetime.now(timezone.utc).isoformat()

    with _connect() as conn:
        conn.execute(
            """INSERT INTO sessions
               (id, user_id, exercise, timestamp, reps, depth_degrees,
                knee_valgus_score, tempo_eccentric_sec, asymmetry_score, critique_summary)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                session_id, user_id,
                cv_data.get("exercise"), timestamp,
                cv_data.get("reps"), cv_data.get("depth_degrees"),
                cv_data.get("knee_valgus_score"), cv_data.get("tempo_eccentric_sec"),
                cv_data.get("asymmetry_score"), critique.get("summary"),
            ),
        )

        for issue in cv_data.get("frame_issues", []):
            conn.execute(
                "INSERT INTO form_issues (session_id, issue_type, severity, description) VALUES (?, ?, ?, ?)",
                (session_id, _classify_issue(issue), cv_data.get("knee_valgus_score", 0.0), issue),
            )

    return session_id


def get_recent_sessions(user_id: str, n: int = 5) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            """SELECT s.*, GROUP_CONCAT(f.description, '||') as issues
               FROM sessions s
               LEFT JOIN form_issues f ON f.session_id = s.id
               WHERE s.user_id = ?
               GROUP BY s.id
               ORDER BY s.timestamp DESC LIMIT ?""",
            (user_id, n),
        ).fetchall()
    return [dict(r) for r in rows]


def get_recurring_issues(user_id: str, min_sessions: int = 2) -> list[str]:
    """Return issue_types that appear in >= min_sessions distinct sessions."""
    with _connect() as conn:
        rows = conn.execute(
            """SELECT f.issue_type, COUNT(DISTINCT f.session_id) as cnt
               FROM form_issues f
               JOIN sessions s ON s.id = f.session_id
               WHERE s.user_id = ?
               GROUP BY f.issue_type
               HAVING cnt >= ?""",
            (user_id, min_sessions),
        ).fetchall()
    return [r["issue_type"] for r in rows]


def upsert_user(user_id: str, profile: dict) -> None:
    exp = profile.get("experience", {})
    baseline = profile.get("baseline", {})
    with _connect() as conn:
        conn.execute(
            """INSERT INTO users (id, goals, avatar, experience, age, injuries, equipment, frequency, weight, height)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET
                 goals=excluded.goals, avatar=excluded.avatar, experience=excluded.experience,
                 age=excluded.age, injuries=excluded.injuries, equipment=excluded.equipment,
                 frequency=excluded.frequency, weight=excluded.weight, height=excluded.height""",
            (
                user_id,
                profile.get("goal"),
                profile.get("avatar"),
                json.dumps(exp),
                profile.get("age"),
                json.dumps(profile.get("injuries", [])),
                profile.get("equipment"),
                profile.get("frequency_per_week"),
                baseline.get("weight"),
                baseline.get("height"),
            ),
        )


def get_user(user_id: str) -> dict | None:
    with _connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if not row:
        return None
    user = dict(row)
    user["experience"] = json.loads(user["experience"] or "{}")
    user["injuries"] = json.loads(user["injuries"] or "[]")
    return user


def _classify_issue(description: str) -> str:
    desc = description.lower()
    if "knee" in desc:
        return "knee_valgus"
    if "depth" in desc:
        return "insufficient_depth"
    if "eccentric" in desc or "tempo" in desc or "rushed" in desc:
        return "poor_tempo"
    if "asymmetr" in desc or "left" in desc or "right" in desc:
        return "asymmetry"
    return "general_form"

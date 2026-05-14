import os
import time
import httpx

HEYGEN_API_KEY = os.environ.get("HEYGEN_API_KEY")
BASE_URL = "https://api.heygen.com"
POLL_INTERVAL = 15  # seconds
POLL_TIMEOUT = 300  # 5 minutes max


def _headers() -> dict:
    return {"X-Api-Key": HEYGEN_API_KEY, "Content-Type": "application/json"}


def _truncate_script(script: str, max_words: int = 110) -> str:
    # ~110 words ≈ 45s at average speaking pace (145 wpm)
    words = script.split()
    if len(words) <= max_words:
        return script
    return " ".join(words[:max_words]) + "."


def generate_avatar_video(script: str, avatar_id: str | None = None) -> str:
    script = _truncate_script(script)

    payload: dict = {"prompt": script}
    if avatar_id:
        payload["avatar_id"] = avatar_id

    resp = httpx.post(
        f"{BASE_URL}/v3/video-agents",
        headers=_headers(),
        json=payload,
        timeout=30,
    )
    resp.raise_for_status()
    video_id = resp.json()["data"]["video_id"]

    deadline = time.time() + POLL_TIMEOUT
    while time.time() < deadline:
        poll = httpx.get(
            f"{BASE_URL}/v3/videos/{video_id}",
            headers=_headers(),
            timeout=15,
        )
        poll.raise_for_status()
        data = poll.json()["data"]
        status = data["status"]

        if status == "completed":
            return data["video_url"]
        elif status == "failed":
            raise RuntimeError(f"HeyGen video failed: {data.get('failure_message', 'unknown error')}")

        time.sleep(POLL_INTERVAL)

    raise TimeoutError(f"HeyGen video {video_id} did not complete within {POLL_TIMEOUT}s")


def critique_to_script(critique: dict) -> str:
    summary = critique.get("summary", "")
    fixes = sorted(critique.get("fixes", []), key=lambda f: f.get("priority", 99))
    top_fixes = fixes[:2]  # keep script tight

    lines = [summary]
    if top_fixes:
        lines.append("Here are your top cues for next set:")
        for fix in top_fixes:
            lines.append(fix["cue"] + ".")

    return " ".join(lines)

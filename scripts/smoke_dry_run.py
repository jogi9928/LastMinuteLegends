"""Dry-run playthrough against the orchestrator backend on :8000.

Sequence:
  1. POST /onboarding to create a test user
  2. POST /analyze (first batch - should buffer)
  3. POST /analyze (second batch - should flush + analyze)

LIVEAVATAR_DRY_RUN must be true on the server (default).
"""
import json
import sys
import uuid
from pathlib import Path

import httpx

BASE = "http://127.0.0.1:8001"
USER_ID = f"smoke_dry_{uuid.uuid4().hex[:8]}"
MOCK_PATH = Path(__file__).resolve().parent.parent / "mocks" / "cv_output_dry.json"


def section(title: str):
    print(f"\n{'=' * 60}\n  {title}\n{'=' * 60}")


def pretty(resp):
    try:
        body = resp.json()
        print(f"  status: {resp.status_code}")
        print(json.dumps(body, indent=2)[:2000])
        return body
    except Exception:
        print(f"  status: {resp.status_code}")
        print(f"  body: {resp.text[:500]}")
        return None


def main():
    section("[1/3] POST /onboarding")
    onboard = {
        "goal": "general_fitness",
        "avatar": "male",
        "experience": {"intensity": "intermediate", "years": 2},
        "age": 28,
        "injuries": [],
        "equipment": "full_gym",
        "frequency_per_week": 4,
        "baseline": {"weight": 75.0, "height": 178.0},
    }
    r = httpx.post(f"{BASE}/onboarding", params={"user_id": USER_ID}, json=onboard, timeout=10)
    pretty(r)

    with MOCK_PATH.open() as f:
        batch = json.load(f)

    section("[2/3] POST /analyze (call 1 - expected: buffered)")
    b1 = dict(batch); b1["batch_index"] = 0
    r = httpx.post(f"{BASE}/analyze", params={"user_id": USER_ID}, json=b1, timeout=60)
    body1 = pretty(r)
    assert body1 and body1.get("status") == "buffered", f"expected buffered, got {body1}"

    section("[3/3] POST /analyze (call 2 - expected: analyzed + low-conf critique)")
    b2 = dict(batch); b2["batch_index"] = 1
    r = httpx.post(f"{BASE}/analyze", params={"user_id": USER_ID}, json=b2, timeout=60)
    body2 = pretty(r)
    assert body2 and body2.get("status") == "analyzed", f"expected analyzed, got {body2}"

    section("VERIFY: pipeline-shape checks")
    checks = [
        ("critique.summary present", bool(body2.get("critique", {}).get("summary"))),
        ("critique.positives is list", isinstance(body2.get("critique", {}).get("positives"), list)),
        ("critique.fixes is list", isinstance(body2.get("critique", {}).get("fixes"), list)),
        ("avatar_injected is bool", isinstance(body2.get("avatar_injected"), bool)),
        ("avatar_payloads is list", isinstance(body2.get("avatar_payloads"), list)),
        ("session_id present", bool(body2.get("session_id"))),
        ("memory_snapshot.recurring_issues is list", isinstance(body2.get("memory_snapshot", {}).get("recurring_issues"), list)),
        ("memory_snapshot.trend present", bool(body2.get("memory_snapshot", {}).get("trend"))),
    ]
    for label, ok in checks:
        print(f"  [{'PASS' if ok else 'FAIL'}] {label}")

    fixes = body2.get("critique", {}).get("fixes", [])
    has_p1 = any(f.get("priority") == 1 for f in fixes)
    print(f"\n  priority-1 fix present: {has_p1}")
    print(f"  avatar_injected: {body2.get('avatar_injected')}")
    print(f"  avatar_payloads count: {len(body2.get('avatar_payloads') or [])}")
    if not has_p1:
        print("  (no priority-1 fix -> injection correctly skipped)")
    elif body2.get("avatar_payloads"):
        print("  injection fired with payloads:")
        print(json.dumps(body2["avatar_payloads"], indent=2))

    section("Standalone inject_critique sanity check (priority-1 path)")
    sys.path.insert(0, str(MOCK_PATH.parent.parent))
    from src.avatar.liveavatar import inject_critique  # noqa: E402
    payloads = inject_critique("Drive knees out - staying centred over mid-foot.")
    print(json.dumps(payloads, indent=2))
    ok = (
        isinstance(payloads, list)
        and len(payloads) == 2
        and payloads[0] == {"event": "avatar.interrupt"}
        and payloads[1].get("event") == "avatar.speak_text"
        and "knees" in payloads[1].get("text", "")
    )
    print(f"\n  [{'PASS' if ok else 'FAIL'}] inject_critique returns expected payload pair")


if __name__ == "__main__":
    main()

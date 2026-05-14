import asyncio
import json
import os

import httpx
from livekit import rtc

HEYGEN_API_KEY = os.environ.get("HEYGEN_API_KEY", "")
BASE_URL = "https://api.liveavatar.com"
DRY_RUN = os.environ.get("LIVEAVATAR_DRY_RUN", "true").lower() != "false"

# Sandbox avatar — swap to real avatar ID for production
SANDBOX_AVATAR_ID = "dd73ea75-1218-4ef3-92ce-606d5f7fbc0a"


def _headers() -> dict:
    return {"X-API-KEY": HEYGEN_API_KEY, "Content-Type": "application/json"}


# ---------------------------------------------------------------------------
# Session lifecycle (REST) — implement now, called only in LIVE mode
# ---------------------------------------------------------------------------

def create_context(name: str, prompt: str, opening_text: str) -> str:
    resp = httpx.post(
        f"{BASE_URL}/v1/contexts",
        headers=_headers(),
        json={"name": name, "prompt": prompt, "opening_text": opening_text},
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()["data"]["id"]


def create_session_token(
    avatar_id: str,
    context_id: str,
    voice_id: str | None = None,
    is_sandbox: bool = False,
) -> tuple[str, str]:
    persona: dict = {"context_id": context_id, "language": "en"}
    if voice_id:
        persona["voice_id"] = voice_id

    payload: dict = {
        "mode": "FULL",
        "avatar_id": avatar_id,
        "avatar_persona": persona,
    }
    if is_sandbox:
        payload["is_sandbox"] = True

    resp = httpx.post(
        f"{BASE_URL}/v1/sessions/token",
        headers=_headers(),
        json=payload,
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()["data"]
    return data["session_id"], data["session_token"]


def start_session(session_token: str) -> tuple[str, str]:
    resp = httpx.post(
        f"{BASE_URL}/v1/sessions/start",
        headers={"Authorization": f"Bearer {session_token}"},
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()["data"]
    return data["livekit_url"], data["livekit_client_token"]


def stop_session(session_token: str) -> None:
    httpx.post(
        f"{BASE_URL}/v1/sessions/stop",
        headers={"Authorization": f"Bearer {session_token}"},
        timeout=10,
    )


def keep_alive(session_token: str) -> None:
    httpx.post(
        f"{BASE_URL}/v1/sessions/keep-alive",
        headers={"Authorization": f"Bearer {session_token}"},
        timeout=10,
    )


# ---------------------------------------------------------------------------
# LiveKit agent-control channel — used in LIVE mode
# ---------------------------------------------------------------------------

async def _send_to_agent_control(
    livekit_url: str,
    livekit_token: str,
    payloads: list[dict],
) -> None:
    room = rtc.Room()
    await room.connect(livekit_url, livekit_token)
    try:
        for payload in payloads:
            data = json.dumps(payload).encode()
            await room.local_participant.publish_data(
                data,
                topic="agent-control",
                reliable=True,
            )
            await asyncio.sleep(0.05)  # small gap between interrupt and speak
    finally:
        await room.disconnect()


async def _listen_agent_response(
    livekit_url: str,
    livekit_token: str,
    timeout_sec: float = 30.0,
) -> list[dict]:
    """Connect to agent-response and collect events until speak_ended or timeout."""
    received: list[dict] = []
    done = asyncio.Event()

    room = rtc.Room()

    @room.on("data_received")
    def on_data(data_packet: rtc.DataPacket):
        try:
            event = json.loads(data_packet.data)
            received.append(event)
            if event.get("event_type") == "avatar.speak_ended":
                done.set()
        except Exception:
            pass

    await room.connect(livekit_url, livekit_token)
    try:
        await asyncio.wait_for(done.wait(), timeout=timeout_sec)
    except asyncio.TimeoutError:
        pass
    finally:
        await room.disconnect()

    return received


# ---------------------------------------------------------------------------
# Public API — called from orchestrator
# ---------------------------------------------------------------------------

def inject_critique(
    text: str,
    livekit_url: str | None = None,
    livekit_token: str | None = None,
) -> list[dict]:
    """
    Interrupt the avatar and speak the critique text.

    DRY_RUN=true (default): returns the payloads that would be sent, no I/O.
    DRY_RUN=false: sends them over the LiveKit agent-control data channel.

    Returns the two event payloads in both modes.
    """
    payloads = [
        {"event": "avatar.interrupt"},
        {"event": "avatar.speak_text", "text": text},
    ]

    if DRY_RUN:
        print(f"[liveavatar DRY-RUN] would send: {json.dumps(payloads)}")
        return payloads

    if not livekit_url or not livekit_token:
        raise ValueError("livekit_url and livekit_token are required in LIVE mode")

    asyncio.run(_send_to_agent_control(livekit_url, livekit_token, payloads))
    return payloads

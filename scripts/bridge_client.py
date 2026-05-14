"""
Bridge client - replaces test_client.py for the integrated playthrough.

Does what test_client.py does (webcam -> MoveNet WebSocket) AND ALSO POSTs
each received ContextBatch to our orchestrator's /analyze endpoint so the
LLM critique pipeline runs end-to-end against real MoveNet data.

Usage (from project root):
    .venv\\Scripts\\python.exe scripts\\bridge_client.py \\
        --movenet-url ws://localhost:8000/stream \\
        --analyze-url http://127.0.0.1:8001/analyze \\
        --user-id test \\
        --exercise squat

Press Q in the preview window to quit.
"""

import argparse
import asyncio
import json
import time

import cv2
import httpx
import websockets


async def stream(
    movenet_url: str,
    analyze_url: str,
    user_id: str,
    exercise: str,
    fps: int,
) -> None:
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        raise RuntimeError("Cannot open webcam.")

    frame_interval = 1.0 / fps

    async with httpx.AsyncClient(timeout=60.0) as http, websockets.connect(movenet_url) as ws:
        await ws.send(json.dumps({
            "exercise":       exercise,
            "send_interval":  2.0,
            "window_seconds": 2.0,
            "sampled_images": 4,
        }))
        print(f"Connected -> {movenet_url}")
        print(f"Forwarding batches -> {analyze_url}?user_id={user_id}")
        print(f"Exercise: {exercise} | Streaming at {fps}fps\n")

        async def forward(batch: dict) -> None:
            try:
                r = await http.post(
                    analyze_url,
                    params={"user_id": user_id},
                    json=batch,
                )
                body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {"raw": r.text[:200]}
                status = body.get("status", "?")
                if status == "buffered":
                    print(f"  -> /analyze: {r.status_code} buffered (pending={body.get('pending_batches')}, ready_in={body.get('seconds_until_ready'):.1f}s)")
                elif status == "analyzed":
                    summary = (body.get("critique") or {}).get("summary", "")[:120]
                    fixes = (body.get("critique") or {}).get("fixes", [])
                    print(f"  -> /analyze: {r.status_code} ANALYZED  injected={body.get('avatar_injected')}  payloads={len(body.get('avatar_payloads') or [])}")
                    print(f"     summary: {summary}")
                    for f in fixes[:3]:
                        print(f"     fix p{f.get('priority')}: {f.get('cue','')[:120]}")
                    if body.get("avatar_payloads"):
                        print(f"     dry-run payloads:")
                        for p in body["avatar_payloads"]:
                            print(f"       {json.dumps(p)}")
                else:
                    print(f"  -> /analyze: {r.status_code} {json.dumps(body)[:300]}")
            except Exception as e:
                print(f"  -> /analyze ERROR: {type(e).__name__}: {e}")

        async def receive_loop():
            async for message in ws:
                batch = json.loads(message)
                print(
                    f"[batch #{batch['batch_index']}] "
                    f"window={batch['window_seconds']:.1f}s  "
                    f"frames={batch['frame_count']}  "
                    f"images={len(batch['sampled_images'])}  "
                    f"keypoints_seq_len={len(batch['keypoints_sequence'])}"
                )
                await forward(batch)

        recv_task = asyncio.create_task(receive_loop())

        try:
            while True:
                t0 = time.monotonic()

                ok, frame = cap.read()
                if not ok:
                    break

                _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
                await ws.send(buf.tobytes())

                cv2.imshow("bridge client - press Q to quit", frame)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break

                elapsed = time.monotonic() - t0
                await asyncio.sleep(max(0.0, frame_interval - elapsed))

        finally:
            recv_task.cancel()
            cap.release()
            cv2.destroyAllWindows()


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--movenet-url", default="ws://localhost:8000/stream")
    p.add_argument("--analyze-url", default="http://127.0.0.1:8001/analyze")
    p.add_argument("--user-id",     default="test")
    p.add_argument("--exercise",    default="squat")
    p.add_argument("--fps",         default=30, type=int)
    args = p.parse_args()

    asyncio.run(stream(
        movenet_url=args.movenet_url,
        analyze_url=args.analyze_url,
        user_id=args.user_id,
        exercise=args.exercise,
        fps=args.fps,
    ))

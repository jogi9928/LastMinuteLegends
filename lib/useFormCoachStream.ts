"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ContextBatch, Critique, SessionConfig, UserProfile } from "./types";
import { POSE_WS_URL } from "./env";

export type StreamStatus =
  | "idle"
  | "connecting"
  | "streaming"
  | "reconnecting"
  | "error"
  | "closed";

interface UseFormCoachStreamOptions {
  exercise: string;
  userProfile: UserProfile | null;
  userId: string | null;
  onCritique?: (c: Critique) => void;
  fps?: number; // frame send rate to WS (default 10)
  jpegQuality?: number; // canvas → JPEG quality (default 0.75)
  enabled?: boolean; // gate start
}

const MAX_BUFFERED = 1_000_000; // 1 MB — backpressure threshold
const RECONNECT_DELAY_MS = 1500;

function issuesAreSubset(a: string[], b: string[]): boolean {
  if (a.length === 0) return false;
  return a.every((tag) => b.includes(tag));
}

export function useFormCoachStream({
  exercise,
  userProfile,
  userId,
  onCritique,
  fps = 10,
  jpegQuality = 0.75,
  enabled = true,
}: UseFormCoachStreamOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastFrameAtRef = useRef<number>(0);
  const exerciseRef = useRef<string>(exercise);
  const profileRef = useRef<UserProfile | null>(userProfile);
  const userIdRef = useRef<string | null>(userId);
  const onCritiqueRef = useRef<typeof onCritique>(onCritique);
  const lastCritiqueRef = useRef<Critique | null>(null);
  const reconnectAttemptedRef = useRef<boolean>(false);
  const mountedRef = useRef<boolean>(true);
  const sendingRef = useRef<boolean>(false);

  const [status, setStatus] = useState<StreamStatus>("idle");
  const [batchCount, setBatchCount] = useState(0);
  const [critiques, setCritiques] = useState<Critique[]>([]);
  const [lastCritique, setLastCritique] = useState<Critique | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Keep latest refs for stable closures
  useEffect(() => { exerciseRef.current = exercise; }, [exercise]);
  useEffect(() => { profileRef.current = userProfile; }, [userProfile]);
  useEffect(() => { userIdRef.current = userId; }, [userId]);
  useEffect(() => { onCritiqueRef.current = onCritique; }, [onCritique]);

  // Send exercise change without reopening
  useEffect(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ exercise }));
      } catch {
        /* socket closed mid-send */
      }
    }
  }, [exercise]);

  const handleContextBatch = useCallback(async (batch: ContextBatch) => {
    setBatchCount((n) => n + 1);
    const profile = profileRef.current;
    const uid = userIdRef.current;
    if (!profile || !uid) return;
    try {
      const res = await fetch("/api/critique", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contextBatch: batch, userProfile: profile, userId: uid }),
      });
      // 204 means the orchestrator buffered this batch — no critique yet.
      if (res.status === 204) return;
      if (!res.ok) return;
      const critique = (await res.json()) as Critique;

      // Frontend dedupe: skip if text matches the previous, or issues are a
      // strict subset of the previous (no new information).
      const prev = lastCritiqueRef.current;
      if (prev) {
        const sameText = prev.critique_text.trim() === critique.critique_text.trim();
        const subsetIssues =
          critique.issues.length > 0 && issuesAreSubset(critique.issues, prev.issues);
        if (sameText || subsetIssues) return;
      }
      lastCritiqueRef.current = critique;
      if (!mountedRef.current) return;
      setLastCritique(critique);
      setCritiques((prevCs) => [critique, ...prevCs].slice(0, 50));
      onCritiqueRef.current?.(critique);
    } catch {
      /* network blip; we'll get the next one */
    }
  }, []);

  const stopFrameLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const startFrameLoop = useCallback(() => {
    if (rafRef.current !== null) return;
    const intervalMs = 1000 / Math.max(1, fps);
    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      const now = performance.now();
      if (now - lastFrameAtRef.current < intervalMs) return;
      const ws = wsRef.current;
      const video = videoRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      if (!video || video.videoWidth === 0 || video.videoHeight === 0) return;
      if (ws.bufferedAmount > MAX_BUFFERED) return; // backpressure
      if (sendingRef.current) return;
      lastFrameAtRef.current = now;

      let canvas = canvasRef.current;
      if (!canvas) {
        canvas = document.createElement("canvas");
        canvasRef.current = canvas;
      }
      const targetW = 640;
      const scale = targetW / video.videoWidth;
      canvas.width = targetW;
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      sendingRef.current = true;
      canvas.toBlob(
        (blob) => {
          sendingRef.current = false;
          if (!blob) return;
          const wsCur = wsRef.current;
          if (!wsCur || wsCur.readyState !== WebSocket.OPEN) return;
          try { wsCur.send(blob); } catch { /* ignore */ }
        },
        "image/jpeg",
        jpegQuality
      );
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [fps, jpegQuality]);

  const teardown = useCallback(() => {
    stopFrameLoop();
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws) {
      try { ws.close(); } catch { /* ignore */ }
    }
    const stream = streamRef.current;
    streamRef.current = null;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
    canvasRef.current = null;
  }, [stopFrameLoop]);

  const connect = useCallback(async () => {
    setStatus("connecting");
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "camera_unavailable";
      setError(msg);
      setStatus("error");
      return;
    }

    const ws = new WebSocket(POSE_WS_URL);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      const config: SessionConfig = {
        exercise: exerciseRef.current,
        send_interval: 2.0,
        window_seconds: 2.0,
        sampled_images: 4,
        jpeg_quality: 70,
      };
      try { ws.send(JSON.stringify(config)); } catch { /* ignore */ }
      setStatus("streaming");
      startFrameLoop();
    };

    ws.onmessage = (ev) => {
      if (typeof ev.data !== "string") return;
      try {
        const parsed = JSON.parse(ev.data) as ContextBatch;
        if (parsed && Array.isArray(parsed.keypoints_sequence)) {
          handleContextBatch(parsed);
        }
      } catch {
        /* ignore non-JSON frames */
      }
    };

    ws.onerror = () => {
      if (!mountedRef.current) return;
      setError("websocket_error");
    };

    ws.onclose = () => {
      stopFrameLoop();
      if (!mountedRef.current) return;
      if (!reconnectAttemptedRef.current) {
        reconnectAttemptedRef.current = true;
        setStatus("reconnecting");
        setTimeout(() => {
          if (mountedRef.current) connect();
        }, RECONNECT_DELAY_MS);
      } else {
        setStatus("closed");
      }
    };
  }, [handleContextBatch, startFrameLoop, stopFrameLoop]);

  useEffect(() => {
    mountedRef.current = true;
    if (enabled) connect();
    return () => {
      mountedRef.current = false;
      teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return {
    videoRef,
    status,
    error,
    lastCritique,
    critiques,
    batchCount,
  };
}

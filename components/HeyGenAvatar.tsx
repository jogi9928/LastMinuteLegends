"use client";

import { useEffect, useRef, useState } from "react";
import {
  LiveAvatarSession,
  SessionEvent,
  SessionState,
  AgentEventsEnum,
} from "@heygen/liveavatar-web-sdk";

export type HeyGenAvatarProps = {
  // Avatar persona from onboarding ("male" | "female")
  avatar: "male" | "female";
  // Text the avatar should speak. Changes to this prop trigger speech.
  speak: string | null;
  // Optional callback when avatar finishes speaking a line
  onSpeakComplete?: () => void;
  // Connection status callback so parent can show indicators
  onStatusChange?: (status: "connecting" | "ready" | "speaking" | "error") => void;
};

/**
 * STREAM 2 INTEGRATION (Luke's LiveAvatar FULL Mode).
 *
 * Lifecycle:
 *  1. Mount → POST /api/avatar/session (server mints a session_token via the
 *     LiveAvatar REST API using HEYGEN_API_KEY).
 *  2. new LiveAvatarSession(session_token) → await session.start()
 *     (SDK handles /v1/sessions/start + LiveKit connection internally).
 *  3. SESSION_STREAM_READY → attach(videoElement) → onStatusChange("ready").
 *  4. `speak` prop change → session.interrupt() (if mid-utterance) +
 *     session.repeat(text). AVATAR_SPEAK_STARTED → onStatusChange("speaking");
 *     AVATAR_SPEAK_ENDED → onStatusChange("ready") + onSpeakComplete().
 *  5. Unmount → session.stop().
 *
 * Falls back to the emoji placeholder if /api/avatar/session is unavailable
 * (e.g. HEYGEN_API_KEY missing in local dev). onStatusChange("error") fires
 * so the workout page can render an error chip.
 *
 * DO NOT change the props contract without coordinating with Stream 3.
 */
export function HeyGenAvatar({
  avatar,
  speak,
  onSpeakComplete,
  onStatusChange,
}: HeyGenAvatarProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<LiveAvatarSession | null>(null);
  const speakingRef = useRef<boolean>(false);
  const readyRef = useRef<boolean>(false);
  const lastSpokenRef = useRef<string | null>(null);
  const onStatusChangeRef = useRef(onStatusChange);
  const onSpeakCompleteRef = useRef(onSpeakComplete);
  const [usingPlaceholder, setUsingPlaceholder] = useState(false);

  useEffect(() => { onStatusChangeRef.current = onStatusChange; }, [onStatusChange]);
  useEffect(() => { onSpeakCompleteRef.current = onSpeakComplete; }, [onSpeakComplete]);

  // Session lifecycle
  useEffect(() => {
    let cancelled = false;
    onStatusChangeRef.current?.("connecting");

    (async () => {
      let session_token: string | null = null;
      try {
        const res = await fetch("/api/avatar/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ avatar }),
        });
        if (!res.ok) {
          // 503 = key missing, 502 = LiveAvatar upstream error. Either way,
          // fall back to placeholder rather than blowing up the page.
          throw new Error(`session_endpoint_${res.status}`);
        }
        const json = (await res.json()) as { session_token: string };
        session_token = json.session_token;
      } catch (err) {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.warn("[HeyGenAvatar] falling back to placeholder:", err);
        setUsingPlaceholder(true);
        onStatusChangeRef.current?.("error");
        return;
      }

      if (cancelled || !session_token) return;

      let session: LiveAvatarSession;
      try {
        session = new LiveAvatarSession(session_token, { voiceChat: false });
      } catch (err) {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.warn("[HeyGenAvatar] SDK init failed", err);
        setUsingPlaceholder(true);
        onStatusChangeRef.current?.("error");
        return;
      }

      session.on(SessionEvent.SESSION_STREAM_READY, () => {
        if (cancelled) return;
        readyRef.current = true;
        if (videoRef.current) {
          try { session.attach(videoRef.current); } catch { /* ignore */ }
        }
        onStatusChangeRef.current?.("ready");
      });

      session.on(SessionEvent.SESSION_STATE_CHANGED, (state) => {
        if (state === SessionState.DISCONNECTED || state === SessionState.DISCONNECTING) {
          readyRef.current = false;
        }
      });

      session.on(SessionEvent.SESSION_DISCONNECTED, () => {
        if (cancelled) return;
        readyRef.current = false;
        onStatusChangeRef.current?.("error");
      });

      session.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, () => {
        speakingRef.current = true;
        onStatusChangeRef.current?.("speaking");
      });

      session.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, () => {
        speakingRef.current = false;
        onStatusChangeRef.current?.("ready");
        onSpeakCompleteRef.current?.();
      });

      try {
        await session.start();
      } catch (err) {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.warn("[HeyGenAvatar] session.start() failed", err);
        setUsingPlaceholder(true);
        onStatusChangeRef.current?.("error");
        return;
      }

      if (cancelled) {
        try { await session.stop(); } catch { /* ignore */ }
        return;
      }
      sessionRef.current = session;
    })();

    return () => {
      cancelled = true;
      const s = sessionRef.current;
      sessionRef.current = null;
      readyRef.current = false;
      speakingRef.current = false;
      if (s) {
        s.stop().catch(() => { /* ignore */ });
      }
    };
    // We intentionally re-create the session if `avatar` persona changes.
  }, [avatar]);

  // Speech: when `speak` changes to a non-null value, push it to the avatar.
  useEffect(() => {
    if (!speak) return;
    if (speak === lastSpokenRef.current) return;
    lastSpokenRef.current = speak;

    const session = sessionRef.current;
    if (!session || !readyRef.current) return;
    try {
      if (speakingRef.current) {
        session.interrupt();
      }
      session.repeat(speak);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[HeyGenAvatar] repeat() failed", err);
    }
  }, [speak]);

  return (
    <div className="relative w-full h-full bg-zinc-900 rounded-2xl overflow-hidden flex items-center justify-center">
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        autoPlay
        playsInline
        muted={false}
      />
      {usingPlaceholder ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-400 pointer-events-none">
          <div className="w-32 h-32 rounded-full bg-zinc-800 mb-4 flex items-center justify-center">
            <span className="text-5xl">{avatar === "male" ? "🧑‍🏫" : "👩‍🏫"}</span>
          </div>
          <p className="text-sm">HeyGen Avatar</p>
          <p className="text-xs opacity-60">offline — set HEYGEN_API_KEY in .env.local</p>
        </div>
      ) : null}
    </div>
  );
}

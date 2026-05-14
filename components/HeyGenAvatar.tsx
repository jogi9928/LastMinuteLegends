"use client";

import { useEffect, useRef } from "react";

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
 * STREAM 2 INTEGRATION POINT
 *
 * This component is a placeholder. Stream 2 owns the implementation:
 * - Initialize HeyGen Streaming Avatar SDK on mount
 * - Pick avatar based on `avatar` prop (male/female persona IDs)
 * - When `speak` prop changes to a non-null value, send it to HeyGen TTS
 * - Use HeyGen's interrupt API if a new `speak` arrives while one is mid-utterance
 * - Call onSpeakComplete when an utterance finishes
 * - Call onStatusChange as the avatar's state changes
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

  // PLACEHOLDER: Stream 2 replaces this entire block with HeyGen SDK init + speech logic
  useEffect(() => {
    onStatusChange?.("ready");
  }, [onStatusChange]);

  useEffect(() => {
    if (speak) {
      console.log("[HeyGen placeholder] Would speak:", speak);
      onStatusChange?.("speaking");
      const t = setTimeout(() => {
        onStatusChange?.("ready");
        onSpeakComplete?.();
      }, Math.min(speak.length * 50, 5000));
      return () => clearTimeout(t);
    }
  }, [speak, onSpeakComplete, onStatusChange]);

  return (
    <div className="relative w-full h-full bg-zinc-900 rounded-2xl overflow-hidden flex items-center justify-center">
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        autoPlay
        playsInline
        muted={false}
      />
      {/* Visible placeholder until Stream 2 wires up real video */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-400 pointer-events-none">
        <div className="w-32 h-32 rounded-full bg-zinc-800 mb-4 flex items-center justify-center">
          <span className="text-5xl">{avatar === "male" ? "🧑‍🏫" : "👩‍🏫"}</span>
        </div>
        <p className="text-sm">HeyGen Avatar</p>
        <p className="text-xs opacity-60">Stream 2 integration point</p>
      </div>
    </div>
  );
}

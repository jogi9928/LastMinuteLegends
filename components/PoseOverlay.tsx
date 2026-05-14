"use client";

import { useEffect, useRef, useState } from "react";
import { FilesetResolver, PoseLandmarker, type PoseLandmarkerResult } from "@mediapipe/tasks-vision";

interface Props {
  videoRef: React.RefObject<HTMLVideoElement>;
  /** Skeleton color (hex/rgb). Default: emerald. */
  color?: string;
  /** Pose detection FPS cap. Default 20. */
  fps?: number;
}

// MediaPipe BlazePose has 33 landmarks; this is the standard upper+lower-body
// connection set with face/hands stripped for legibility.
const POSE_CONNECTIONS: Array<[number, number]> = [
  // arms
  [11, 13], [13, 15],
  [12, 14], [14, 16],
  // torso
  [11, 12], [11, 23], [12, 24], [23, 24],
  // legs
  [23, 25], [25, 27], [27, 29], [27, 31],
  [24, 26], [26, 28], [28, 30], [28, 32],
];

const KEY_JOINTS = new Set([
  0, // nose
  11, 12, 13, 14, 15, 16, // shoulders, elbows, wrists
  23, 24, 25, 26, 27, 28, // hips, knees, ankles
]);

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

export function PoseOverlay({ videoRef, color = "rgb(16, 185, 129)", fps = 20 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const lastInferAtRef = useRef<number>(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
        if (cancelled) return;
        let landmarker: PoseLandmarker;
        try {
          landmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
            runningMode: "VIDEO",
            numPoses: 1,
            minPoseDetectionConfidence: 0.4,
            minPosePresenceConfidence: 0.4,
            minTrackingConfidence: 0.4,
          });
        } catch {
          // GPU delegate not available — fall back to CPU.
          landmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
            runningMode: "VIDEO",
            numPoses: 1,
            minPoseDetectionConfidence: 0.4,
            minPosePresenceConfidence: 0.4,
            minTrackingConfidence: 0.4,
          });
        }
        if (cancelled) {
          landmarker.close();
          return;
        }
        landmarkerRef.current = landmarker;
        startLoop();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "pose_init_failed";
        // eslint-disable-next-line no-console
        console.error("[PoseOverlay] init failed", err);
        setError(msg);
      }
    })();

    const intervalMs = 1000 / Math.max(1, fps);

    function startLoop() {
      const loop = () => {
        rafRef.current = requestAnimationFrame(loop);
        const now = performance.now();
        if (now - lastInferAtRef.current < intervalMs) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const landmarker = landmarkerRef.current;
        if (!video || !canvas || !landmarker) return;
        if (video.readyState < 2 || video.videoWidth === 0) return;
        lastInferAtRef.current = now;

        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let result: PoseLandmarkerResult;
        try {
          result = landmarker.detectForVideo(video, now);
        } catch {
          return;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (!result.landmarks || result.landmarks.length === 0) return;
        const lm = result.landmarks[0];

        // Bones
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(2, canvas.width / 320);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.shadowColor = color;
        ctx.shadowBlur = 6;
        for (const [a, b] of POSE_CONNECTIONS) {
          const pa = lm[a];
          const pb = lm[b];
          if (!pa || !pb) continue;
          const va = pa.visibility ?? 1;
          const vb = pb.visibility ?? 1;
          if (va < 0.3 || vb < 0.3) continue;
          ctx.beginPath();
          ctx.moveTo(pa.x * canvas.width, pa.y * canvas.height);
          ctx.lineTo(pb.x * canvas.width, pb.y * canvas.height);
          ctx.stroke();
        }
        ctx.shadowBlur = 0;

        // Joints
        ctx.fillStyle = color;
        for (let i = 0; i < lm.length; i++) {
          if (!KEY_JOINTS.has(i)) continue;
          const p = lm[i];
          if ((p.visibility ?? 1) < 0.3) continue;
          ctx.beginPath();
          ctx.arc(p.x * canvas.width, p.y * canvas.height, Math.max(3, canvas.width / 220), 0, Math.PI * 2);
          ctx.fill();
        }
      };
      rafRef.current = requestAnimationFrame(loop);
    }

    return () => {
      cancelled = true;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
  }, [videoRef, color, fps]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
      {error ? (
        <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/70 px-2 py-1 text-[10px] text-red-200">
          pose: {error}
        </div>
      ) : null}
    </>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Camera,
  CircleDot,
  Loader2,
  Maximize2,
  RotateCcw,
  Sparkles,
  Square,
  Video as VideoIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { mockAnalyze } from "@/lib/mock";

type Phase = "idle" | "recording" | "review" | "analyzing";

function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60).toString().padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function WorkoutPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const playbackRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);

  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (err) {
        const name = err instanceof Error ? err.name : "";
        setError(
          name === "NotAllowedError"
            ? "Camera access denied. Allow camera permissions and reload."
            : "Could not access camera. Ensure no other app is using it."
        );
      }
    }
    startCamera();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== "recording") return;
    const id = window.setInterval(() => setElapsed(Date.now() - startedAtRef.current), 200);
    return () => window.clearInterval(id);
  }, [phase]);

  function startRecording() {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"].find(
      (m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)
    );
    const recorder = new MediaRecorder(streamRef.current, mime ? { mimeType: mime } : undefined);
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" });
      const url = URL.createObjectURL(blob);
      setRecordedUrl(url);
      setPhase("review");
    };
    recorderRef.current = recorder;
    recorder.start(250);
    startedAtRef.current = Date.now();
    setElapsed(0);
    setPhase("recording");
  }

  function stopRecording() {
    recorderRef.current?.stop();
  }

  function resetRecording() {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedUrl(null);
    setPhase("idle");
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }

  async function analyze() {
    setPhase("analyzing");
    await new Promise((r) => setTimeout(r, 2500));
    const result = mockAnalyze("squat");
    try {
      window.sessionStorage.setItem("lml.lastResult", JSON.stringify(result));
      if (recordedUrl) window.sessionStorage.setItem("lml.lastRecording", recordedUrl);
    } catch {}
    router.push("/workout/result");
  }

  return (
    <main className="relative min-h-screen pb-32">
      <header className="border-b border-border/60 bg-background/60 backdrop-blur sticky top-0 z-20">
        <div className="container flex h-16 items-center justify-between">
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4" /> Dashboard
            </Link>
          </Button>
          <div className="flex items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>Capture</span>
          </div>
          <div className="w-[100px]" />
        </div>
      </header>

      <section className="container pt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Record a working set</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Capture from the side. Keep your full body in frame for the entire rep range.
            </p>
          </div>
          <Badge variant="secondary" className="capitalize">
            Squat
          </Badge>
        </div>
      </section>

      <section className="container mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-black aspect-video">
          {error ? (
            <div className="absolute inset-0 flex items-center justify-center p-8 text-center text-sm text-muted-foreground">
              {error}
            </div>
          ) : null}

          {phase !== "review" ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
            />
          ) : (
            <video
              ref={playbackRef}
              src={recordedUrl ?? undefined}
              controls
              playsInline
              className="h-full w-full object-contain bg-black"
            />
          )}

          {phase === "idle" ? (
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute left-4 top-4 max-w-xs rounded-lg border border-white/15 bg-black/55 p-3 text-xs text-white/85 backdrop-blur">
                <div className="mb-1 flex items-center gap-2 font-semibold">
                  <Camera className="h-3.5 w-3.5" /> Phone placement
                </div>
                <ul className="list-disc space-y-0.5 pl-4">
                  <li>Set phone on floor, leaned ~75°</li>
                  <li>6-8 ft (2 m) from the bar</li>
                  <li>Capture full body from the side</li>
                  <li>Good, even lighting</li>
                </ul>
              </div>
              <div className="absolute inset-x-12 inset-y-8 rounded-xl border-2 border-dashed border-white/25" />
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-xs text-white/75 backdrop-blur">
                Frame your full body
              </div>
            </div>
          ) : null}

          {phase === "recording" ? (
            <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-red-500/90 px-3 py-1 text-xs font-medium text-white">
              <span className="h-2 w-2 animate-pulse-glow rounded-full bg-white" />
              REC · {formatDuration(elapsed)}
            </div>
          ) : null}

          {phase === "analyzing" ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 backdrop-blur-sm">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <div className="text-base font-medium">Analyzing form…</div>
              <div className="text-xs text-muted-foreground">Counting reps · measuring joint angles</div>
            </div>
          ) : null}
        </div>

        <aside className="space-y-3">
          <div className="rounded-2xl border border-border/60 bg-card/50 p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Coaching cues</div>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <CircleDot className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Brace before each descent.
              </li>
              <li className="flex items-start gap-2">
                <CircleDot className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Drive knees out, not in.
              </li>
              <li className="flex items-start gap-2">
                <CircleDot className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Below parallel if mobility allows.
              </li>
              <li className="flex items-start gap-2">
                <CircleDot className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Control the eccentric — ~2s down.
              </li>
            </ul>
          </div>
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 text-sm">
            <div className="flex items-center gap-2 font-medium">
              <Maximize2 className="h-4 w-4 text-primary" /> Tip
            </div>
            <p className="mt-1 text-muted-foreground">
              Record 1-2 working sets. Longer sets give better averages and catch fatigue-induced form breakdown.
            </p>
          </div>
        </aside>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/85 backdrop-blur">
        <div className="container flex h-20 items-center justify-center gap-3">
          {phase === "idle" ? (
            <Button onClick={startRecording} size="xl" disabled={!!error} className="glow-emerald">
              <CircleDot className="h-5 w-5" /> Start recording
            </Button>
          ) : null}
          {phase === "recording" ? (
            <Button onClick={stopRecording} size="xl" variant="destructive">
              <Square className="h-5 w-5 fill-current" /> Stop
            </Button>
          ) : null}
          {phase === "review" ? (
            <>
              <Button onClick={resetRecording} size="lg" variant="outline">
                <RotateCcw className="h-4 w-4" /> Re-record
              </Button>
              <Button onClick={analyze} size="xl" className="glow-emerald">
                <VideoIcon className="h-5 w-5" /> Analyze
              </Button>
            </>
          ) : null}
          {phase === "analyzing" ? (
            <Button size="xl" disabled>
              <Loader2 className="h-5 w-5 animate-spin" /> Analyzing…
            </Button>
          ) : null}
        </div>
      </div>
    </main>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Sparkles,
  StopCircle,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFormCoachStream } from "@/lib/useFormCoachStream";
import { getUserProfile, addWorkoutSession } from "@/lib/storage";
import { EXERCISE_OPTIONS } from "@/lib/mock";
import type { UserProfile, WorkoutSession } from "@/lib/types";
import { cn } from "@/lib/utils";

const EXERCISE_LABELS: Record<string, string> = {
  squat: "Squat",
  bench: "Bench",
  deadlift: "Deadlift",
  pushup: "Pushup",
  overhead_press: "Overhead Press",
  row: "Row",
};

function scoreTone(s: number) {
  if (s >= 0.8) return "text-emerald-400";
  if (s >= 0.6) return "text-amber-400";
  return "text-red-400";
}

function FormScoreGauge({ score }: { score: number | null }) {
  const pct = Math.round(((score ?? 0) * 100));
  const tone = score == null ? "text-muted-foreground" : scoreTone(score);
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border/60 bg-card/40 p-4">
      <div className="flex flex-col">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">Form score</span>
        <span className={cn("text-3xl font-semibold tabular-nums", tone)}>
          {score == null ? "—" : pct}
          <span className="ml-1 text-sm font-normal text-muted-foreground">/ 100</span>
        </span>
      </div>
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-secondary">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            score == null
              ? "bg-muted"
              : score >= 0.8
              ? "bg-emerald-500"
              : score >= 0.6
              ? "bg-amber-500"
              : "bg-red-500"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ReturnType<typeof useFormCoachStream>["status"] }) {
  const map: Record<
    ReturnType<typeof useFormCoachStream>["status"],
    { label: string; tone: string; icon: React.ReactNode }
  > = {
    idle: { label: "Idle", tone: "bg-zinc-700/70 text-zinc-200", icon: <Loader2 className="h-3 w-3" /> },
    connecting: {
      label: "Connecting",
      tone: "bg-amber-500/20 text-amber-200 border border-amber-500/40",
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
    },
    streaming: {
      label: "Streaming",
      tone: "bg-emerald-500/20 text-emerald-200 border border-emerald-500/40",
      icon: <Wifi className="h-3 w-3" />,
    },
    reconnecting: {
      label: "Reconnecting",
      tone: "bg-amber-500/20 text-amber-200 border border-amber-500/40",
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
    },
    error: {
      label: "Error",
      tone: "bg-red-500/20 text-red-200 border border-red-500/40",
      icon: <WifiOff className="h-3 w-3" />,
    },
    closed: {
      label: "Disconnected",
      tone: "bg-zinc-700/70 text-zinc-200",
      icon: <WifiOff className="h-3 w-3" />,
    },
  };
  const item = map[status];
  return (
    <div className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium backdrop-blur", item.tone)}>
      {status === "streaming" ? (
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse-glow" />
      ) : (
        item.icon
      )}
      {item.label}
    </div>
  );
}

export default function WorkoutPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [exercise, setExercise] = useState<string>("squat");
  const startedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    const ob = getUserProfile();
    if (!ob) {
      router.replace("/onboarding");
      return;
    }
    setProfile(ob);
  }, [router]);

  const stream = useFormCoachStream({
    exercise,
    userProfile: profile,
    enabled: profile != null,
  });

  const transcript = stream.critiques;
  const latestScore = stream.lastCritique?.form_score ?? null;

  const avgScore = useMemo(() => {
    if (transcript.length === 0) return null;
    const sum = transcript.reduce((s, c) => s + c.form_score, 0);
    return sum / transcript.length;
  }, [transcript]);

  function endWorkout() {
    if (transcript.length > 0) {
      const ordered = [...transcript].reverse(); // chronological for storage
      const avg = ordered.reduce((s, c) => s + c.form_score, 0) / ordered.length;
      const session: WorkoutSession = {
        id: `s-${Date.now()}`,
        exercise,
        started_at: startedAtRef.current,
        ended_at: Date.now(),
        critiques: ordered,
        avg_form_score: Math.round(avg * 100) / 100,
      };
      addWorkoutSession(session);
    }
    router.push("/dashboard");
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
            <span>Live coach</span>
          </div>
          <StatusBadge status={stream.status} />
        </div>
      </header>

      <section className="container pt-6">
        <div className="flex flex-wrap items-center gap-2">
          {EXERCISE_OPTIONS.map((ex) => (
            <button
              key={ex}
              onClick={() => setExercise(ex)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                exercise === ex
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-card text-foreground hover:border-primary/40"
              )}
            >
              {EXERCISE_LABELS[ex] ?? ex}
            </button>
          ))}
        </div>
      </section>

      <section className="container mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-black aspect-video">
          <video
            ref={stream.videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
          />
          {stream.error ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-8 text-center text-sm text-red-200">
              {stream.error}
            </div>
          ) : null}
          <div className="absolute left-3 top-3">
            <StatusBadge status={stream.status} />
          </div>
          <div className="absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-xs text-white/80 backdrop-blur tabular-nums">
            batches {stream.batchCount}
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <div
            data-slot="heygen-avatar"
            className="flex flex-1 min-h-[200px] flex-col items-center justify-center rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-6 text-center"
          >
            <Sparkles className="mb-3 h-8 w-8 text-primary" />
            <div className="text-base font-medium">HeyGen avatar embed here</div>
            <div className="mt-1 max-w-xs text-sm text-muted-foreground">
              Stream 2 mounts the live coach in this slot.
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card/40">
            <div className="border-b border-border/60 px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground">
              Live transcript
            </div>
            <ul className="max-h-[280px] divide-y divide-border/40 overflow-y-auto">
              {transcript.length === 0 ? (
                <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Waiting for the first cue from your coach…
                </li>
              ) : (
                transcript.slice(0, 6).map((c, idx) => (
                  <li
                    key={`${c.batch_index}-${idx}`}
                    className={cn(
                      "px-4 py-3 text-sm transition-opacity",
                      idx === 0 ? "opacity-100" : idx === 1 ? "opacity-80" : idx === 2 ? "opacity-65" : "opacity-50"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <span className={cn("mt-1 inline-block h-2 w-2 shrink-0 rounded-full", scoreTone(c.form_score))} />
                      <span className="flex-1">{c.critique_text}</span>
                      <Badge variant="outline" className="shrink-0 tabular-nums">
                        {Math.round(c.form_score * 100)}
                      </Badge>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </aside>
      </section>

      <section className="container mt-6">
        <FormScoreGauge score={latestScore} />
      </section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/85 backdrop-blur">
        <div className="container flex h-20 items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground tabular-nums">
            {transcript.length} cue{transcript.length === 1 ? "" : "s"}
            {avgScore != null ? <> · avg {Math.round(avgScore * 100)}</> : null}
          </div>
          <Button onClick={endWorkout} size="xl" variant="destructive">
            <StopCircle className="h-5 w-5" /> End workout
          </Button>
        </div>
      </div>
    </main>
  );
}

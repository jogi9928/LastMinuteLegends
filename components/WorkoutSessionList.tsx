"use client";

import { Activity, ChevronRight } from "lucide-react";
import type { WorkoutSession } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function timeAgo(ts: number): string {
  const ms = Date.now() - ts;
  const day = 24 * 60 * 60 * 1000;
  const d = Math.floor(ms / day);
  if (d <= 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

function scoreTone(score: number) {
  if (score >= 0.8) return { v: "success" as const, label: "strong" };
  if (score >= 0.6) return { v: "warning" as const, label: "fair" };
  return { v: "danger" as const, label: "rough" };
}

const EXERCISE_LABEL: Record<string, string> = {
  squat: "Squat",
  bench: "Bench",
  deadlift: "Deadlift",
  pushup: "Pushup",
  overhead_press: "Overhead Press",
  row: "Row",
};

export function WorkoutSessionList({ sessions }: { sessions: WorkoutSession[] }) {
  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/30 p-10 text-center">
        <Activity className="mb-3 h-8 w-8 text-muted-foreground" />
        <div className="text-base font-medium">No workouts yet</div>
        <div className="mt-1 text-sm text-muted-foreground">Start a live coaching session to log your first one.</div>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border/60 rounded-xl border border-border/60 bg-card/40 overflow-hidden">
      {sessions.map((s) => {
        const tone = scoreTone(s.avg_form_score);
        const durationMin = Math.max(1, Math.round((s.ended_at - s.started_at) / 60000));
        return (
          <li key={s.id} className="flex items-center gap-4 p-3">
            <div
              className={cn(
                "flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border text-lg font-semibold tabular-nums",
                tone.v === "success" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
                tone.v === "warning" && "border-amber-500/30 bg-amber-500/10 text-amber-300",
                tone.v === "danger" && "border-red-500/30 bg-red-500/10 text-red-300"
              )}
            >
              {Math.round(s.avg_form_score * 100)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">{EXERCISE_LABEL[s.exercise] ?? s.exercise}</span>
                <Badge variant={tone.v} className="text-[10px]">{tone.label}</Badge>
                <span className="ml-auto text-xs text-muted-foreground">{timeAgo(s.ended_at)}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground tabular-nums">
                <span>{s.critiques.length} cues</span>
                <span>· {durationMin} min</span>
                <span>· avg {Math.round(s.avg_form_score * 100)} / 100</span>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </li>
        );
      })}
    </ul>
  );
}

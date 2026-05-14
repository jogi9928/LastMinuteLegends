"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, LogOut, Sparkles, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScoreLineChart } from "@/components/charts/ScoreLineChart";
import { WorkoutSessionList } from "@/components/WorkoutSessionList";
import { getUserProfile, getWorkoutSessions, clearAll, setWorkoutSessions } from "@/lib/storage";
import { ensureSeededWorkoutSessions } from "@/lib/mock";
import type { UserProfile, WorkoutSession } from "@/lib/types";

function goalLabel(g: UserProfile["goal"]) {
  if (g === "aesthetics") return "Aesthetics";
  if (g === "strength") return "Strength";
  return "General fitness";
}

const ISSUE_LABELS: Record<string, string> = {
  chest_drop: "Chest dropping forward",
  heel_lift: "Heels lifting",
  knee_valgus: "Knees caving in",
  bracing: "Brace before descending",
  tempo_fast: "Eccentric too fast",
  asymmetry: "Left/right asymmetry",
  ribflare: "Rib flare at lockout",
};

function formatIssue(tag: string) {
  return ISSUE_LABELS[tag] ?? tag.replace(/_/g, " ");
}

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);

  useEffect(() => {
    const ob = getUserProfile();
    if (!ob) {
      router.replace("/onboarding");
      return;
    }
    setProfile(ob);
    const existing = getWorkoutSessions();
    const seeded = ensureSeededWorkoutSessions(existing);
    if (existing.length === 0) setWorkoutSessions(seeded);
    setSessions(seeded);
  }, [router]);

  const chartData = useMemo(() => {
    const ordered = [...sessions].sort((a, b) => a.ended_at - b.ended_at);
    return ordered.map((s) => ({
      date: new Date(s.ended_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      value: Math.round(s.avg_form_score * 100),
    }));
  }, [sessions]);

  const topIssues = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of sessions) {
      for (const c of s.critiques) {
        for (const tag of c.issues) counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([tag, count]) => ({ tag, count }));
  }, [sessions]);

  if (!profile) return null;

  return (
    <main className="relative min-h-screen pb-20">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-[28rem] w-[44rem] -translate-x-1/2 rounded-full bg-primary/15 blur-[120px]" />
      </div>

      <header className="border-b border-border/60 bg-background/60 backdrop-blur sticky top-0 z-20">
        <div className="container flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="font-semibold tracking-tight">LastMinuteLegends</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              clearAll();
              router.replace("/onboarding");
            }}
            aria-label="Reset"
            title="Reset onboarding (demo)"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <section className="container pt-10 sm:pt-14">
        <div className="flex flex-col-reverse items-start gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="success">{goalLabel(profile.goal)}</Badge>
              <Badge variant="secondary">{profile.frequency_per_week}× / wk</Badge>
              <Badge variant="outline" className="capitalize">
                {profile.experience.intensity}
              </Badge>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Welcome back</h1>
            <p className="text-muted-foreground">
              {sessions.length} workout{sessions.length === 1 ? "" : "s"} logged · keep stacking quality reps.
            </p>
          </div>
          <Button asChild size="xl" className="w-full glow-emerald sm:w-auto">
            <Link href="/workout">
              <Video className="h-5 w-5" /> Start workout <ArrowRight className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>

      <section className="container mt-10 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Progress</h2>
          <ScoreLineChart data={chartData} />
        </div>

        <div>
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <AlertTriangle className="h-4 w-4" /> Things to work on
          </h2>
          {topIssues.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 bg-card/30 p-6 text-center text-sm text-muted-foreground">
              No recurring issues. Nice.
            </div>
          ) : (
            <ul className="divide-y divide-border/60 rounded-xl border border-border/60 bg-card/40 overflow-hidden">
              {topIssues.map((it, idx) => (
                <li key={it.tag} className="flex items-center gap-3 p-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10 text-sm font-semibold text-amber-300">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{formatIssue(it.tag)}</div>
                    <div className="text-xs text-muted-foreground tabular-nums">
                      flagged {it.count}× across recent sessions
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="container mt-10">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Recent workouts</h2>
        <WorkoutSessionList sessions={sessions} />
      </section>
    </main>
  );
}

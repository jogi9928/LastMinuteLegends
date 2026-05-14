"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, GitCompare, LogOut, Sparkles, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MetricChart } from "@/components/charts/MetricChart";
import { SessionList } from "@/components/SessionList";
import { getOnboarding, getSessions, clearAll, setSessions } from "@/lib/storage";
import { ensureSeededSessions } from "@/lib/mock";
import type { OnboardingData, Session } from "@/lib/types";

function goalLabel(g: OnboardingData["goal"]) {
  if (g === "aesthetics") return "Aesthetics";
  if (g === "strength") return "Strength";
  return "General fitness";
}

export default function DashboardPage() {
  const router = useRouter();
  const [onboarding, setOnboardingState] = useState<OnboardingData | null>(null);
  const [sessions, setSessionsState] = useState<Session[]>([]);

  useEffect(() => {
    const ob = getOnboarding();
    if (!ob) {
      router.replace("/onboarding");
      return;
    }
    setOnboardingState(ob);
    const existing = getSessions();
    const seeded = ensureSeededSessions(existing);
    if (existing.length === 0) setSessions(seeded);
    setSessionsState(seeded);
  }, [router]);

  const chartData = useMemo(() => {
    const ordered = [...sessions].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const fmt = (iso: string) =>
      new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return {
      depth: ordered.map((s) => ({ date: fmt(s.createdAt), value: s.depth_degrees })),
      valgus: ordered.map((s) => ({ date: fmt(s.createdAt), value: s.knee_valgus_score })),
      asym: ordered.map((s) => ({ date: fmt(s.createdAt), value: s.asymmetry_score })),
      tempo: ordered.map((s) => ({ date: fmt(s.createdAt), value: s.tempo_eccentric_sec })),
    };
  }, [sessions]);

  if (!onboarding) return null;

  const greeting = onboarding.name?.trim() ? `Welcome back, ${onboarding.name}` : "Welcome back";

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
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/compare">
                <GitCompare className="h-4 w-4" /> Compare
              </Link>
            </Button>
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
        </div>
      </header>

      <section className="container pt-10 sm:pt-14">
        <div className="flex flex-col-reverse items-start gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="success">{goalLabel(onboarding.goal)}</Badge>
              <Badge variant="secondary">{onboarding.daysPerWeek}× / wk</Badge>
              <Badge variant="outline" className="capitalize">
                {onboarding.intensity}
              </Badge>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{greeting}</h1>
            <p className="text-muted-foreground">
              {sessions.length} session{sessions.length === 1 ? "" : "s"} recorded · keep stacking quality reps.
            </p>
          </div>
          <Button asChild size="xl" className="w-full glow-emerald sm:w-auto">
            <Link href="/workout">
              <Video className="h-5 w-5" /> Start workout <ArrowRight className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>

      <section className="container mt-10">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Progress</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricChart
            title="Depth"
            unit="°"
            data={chartData.depth}
            lowerIsBetter
            decimals={0}
            color="hsl(142 71% 45%)"
          />
          <MetricChart
            title="Knee valgus"
            data={chartData.valgus}
            lowerIsBetter
            decimals={2}
            color="hsl(38 92% 58%)"
          />
          <MetricChart
            title="Asymmetry"
            data={chartData.asym}
            lowerIsBetter
            decimals={2}
            color="hsl(0 72% 60%)"
          />
          <MetricChart
            title="Eccentric tempo"
            unit="s"
            data={chartData.tempo}
            decimals={1}
            color="hsl(199 89% 60%)"
          />
        </div>
      </section>

      <section className="container mt-10">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Recent sessions</h2>
          <Link href="/compare" className="text-sm text-primary hover:underline">
            Compare two →
          </Link>
        </div>
        <SessionList sessions={sessions} />
      </section>
    </main>
  );
}

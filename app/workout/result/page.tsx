"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { addSession, getSessionById } from "@/lib/storage";
import { toImageSrc } from "@/lib/mock";
import type { FormAnalysis, Session } from "@/lib/types";
import { cn } from "@/lib/utils";

type Tone = "good" | "warn" | "bad" | "neutral";

function toneClass(tone: Tone) {
  if (tone === "good") return "text-emerald-400";
  if (tone === "warn") return "text-amber-400";
  if (tone === "bad") return "text-red-400";
  return "text-foreground";
}

function depthTone(v: number): Tone {
  if (v <= 95) return "good";
  if (v <= 105) return "warn";
  return "bad";
}
function valgusTone(v: number): Tone {
  if (v <= 0.25) return "good";
  if (v <= 0.4) return "warn";
  return "bad";
}
function asymTone(v: number): Tone {
  if (v <= 0.15) return "good";
  if (v <= 0.3) return "warn";
  return "bad";
}
function tempoTone(v: number): Tone {
  if (v >= 1.0 && v <= 2.5) return "good";
  if (v >= 0.8 && v <= 3.5) return "warn";
  return "bad";
}

interface MetricCellProps {
  label: string;
  value: string;
  unit?: string;
  tone?: Tone;
  hint?: string;
}

function MetricCell({ label, value, unit, tone = "neutral", hint }: MetricCellProps) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("mt-2 text-3xl font-semibold tabular-nums", toneClass(tone))}>
        {value}
        {unit ? <span className="ml-1 text-base font-normal text-muted-foreground">{unit}</span> : null}
      </div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

export default function ResultPage() {
  const router = useRouter();
  const [result, setResult] = useState<FormAnalysis | null>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem("lml.lastResult");
      const url = window.sessionStorage.getItem("lml.lastRecording");
      if (!raw) {
        router.replace("/workout");
        return;
      }
      const parsed = JSON.parse(raw) as FormAnalysis;
      setResult(parsed);
      setRecordingUrl(url);

      const id = `s-${Date.now()}`;
      if (!getSessionById(id)) {
        const session: Session = { id, createdAt: new Date().toISOString(), ...parsed };
        addSession(session);
        setSessionId(id);
      }
    } catch {
      router.replace("/workout");
    }
  }, [router]);

  const issuesTone = useMemo<Tone>(() => {
    if (!result) return "neutral";
    if (result.frame_issues.length === 0) return "good";
    if (result.frame_issues.length === 1) return "warn";
    return "bad";
  }, [result]);

  if (!result) return null;

  return (
    <main className="relative min-h-screen pb-20">
      <header className="border-b border-border/60 bg-background/60 backdrop-blur sticky top-0 z-20">
        <div className="container flex h-16 items-center justify-between">
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4" /> Dashboard
            </Link>
          </Button>
          <div className="flex items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>Form report</span>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/workout">
              <RotateCcw className="h-4 w-4" /> Try again
            </Link>
          </Button>
        </div>
      </header>

      <section className="container pt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Badge variant={issuesTone === "good" ? "success" : issuesTone === "warn" ? "warning" : "danger"}>
              {issuesTone === "good" ? "Clean reps" : `${result.frame_issues.length} issue${result.frame_issues.length === 1 ? "" : "s"} flagged`}
            </Badge>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight capitalize sm:text-4xl">{result.exercise} · {result.reps} reps</h1>
            <p className="mt-1 text-sm text-muted-foreground">Compared rep-to-rep against your last sessions.</p>
          </div>
          {sessionId ? (
            <Button asChild variant="outline">
              <Link href={`/compare?a=${encodeURIComponent(sessionId)}`}>Compare with past</Link>
            </Button>
          ) : null}
        </div>
      </section>

      <section className="container mt-6 grid gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-black">
          <div className="aspect-video w-full">
            {recordingUrl ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video src={recordingUrl} controls playsInline className="h-full w-full object-contain bg-black" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                No recording available
              </div>
            )}
          </div>
          <div className="border-t border-border/60 bg-card/50 px-4 py-2 text-xs text-muted-foreground">Your set</div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border/60 bg-black">
          <div className="aspect-video w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={toImageSrc(result.image)} alt="Keyframe" className="h-full w-full object-contain" />
          </div>
          <div className="border-t border-border/60 bg-card/50 px-4 py-2 text-xs text-muted-foreground">Auto-detected keyframe</div>
        </div>
      </section>

      <section className="container mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCell label="Reps" value={String(result.reps)} hint="Completed in set" />
        <MetricCell
          label="Depth"
          value={result.depth_degrees.toFixed(0)}
          unit="°"
          tone={depthTone(result.depth_degrees)}
          hint="Lower is deeper"
        />
        <MetricCell
          label="Knee valgus"
          value={result.knee_valgus_score.toFixed(2)}
          tone={valgusTone(result.knee_valgus_score)}
          hint="0 = perfect tracking"
        />
        <MetricCell
          label="Tempo (ecc.)"
          value={result.tempo_eccentric_sec.toFixed(1)}
          unit="s"
          tone={tempoTone(result.tempo_eccentric_sec)}
          hint="1-2.5s ideal"
        />
        <MetricCell
          label="Asymmetry"
          value={result.asymmetry_score.toFixed(2)}
          tone={asymTone(result.asymmetry_score)}
          hint="0 = balanced"
        />
      </section>

      <section className="container mt-8 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className={cn("h-4 w-4", issuesTone === "good" ? "text-emerald-400" : issuesTone === "warn" ? "text-amber-400" : "text-red-400")} />
            Frame-level issues
          </div>
          {result.frame_issues.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No issues detected. Beautiful work.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {result.frame_issues.map((iss, i) => (
                <li key={i} className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  <span className="text-amber-100/90">{iss}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div
          data-slot="heygen-avatar"
          className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-6 text-center"
        >
          <Sparkles className="mb-3 h-8 w-8 text-primary" />
          <div className="text-base font-medium">HeyGen avatar embed here</div>
          <div className="mt-1 max-w-xs text-sm text-muted-foreground">
            Stream 2 will mount the coach embed in this slot to deliver this report.
          </div>
        </div>
      </section>

      <section className="container mt-8 flex flex-wrap items-center justify-end gap-3">
        <Button asChild variant="outline" size="lg">
          <Link href="/workout">
            <RotateCcw className="h-4 w-4" /> Try again
          </Link>
        </Button>
        <Button asChild size="lg">
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4" /> Back to dashboard
          </Link>
        </Button>
      </section>
    </main>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, ArrowDown, ArrowUp, Minus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getSessions } from "@/lib/storage";
import { ensureSeededSessions, toImageSrc } from "@/lib/mock";
import type { Session } from "@/lib/types";
import { cn } from "@/lib/utils";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

interface MetricSpec {
  key: keyof Pick<Session, "depth_degrees" | "knee_valgus_score" | "tempo_eccentric_sec" | "asymmetry_score" | "reps">;
  label: string;
  unit?: string;
  decimals: number;
  lowerIsBetter: boolean;
  /** for tempo, "closer to ideal" — we treat it as neutral (any change is just shown) */
  neutral?: boolean;
}

const METRICS: MetricSpec[] = [
  { key: "reps", label: "Reps", decimals: 0, lowerIsBetter: false, neutral: true },
  { key: "depth_degrees", label: "Depth", unit: "°", decimals: 1, lowerIsBetter: true },
  { key: "knee_valgus_score", label: "Knee valgus", decimals: 2, lowerIsBetter: true },
  { key: "asymmetry_score", label: "Asymmetry", decimals: 2, lowerIsBetter: true },
  { key: "tempo_eccentric_sec", label: "Tempo (ecc.)", unit: "s", decimals: 1, lowerIsBetter: false, neutral: true },
];

interface DeltaProps {
  delta: number;
  decimals: number;
  unit?: string;
  lowerIsBetter: boolean;
  neutral?: boolean;
}

function Delta({ delta, decimals, unit, lowerIsBetter, neutral }: DeltaProps) {
  const isZero = Math.abs(delta) < Math.pow(10, -decimals) / 2;
  if (isZero) {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground tabular-nums">
        <Minus className="h-3.5 w-3.5" /> 0
      </span>
    );
  }
  const better = neutral ? null : lowerIsBetter ? delta < 0 : delta > 0;
  const tone =
    better === null ? "text-muted-foreground" : better ? "text-emerald-400" : "text-red-400";
  const Icon = delta < 0 ? ArrowDown : ArrowUp;
  const sign = delta > 0 ? "+" : "";
  return (
    <span className={cn("inline-flex items-center gap-1 tabular-nums", tone)}>
      <Icon className="h-3.5 w-3.5" />
      {sign}
      {delta.toFixed(decimals)}
      {unit ? ` ${unit}` : ""}
    </span>
  );
}

interface SessionPickerProps {
  label: string;
  value: string;
  onChange: (id: string) => void;
  sessions: Session[];
}

function SessionPicker({ label, value, onChange, sessions }: SessionPickerProps) {
  return (
    <div className="space-y-2">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Choose a session" />
        </SelectTrigger>
        <SelectContent>
          {sessions.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {fmtDate(s.createdAt)} · {s.exercise} · {s.reps} reps
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function ComparePage() {
  const params = useSearchParams();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [aId, setAId] = useState<string>("");
  const [bId, setBId] = useState<string>("");

  useEffect(() => {
    const seeded = ensureSeededSessions(getSessions());
    setSessions(seeded);
    const presetA = params.get("a");
    const presetB = params.get("b");
    const defaultA = presetA && seeded.some((s) => s.id === presetA) ? presetA : seeded[0]?.id;
    const defaultB =
      presetB && seeded.some((s) => s.id === presetB)
        ? presetB
        : seeded.find((s) => s.id !== defaultA)?.id ?? seeded[1]?.id ?? "";
    setAId(defaultA ?? "");
    setBId(defaultB ?? "");
  }, [params]);

  const a = useMemo(() => sessions.find((s) => s.id === aId), [sessions, aId]);
  const b = useMemo(() => sessions.find((s) => s.id === bId), [sessions, bId]);

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
            <span>Compare sessions</span>
          </div>
          <div className="w-[100px]" />
        </div>
      </header>

      <section className="container pt-8">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Side-by-side review</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a current session and a past session. Deltas tint emerald when you improved and red when you regressed.
        </p>
      </section>

      <section className="container mt-6 grid gap-4 sm:grid-cols-2">
        <SessionPicker label="Session A · current" value={aId} onChange={setAId} sessions={sessions} />
        <SessionPicker label="Session B · past" value={bId} onChange={setBId} sessions={sessions} />
      </section>

      {a && b ? (
        <>
          <section className="container mt-6 grid gap-6 sm:grid-cols-2">
            <SessionCard session={a} caption="Session A" />
            <SessionCard session={b} caption="Session B" />
          </section>

          <section className="container mt-8">
            <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/40">
              <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] gap-2 border-b border-border/60 px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">
                <div>Metric</div>
                <div className="text-right">Session A</div>
                <div className="text-right">Session B</div>
                <div className="text-right">Δ A vs B</div>
              </div>
              {METRICS.map((m) => {
                const av = a[m.key] as number;
                const bv = b[m.key] as number;
                const delta = av - bv;
                return (
                  <div
                    key={m.key}
                    className="grid grid-cols-[1.4fr_1fr_1fr_1fr] gap-2 border-b border-border/40 px-4 py-3 last:border-b-0"
                  >
                    <div className="text-sm font-medium">{m.label}</div>
                    <div className="text-right tabular-nums">
                      {av.toFixed(m.decimals)}
                      {m.unit ? <span className="ml-1 text-xs text-muted-foreground">{m.unit}</span> : null}
                    </div>
                    <div className="text-right tabular-nums text-muted-foreground">
                      {bv.toFixed(m.decimals)}
                      {m.unit ? <span className="ml-1 text-xs">{m.unit}</span> : null}
                    </div>
                    <div className="text-right text-sm">
                      <Delta
                        delta={delta}
                        decimals={m.decimals}
                        unit={m.unit}
                        lowerIsBetter={m.lowerIsBetter}
                        neutral={m.neutral}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      ) : (
        <section className="container mt-10">
          <div className="rounded-xl border border-dashed border-border/60 bg-card/30 p-10 text-center text-sm text-muted-foreground">
            Pick two sessions to compare.
          </div>
        </section>
      )}

      <section className="container mt-8 flex justify-end">
        <Button asChild>
          <Link href="/workout">
            New workout <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </section>
    </main>
  );
}

function SessionCard({ session, caption }: { session: Session; caption: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-black">
      <div className="aspect-video w-full bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={toImageSrc(session.image)} alt="" className="h-full w-full object-contain" />
      </div>
      <div className="flex items-center justify-between border-t border-border/60 bg-card/50 px-4 py-2 text-xs">
        <span className="text-muted-foreground">{caption}</span>
        <span className="font-medium">{fmtDate(session.createdAt)} · {session.reps} reps</span>
      </div>
    </div>
  );
}

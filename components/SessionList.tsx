"use client";

import Link from "next/link";
import { ChevronRight, Activity } from "lucide-react";
import type { Session } from "@/lib/types";
import { toImageSrc } from "@/lib/mock";
import { Badge } from "@/components/ui/badge";

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const day = 24 * 60 * 60 * 1000;
  const d = Math.floor(ms / day);
  if (d <= 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

function depthBadge(depth: number) {
  if (depth <= 95) return { v: "success" as const, label: "deep" };
  if (depth <= 105) return { v: "warning" as const, label: "borderline" };
  return { v: "danger" as const, label: "shallow" };
}

export function SessionList({ sessions }: { sessions: Session[] }) {
  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/30 p-10 text-center">
        <Activity className="mb-3 h-8 w-8 text-muted-foreground" />
        <div className="text-base font-medium">No sessions yet</div>
        <div className="mt-1 text-sm text-muted-foreground">Record your first set to see it here.</div>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border/60 rounded-xl border border-border/60 bg-card/40 overflow-hidden">
      {sessions.map((s) => {
        const db = depthBadge(s.depth_degrees);
        return (
          <li key={s.id}>
            <Link
              href={`/compare?a=${encodeURIComponent(s.id)}`}
              className="flex items-center gap-4 p-3 transition-colors hover:bg-primary/5"
            >
              <div className="h-14 w-20 shrink-0 overflow-hidden rounded-md border border-border/60 bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={toImageSrc(s.image)} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium capitalize">{s.exercise}</span>
                  <Badge variant={db.v} className="text-[10px]">
                    {db.label}
                  </Badge>
                  <span className="ml-auto text-xs text-muted-foreground">{timeAgo(s.createdAt)}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground tabular-nums">
                  <span>{s.reps} reps</span>
                  <span>· depth {s.depth_degrees.toFixed(0)}°</span>
                  <span>· valgus {s.knee_valgus_score.toFixed(2)}</span>
                  <span>· asym {s.asymmetry_score.toFixed(2)}</span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

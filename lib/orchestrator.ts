// Server-only client for Luke's FastAPI orchestrator (Stream 2).
// Imported only from app/api/** route handlers.
import "server-only";
import type { ContextBatch, UserProfile } from "./types";
import { LLM_ORCHESTRATOR_URL } from "./env";

export type OrchestratorFix = { cue: string; priority: number };
export type OrchestratorCritique = {
  summary?: string;
  positives?: string[];
  fixes?: OrchestratorFix[];
};

export type AnalyzedResponse = {
  status: "analyzed";
  session_id: string;
  critique: OrchestratorCritique;
  avatar_injected: boolean;
  avatar_payloads: Array<{ event: string; text?: string }>;
  memory_snapshot: {
    recurring_issues: string[];
    trend: "improving" | "regressing" | "stable";
  };
};

export type BufferedResponse = {
  status: "buffered";
  pending_batches: number;
  seconds_until_ready: number;
};

export type OrchestratorAnalyzeResult = AnalyzedResponse | BufferedResponse;

export async function postAnalyze(
  userId: string,
  batch: ContextBatch
): Promise<OrchestratorAnalyzeResult> {
  const url = `${LLM_ORCHESTRATOR_URL}/analyze?user_id=${encodeURIComponent(userId)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(batch),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`orchestrator /analyze ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as OrchestratorAnalyzeResult;
}

export async function postOnboarding(userId: string, profile: UserProfile): Promise<void> {
  const url = `${LLM_ORCHESTRATOR_URL}/onboarding?user_id=${encodeURIComponent(userId)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`orchestrator /onboarding ${res.status}: ${text.slice(0, 200)}`);
  }
}

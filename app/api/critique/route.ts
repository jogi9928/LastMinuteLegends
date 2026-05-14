import { NextResponse } from "next/server";
import type { ContextBatch, Critique, UserProfile } from "@/lib/types";
import { postAnalyze, type AnalyzedResponse } from "@/lib/orchestrator";

// Bridge between Stream 3 frontend and Stream 2 (Luke) orchestrator.
// Frontend POSTs { contextBatch, userProfile, userId }.
// We forward the ContextBatch to Luke's /analyze?user_id=… and map his
// response shape onto the locked Critique contract.

type IncomingBody = {
  contextBatch: ContextBatch;
  userProfile: UserProfile;
  userId: string;
};

function pickPriorityOneFix(resp: AnalyzedResponse): string | null {
  const fixes = resp.critique.fixes ?? [];
  const p1 = fixes.find((f) => f.priority === 1);
  return p1?.cue ?? null;
}

function pickSpokenText(resp: AnalyzedResponse): string {
  // Prefer the avatar payload Luke would have spoken; fall back to top
  // priority-1 cue; fall back to the summary.
  const speakPayload = resp.avatar_payloads.find((p) => p.event === "avatar.speak_text");
  if (speakPayload?.text) return speakPayload.text;
  const p1 = pickPriorityOneFix(resp);
  if (p1) return p1;
  return resp.critique.summary?.trim() || "Form looks solid — keep going.";
}

function scoreFromFixes(resp: AnalyzedResponse): number {
  const fixes = resp.critique.fixes ?? [];
  if (fixes.length === 0) return 0.9;
  // Heuristic: each priority-1 fix is -0.25, priority-2 -0.12, priority-3 -0.05.
  let score = 0.95;
  for (const f of fixes) {
    if (f.priority === 1) score -= 0.25;
    else if (f.priority === 2) score -= 0.12;
    else score -= 0.05;
  }
  return Math.max(0.3, Math.min(1.0, score));
}

function tagsFromFixes(resp: AnalyzedResponse): string[] {
  const fixes = resp.critique.fixes ?? [];
  // Slugify cue text into rough tags so the dashboard's "Things to work on"
  // panel has something to count. Luke can ship structured tags later.
  return fixes.map((f) =>
    (f.cue || "").toLowerCase().split(/\s+/).slice(0, 3).join("_").replace(/[^a-z0-9_]/g, "")
  ).filter(Boolean);
}

export async function POST(req: Request) {
  let body: IncomingBody;
  try {
    body = (await req.json()) as IncomingBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const { contextBatch, userId } = body;
  if (!contextBatch || !userId) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  let upstream;
  try {
    upstream = await postAnalyze(userId, contextBatch);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "orchestrator_error";
    return NextResponse.json({ error: "orchestrator_unreachable", detail: msg }, { status: 502 });
  }

  if (upstream.status === "buffered") {
    // Luke is still buffering — no critique yet. Return 204 so the
    // frontend hook treats it as a no-op without trying to render it.
    return new NextResponse(null, { status: 204 });
  }

  const critique: Critique = {
    critique_text: pickSpokenText(upstream),
    form_score: scoreFromFixes(upstream),
    issues: tagsFromFixes(upstream),
    batch_index: contextBatch.batch_index,
  };

  return NextResponse.json(critique);
}

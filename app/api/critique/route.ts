import { NextResponse } from "next/server";
import type { Critique, CritiqueRequest } from "@/lib/types";

// MOCK — Stream 2 will replace this route with their LLM call.
// Rotates canned critiques, randomizes form_score, echoes batch_index so
// the frontend can correlate.

const CANNED: Array<{ text: string; issues: string[] }> = [
  { text: "Good depth on that rep — keep your chest up on the way back up.", issues: ["chest_drop"] },
  { text: "Drive through the heels. You're shifting onto your toes near the bottom.", issues: ["heel_lift"] },
  { text: "Watch the knee tracking on rep 3 — push the knees out over the toes.", issues: ["knee_valgus"] },
  { text: "Brace before each descent. The bar dipped right after liftoff.", issues: ["bracing"] },
  { text: "Clean tempo. Slow the eccentric one more count and you'll own this weight.", issues: ["tempo_fast"] },
  { text: "Left side is leading the lift. Reset and re-center under the bar.", issues: ["asymmetry"] },
  { text: "Lockout was strong. Stack the ribs over the hips at the top.", issues: ["ribflare"] },
  { text: "Beautiful rep. Stay tight through the next set.", issues: [] },
];

let cursor = 0;

export async function POST(req: Request) {
  let body: CritiqueRequest;
  try {
    body = (await req.json()) as CritiqueRequest;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const batchIdx = body?.contextBatch?.batch_index ?? cursor;
  const pick = CANNED[cursor % CANNED.length];
  cursor = (cursor + 1) % CANNED.length;

  // Simulate LLM latency: 250-600ms
  await new Promise((r) => setTimeout(r, 250 + Math.random() * 350));

  const critique: Critique = {
    critique_text: pick.text,
    form_score: Math.round((0.5 + Math.random() * 0.45) * 100) / 100,
    issues: [...pick.issues],
    batch_index: batchIdx,
  };
  return NextResponse.json(critique);
}

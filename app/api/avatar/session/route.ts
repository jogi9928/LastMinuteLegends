import { NextResponse } from "next/server";
import { createSessionToken } from "@/lib/liveavatar";

type Persona = "male" | "female";

export async function POST(req: Request) {
  let body: { avatar?: Persona };
  try {
    body = (await req.json()) as { avatar?: Persona };
  } catch {
    body = {};
  }
  const persona: Persona = body.avatar === "female" ? "female" : "male";

  try {
    const result = await createSessionToken(persona);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "liveavatar_error";
    // 503 if key is missing (so the frontend can fall back to the
    // placeholder gracefully), 502 if LiveAvatar itself errored.
    const status = msg.includes("HEYGEN_API_KEY") ? 503 : 502;
    return NextResponse.json({ error: msg }, { status });
  }
}

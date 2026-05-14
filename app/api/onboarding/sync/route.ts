import { NextResponse } from "next/server";
import type { UserProfile } from "@/lib/types";
import { postOnboarding } from "@/lib/orchestrator";

type IncomingBody = {
  userId: string;
  userProfile: UserProfile;
};

export async function POST(req: Request) {
  let body: IncomingBody;
  try {
    body = (await req.json()) as IncomingBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.userId || !body.userProfile) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  try {
    await postOnboarding(body.userId, body.userProfile);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "orchestrator_error";
    return NextResponse.json({ error: "orchestrator_unreachable", detail: msg }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}

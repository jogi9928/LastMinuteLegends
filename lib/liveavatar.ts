// Server-only client for LiveAvatar REST. Mints session tokens; the SDK
// in the browser uses the returned token directly.
import "server-only";
import {
  HEYGEN_API_KEY,
  LIVEAVATAR_AVATAR_ID_FEMALE,
  LIVEAVATAR_AVATAR_ID_MALE,
  LIVEAVATAR_BASE_URL,
  LIVEAVATAR_CONTEXT_ID,
  LIVEAVATAR_SANDBOX,
  LIVEAVATAR_SANDBOX_AVATAR_ID,
  LIVEAVATAR_VOICE_ID,
} from "./env";

type Persona = "male" | "female";

export interface SessionTokenResult {
  session_id: string;
  session_token: string;
  is_sandbox: boolean;
  avatar_id: string;
}

function pickAvatarId(persona: Persona): string {
  if (LIVEAVATAR_SANDBOX) return LIVEAVATAR_SANDBOX_AVATAR_ID;
  const override = persona === "male" ? LIVEAVATAR_AVATAR_ID_MALE : LIVEAVATAR_AVATAR_ID_FEMALE;
  return override || LIVEAVATAR_SANDBOX_AVATAR_ID;
}

export async function createSessionToken(persona: Persona): Promise<SessionTokenResult> {
  if (!HEYGEN_API_KEY) {
    throw new Error("HEYGEN_API_KEY not set");
  }

  const avatar_id = pickAvatarId(persona);
  const persona_block: Record<string, string> = { language: "en" };
  if (LIVEAVATAR_VOICE_ID) persona_block.voice_id = LIVEAVATAR_VOICE_ID;
  // Per the docs: missing context_id = silent avatar for user-driven speech,
  // but session.repeat()-driven speech still works. In sandbox we skip it
  // entirely. In production set LIVEAVATAR_CONTEXT_ID after creating one
  // via POST /v1/contexts (see embed-guide.md).
  if (!LIVEAVATAR_SANDBOX && LIVEAVATAR_CONTEXT_ID) {
    persona_block.context_id = LIVEAVATAR_CONTEXT_ID;
  }

  const body: Record<string, unknown> = {
    mode: "FULL",
    avatar_id,
    avatar_persona: persona_block,
  };
  if (LIVEAVATAR_SANDBOX) body.is_sandbox = true;

  const res = await fetch(`${LIVEAVATAR_BASE_URL}/v1/sessions/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": HEYGEN_API_KEY,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`liveavatar /sessions/token ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as { data?: { session_id: string; session_token: string } };
  if (!json.data?.session_id || !json.data?.session_token) {
    throw new Error("liveavatar /sessions/token returned no data");
  }
  return {
    session_id: json.data.session_id,
    session_token: json.data.session_token,
    is_sandbox: LIVEAVATAR_SANDBOX,
    avatar_id,
  };
}

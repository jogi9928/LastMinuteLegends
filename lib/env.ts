// Public env (safe in client bundles)
export const POSE_WS_URL =
  process.env.NEXT_PUBLIC_POSE_WS_URL ??
  "wss://4020-104-7-12-185.ngrok-free.app/stream";

// Server-only env. These are read only inside `app/api/**` route handlers,
// never in client components, so they don't leak into the browser bundle.
export const LLM_ORCHESTRATOR_URL =
  process.env.LLM_ORCHESTRATOR_URL ?? "http://localhost:8001";

export const LIVEAVATAR_BASE_URL =
  process.env.LIVEAVATAR_BASE_URL ?? "https://api.liveavatar.com";

export const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY ?? "";

// Sandbox mode skips context/voice setup and uses the public sandbox avatar.
// 1-min session cap, no credits used. Flip to false for real demos.
export const LIVEAVATAR_SANDBOX =
  (process.env.LIVEAVATAR_SANDBOX ?? "true").toLowerCase() !== "false";

// Hard-coded LiveAvatar sandbox avatar id (matches Luke's liveavatar.py).
export const LIVEAVATAR_SANDBOX_AVATAR_ID = "dd73ea75-1218-4ef3-92ce-606d5f7fbc0a";

// Optional overrides for non-sandbox sessions
export const LIVEAVATAR_AVATAR_ID_MALE = process.env.LIVEAVATAR_AVATAR_ID_MALE ?? "";
export const LIVEAVATAR_AVATAR_ID_FEMALE = process.env.LIVEAVATAR_AVATAR_ID_FEMALE ?? "";
export const LIVEAVATAR_VOICE_ID = process.env.LIVEAVATAR_VOICE_ID ?? "";
export const LIVEAVATAR_CONTEXT_ID = process.env.LIVEAVATAR_CONTEXT_ID ?? "";

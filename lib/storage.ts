import type { UserProfile } from "./types";
import type { Session } from "./local-types";

const PROFILE_KEY = "lml.profile";
const SESSIONS_KEY = "lml.sessions";
const LEGACY_KEYS = ["lml.onboarding", "lml.onboarding.draft"];

function safeGetItem(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* quota or disabled — ignore */
  }
}

function purgeLegacy() {
  if (typeof window === "undefined") return;
  for (const k of LEGACY_KEYS) {
    try {
      window.localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  }
}

export function getOnboarding(): UserProfile | null {
  purgeLegacy();
  const raw = safeGetItem(PROFILE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

export function setOnboarding(profile: UserProfile) {
  safeSetItem(PROFILE_KEY, JSON.stringify(profile));
}

export function hasCompletedOnboarding(): boolean {
  return getOnboarding() !== null;
}

export function getSessions(): Session[] {
  const raw = safeGetItem(SESSIONS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Session[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function setSessions(sessions: Session[]) {
  safeSetItem(SESSIONS_KEY, JSON.stringify(sessions));
}

export function addSession(session: Session) {
  const sessions = getSessions();
  sessions.unshift(session);
  setSessions(sessions);
}

export function getSessionById(id: string): Session | undefined {
  return getSessions().find((s) => s.id === id);
}

export function clearAll() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PROFILE_KEY);
  window.localStorage.removeItem(SESSIONS_KEY);
  purgeLegacy();
}

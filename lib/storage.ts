import type { OnboardingData, Session } from "./types";

const ONBOARDING_KEY = "lml.onboarding";
const SESSIONS_KEY = "lml.sessions";

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

export function getOnboarding(): OnboardingData | null {
  const raw = safeGetItem(ONBOARDING_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OnboardingData;
  } catch {
    return null;
  }
}

export function setOnboarding(data: OnboardingData) {
  safeSetItem(ONBOARDING_KEY, JSON.stringify(data));
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
  window.localStorage.removeItem(ONBOARDING_KEY);
  window.localStorage.removeItem(SESSIONS_KEY);
}

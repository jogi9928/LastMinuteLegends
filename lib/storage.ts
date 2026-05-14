import type { UserProfile, WorkoutSession } from "./types";

const PROFILE_KEY = "userProfile";
const SESSIONS_KEY = "workoutSessions";
const USER_ID_KEY = "userId";
const LEGACY_KEYS = [
  "lml.onboarding",
  "lml.onboarding.draft",
  "lml.profile",
  "lml.profile.draft",
  "lml.sessions",
];

function generateUserId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback: timestamp-based id (very unlikely to be hit in modern browsers)
  return `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getUserId(): string | null {
  return safeGetItem(USER_ID_KEY);
}

export function ensureUserId(): string {
  const existing = safeGetItem(USER_ID_KEY);
  if (existing) return existing;
  const fresh = generateUserId();
  safeSetItem(USER_ID_KEY, fresh);
  return fresh;
}

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

export function getUserProfile(): UserProfile | null {
  purgeLegacy();
  const raw = safeGetItem(PROFILE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

export function setUserProfile(profile: UserProfile) {
  safeSetItem(PROFILE_KEY, JSON.stringify(profile));
}

export function hasCompletedOnboarding(): boolean {
  return getUserProfile() !== null;
}

// Backward-compat aliases — onboarding page still calls these
export const getOnboarding = getUserProfile;
export const setOnboarding = setUserProfile;

export function getWorkoutSessions(): WorkoutSession[] {
  const raw = safeGetItem(SESSIONS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as WorkoutSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function setWorkoutSessions(sessions: WorkoutSession[]) {
  safeSetItem(SESSIONS_KEY, JSON.stringify(sessions));
}

export function addWorkoutSession(session: WorkoutSession) {
  const sessions = getWorkoutSessions();
  sessions.unshift(session);
  setWorkoutSessions(sessions);
}

export function clearAll() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PROFILE_KEY);
  window.localStorage.removeItem(SESSIONS_KEY);
  window.localStorage.removeItem(USER_ID_KEY);
  purgeLegacy();
}

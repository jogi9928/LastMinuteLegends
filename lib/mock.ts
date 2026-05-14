import type { Critique, WorkoutSession } from "./types";

const SAMPLE_CRITIQUES: Array<{ text: string; issues: string[] }> = [
  { text: "Good depth on that rep — keep your chest up on the way back up.", issues: ["chest_drop"] },
  { text: "Drive through the heels. You're shifting onto your toes near the bottom.", issues: ["heel_lift"] },
  { text: "Watch the knee tracking on rep 3 — push the knees out over the toes.", issues: ["knee_valgus"] },
  { text: "Brace before each descent. The bar dipped right after liftoff.", issues: ["bracing"] },
  { text: "Clean tempo. Slow the eccentric one more count and you'll own this weight.", issues: ["tempo_fast"] },
  { text: "Left side is leading the lift. Reset and re-center under the bar.", issues: ["asymmetry"] },
  { text: "Lockout was strong. Stack the ribs over the hips at the top.", issues: ["ribflare"] },
  { text: "Beautiful rep. Stay tight through the next set.", issues: [] },
];

const EXERCISES = ["squat", "bench", "deadlift", "pushup", "overhead_press", "row"];

function makeCritique(batch_index: number, scoreFloor = 0.55, scoreCeil = 0.95): Critique {
  const pick = SAMPLE_CRITIQUES[Math.floor(Math.random() * SAMPLE_CRITIQUES.length)];
  const form_score = Math.round((scoreFloor + Math.random() * (scoreCeil - scoreFloor)) * 100) / 100;
  return {
    critique_text: pick.text,
    form_score,
    issues: [...pick.issues],
    batch_index,
  };
}

export function makeMockCritique(batch_index: number): Critique {
  return makeCritique(batch_index);
}

function makeMockSession(opts: {
  daysAgo: number;
  exercise: string;
  critiqueCount: number;
  scoreFloor: number;
  scoreCeil: number;
}): WorkoutSession {
  const ended_at = Date.now() - opts.daysAgo * 24 * 60 * 60 * 1000;
  const started_at = ended_at - opts.critiqueCount * 2000;
  const critiques: Critique[] = Array.from({ length: opts.critiqueCount }, (_, i) =>
    makeCritique(i, opts.scoreFloor, opts.scoreCeil)
  );
  const avg_form_score =
    critiques.reduce((sum, c) => sum + c.form_score, 0) / Math.max(1, critiques.length);
  return {
    id: `seed-${opts.daysAgo}-${opts.exercise}`,
    exercise: opts.exercise,
    started_at,
    ended_at,
    critiques,
    avg_form_score: Math.round(avg_form_score * 100) / 100,
  };
}

export function mockWorkoutSessions(): WorkoutSession[] {
  const seeds = [
    { daysAgo: 18, exercise: "squat", critiqueCount: 10, scoreFloor: 0.45, scoreCeil: 0.7 },
    { daysAgo: 14, exercise: "squat", critiqueCount: 12, scoreFloor: 0.5, scoreCeil: 0.75 },
    { daysAgo: 10, exercise: "deadlift", critiqueCount: 9, scoreFloor: 0.55, scoreCeil: 0.8 },
    { daysAgo: 7, exercise: "squat", critiqueCount: 14, scoreFloor: 0.6, scoreCeil: 0.85 },
    { daysAgo: 4, exercise: "bench", critiqueCount: 11, scoreFloor: 0.65, scoreCeil: 0.9 },
    { daysAgo: 1, exercise: "squat", critiqueCount: 15, scoreFloor: 0.7, scoreCeil: 0.95 },
  ];
  return seeds.map(makeMockSession);
}

export function ensureSeededWorkoutSessions(existing: WorkoutSession[]): WorkoutSession[] {
  if (existing.length > 0) return existing;
  return mockWorkoutSessions();
}

export const EXERCISE_OPTIONS = EXERCISES;

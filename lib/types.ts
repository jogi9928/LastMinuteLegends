/**
 * SHARED CONTRACT — DO NOT MODIFY WITHOUT TEAM AGREEMENT
 * Used by Stream 2 (LLM/agent) and Stream 3 (frontend)
 * Last locked: 2026-05-14
 */

export type UserProfile = {
  goal: "aesthetics" | "strength" | "general_fitness";
  avatar: "male" | "female";
  experience: {
    years: number;
    intensity: "beginner" | "intermediate" | "advanced";
  };
  age: number;
  injuries: string[];
  equipment: "full_gym" | "home_setup" | "dumbbells" | "bodyweight";
  frequency_per_week: number;
  baseline: {
    weight: number; // in lbs
    height: number; // in inches
  };
};

export type FormAnalysis = {
  exercise: string;
  reps: number;
  depth_degrees: number;
  knee_valgus_score: number;
  tempo_eccentric_sec: number;
  asymmetry_score: number;
  frame_issues: string[];
  image: string; // base64
};

export type CritiqueRequest = {
  formAnalysis: FormAnalysis;
  userProfile: UserProfile;
};

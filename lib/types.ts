export type Exercise = "squat" | "pushup" | "deadlift" | "bench" | "lunge";

export interface FormAnalysis {
  exercise: string;
  reps: number;
  depth_degrees: number;
  knee_valgus_score: number;
  tempo_eccentric_sec: number;
  asymmetry_score: number;
  frame_issues: string[];
  image: string;
}

export interface Session extends FormAnalysis {
  id: string;
  createdAt: string;
}

export type Goal = "aesthetics" | "strength" | "general";
export type Avatar = "male" | "female";
export type Intensity = "beginner" | "intermediate" | "advanced";
export type Equipment = "full_gym" | "home_setup" | "dumbbells" | "bodyweight";
export type CalibrationExercise = "bodyweight_squat" | "pushup";

export interface OnboardingData {
  name?: string;
  goal: Goal;
  avatar: Avatar;
  experienceYears: number;
  intensity: Intensity;
  age: number;
  injuries: string[];
  injuriesOther: string;
  equipment: Equipment;
  daysPerWeek: number;
  weightKg: number;
  heightCm: number;
  calibration: CalibrationExercise;
  completedAt: string;
}

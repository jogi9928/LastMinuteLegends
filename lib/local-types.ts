import type { FormAnalysis } from "./types";

export type Session = FormAnalysis & {
  id: string;
  createdAt: string;
};

export type CalibrationExercise = "bodyweight_squat" | "pushup";

/**
 * SHARED CONTRACT — DO NOT MODIFY WITHOUT TEAM AGREEMENT
 * Used by Stream 2 (LLM/agent) and Stream 3 (frontend)
 * Updated: pivoted to streaming architecture
 */

export type UserProfile = {
  goal: "aesthetics" | "strength" | "general_fitness";
  avatar: "male" | "female";
  experience: { years: number; intensity: "beginner" | "intermediate" | "advanced" };
  age: number;
  injuries: string[];
  equipment: "full_gym" | "home_setup" | "dumbbells" | "bodyweight";
  frequency_per_week: number;
  baseline: { weight: number; height: number };
};

// COCO-17 keypoint
export type Keypoint = {
  x: number; // 0-1 normalized
  y: number; // 0-1 normalized
  confidence: number; // 0-1
  visible: boolean;
};

export type KeypointFrame = {
  nose: Keypoint;
  left_eye: Keypoint;
  right_eye: Keypoint;
  left_ear: Keypoint;
  right_ear: Keypoint;
  left_shoulder: Keypoint;
  right_shoulder: Keypoint;
  left_elbow: Keypoint;
  right_elbow: Keypoint;
  left_wrist: Keypoint;
  right_wrist: Keypoint;
  left_hip: Keypoint;
  right_hip: Keypoint;
  left_knee: Keypoint;
  right_knee: Keypoint;
  left_ankle: Keypoint;
  right_ankle: Keypoint;
};

// What Aadya's WebSocket emits every send_interval seconds
export type ContextBatch = {
  exercise: string | null;
  timestamp: number;
  window_seconds: number;
  frame_count: number;
  keypoints_sequence: KeypointFrame[];
  sampled_images: string[]; // base64 JPEGs with skeleton overlay
  batch_index: number;
};

// Session config sent to Aadya's WebSocket on open
export type SessionConfig = {
  exercise: string;
  send_interval?: number; // default 2.0
  window_seconds?: number; // default 2.0
  sampled_images?: number; // default 4
  jpeg_quality?: number; // default 70
  conf_threshold?: number; // default 0.3
};

// What we send to Stream 2's LLM endpoint
export type CritiqueRequest = {
  contextBatch: ContextBatch;
  userProfile: UserProfile;
};

// What Stream 2's LLM endpoint returns
export type Critique = {
  critique_text: string; // shown in UI and spoken by HeyGen
  form_score: number; // 0-1, for dashboard charts
  issues: string[]; // discrete issue tags for history
  batch_index: number; // echo back so we can correlate
};

// A completed workout session, stored in localStorage for dashboard history
export type WorkoutSession = {
  id: string;
  exercise: string;
  started_at: number;
  ended_at: number;
  critiques: Critique[];
  avg_form_score: number;
};

import type { FormAnalysis, Session } from "./types";

function makeKeyframeSvg(opts: {
  label: string;
  depth: number;
  valgus: number;
  hue?: number;
}): string {
  const hue = opts.hue ?? 150;
  const depthY = 220 + Math.max(0, 110 - opts.depth) * 1.4;
  const kneeOffset = opts.valgus * 28;
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 320" width="480" height="320">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="hsl(${hue},40%,12%)"/>
      <stop offset="100%" stop-color="hsl(${(hue + 40) % 360},30%,6%)"/>
    </linearGradient>
    <radialGradient id="spot" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="hsl(${hue},80%,55%)" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="hsl(${hue},80%,55%)" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="480" height="320" fill="url(#bg)"/>
  <rect width="480" height="320" fill="url(#spot)"/>
  <g stroke="hsl(${hue},90%,65%)" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="240" cy="90" r="22" fill="hsl(${hue},90%,65%)" fill-opacity="0.15"/>
    <line x1="240" y1="112" x2="240" y2="${depthY - 50}"/>
    <line x1="240" y1="${depthY - 50}" x2="${210 + kneeOffset}" y2="${depthY}"/>
    <line x1="240" y1="${depthY - 50}" x2="${270 - kneeOffset}" y2="${depthY}"/>
    <line x1="${210 + kneeOffset}" y1="${depthY}" x2="200" y2="290"/>
    <line x1="${270 - kneeOffset}" y1="${depthY}" x2="280" y2="290"/>
    <line x1="240" y1="140" x2="180" y2="${depthY - 60}"/>
    <line x1="240" y1="140" x2="300" y2="${depthY - 60}"/>
    <rect x="150" y="${depthY - 70}" width="180" height="14" rx="6" fill="hsl(${hue},90%,65%)" fill-opacity="0.2"/>
  </g>
  <g fill="hsl(${hue},20%,80%)" font-family="Inter, sans-serif" font-size="14">
    <text x="20" y="30" font-weight="700" font-size="16">${opts.label}</text>
    <text x="20" y="50" opacity="0.7">depth ${opts.depth.toFixed(0)}° · valgus ${opts.valgus.toFixed(2)}</text>
  </g>
</svg>`.trim();
  if (typeof window === "undefined") {
    return Buffer.from(svg).toString("base64");
  }
  return btoa(unescape(encodeURIComponent(svg)));
}

export function toImageSrc(image: string): string {
  if (!image) return "";
  if (image.startsWith("data:")) return image;
  return `data:image/svg+xml;base64,${image}`;
}

export function mockAnalyze(exercise = "squat"): FormAnalysis {
  const reps = 8 + Math.floor(Math.random() * 5);
  const depth = 88 + Math.random() * 18;
  const valgus = Math.max(0, Math.min(1, 0.18 + (Math.random() - 0.5) * 0.4));
  const tempo = 1.0 + Math.random() * 1.4;
  const asym = Math.max(0, Math.min(1, 0.1 + (Math.random() - 0.5) * 0.3));

  const issues: string[] = [];
  if (depth > 100) issues.push(`depth insufficient on rep ${reps - 1}`);
  if (valgus > 0.35) issues.push(`knee valgus on rep ${Math.max(1, reps - 2)}`);
  if (asym > 0.25) issues.push(`right-side dominance on rep ${reps}`);
  if (tempo < 0.9) issues.push("eccentric phase too fast — slow the descent");
  if (issues.length === 0) issues.push("clean rep pattern — keep stacking volume");

  return {
    exercise,
    reps,
    depth_degrees: Math.round(depth * 10) / 10,
    knee_valgus_score: Math.round(valgus * 100) / 100,
    tempo_eccentric_sec: Math.round(tempo * 10) / 10,
    asymmetry_score: Math.round(asym * 100) / 100,
    frame_issues: issues,
    image: makeKeyframeSvg({ label: `${exercise.toUpperCase()} · keyframe`, depth, valgus, hue: 150 }),
  };
}

export function mockSessions(): Session[] {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const seeds: Array<{ daysAgo: number; depth: number; valgus: number; tempo: number; asym: number; reps: number; hue: number }> = [
    { daysAgo: 18, depth: 112, valgus: 0.48, tempo: 0.8, asym: 0.32, reps: 8, hue: 10 },
    { daysAgo: 14, depth: 106, valgus: 0.41, tempo: 0.9, asym: 0.28, reps: 8, hue: 30 },
    { daysAgo: 10, depth: 101, valgus: 0.35, tempo: 1.0, asym: 0.22, reps: 9, hue: 60 },
    { daysAgo: 7, depth: 96, valgus: 0.28, tempo: 1.1, asym: 0.18, reps: 10, hue: 90 },
    { daysAgo: 4, depth: 93, valgus: 0.22, tempo: 1.2, asym: 0.14, reps: 10, hue: 120 },
    { daysAgo: 1, depth: 90, valgus: 0.18, tempo: 1.3, asym: 0.11, reps: 12, hue: 150 },
  ];

  return seeds.map((s, i) => {
    const createdAt = new Date(now - s.daysAgo * day).toISOString();
    const issues: string[] = [];
    if (s.depth > 100) issues.push(`depth insufficient on rep ${s.reps - 1}`);
    if (s.valgus > 0.35) issues.push(`knee valgus on rep ${s.reps - 2}`);
    if (s.asym > 0.25) issues.push("right-side dominance");
    if (issues.length === 0) issues.push("clean reps");
    return {
      id: `seed-${i}`,
      createdAt,
      exercise: "squat",
      reps: s.reps,
      depth_degrees: s.depth,
      knee_valgus_score: s.valgus,
      tempo_eccentric_sec: s.tempo,
      asymmetry_score: s.asym,
      frame_issues: issues,
      image: makeKeyframeSvg({ label: `SQUAT · ${s.daysAgo}d ago`, depth: s.depth, valgus: s.valgus, hue: s.hue }),
    };
  });
}

export function ensureSeededSessions(existing: Session[]): Session[] {
  if (existing.length > 0) return existing;
  return mockSessions();
}

# LastMinuteLegends

AI fitness coach — HeyGen Hackathon.

## Stream 3 — Frontend

Next.js 14 (App Router, TypeScript), Tailwind, hand-written shadcn/ui
primitives, Recharts. Dark-mode default with an emerald accent.

### Run

```bash
npm install
npm run dev
```

Open http://localhost:3000. The root route redirects to `/onboarding`
on first load (or `/dashboard` if you've completed onboarding once).

### Routes

- `/onboarding` — 9-step guided setup; draft autosaved to localStorage
- `/dashboard` — greeting, goal/frequency badges, four progress charts
  (depth, knee valgus, asymmetry, eccentric tempo), recent sessions list
- `/workout` — camera capture via `getUserMedia` + `MediaRecorder`
- `/workout/result` — side-by-side video + keyframe, metrics grid,
  frame-level issues, HeyGen avatar placeholder slot
- `/compare` — pick two sessions, side-by-side keyframes, metric deltas

### Data contract (mocked)

All backend calls are mocked in `lib/mock.ts` against the fixed shape:

```jsonc
{
  "exercise": "squat",
  "reps": 10,
  "depth_degrees": 95,
  "knee_valgus_score": 0.3,
  "tempo_eccentric_sec": 1.2,
  "asymmetry_score": 0.15,
  "frame_issues": ["knee valgus on rep 8"],
  "image": "base64..."
}
```

`/workout` simulates a 2.5s analyze, then routes to `/workout/result`
with the result stashed in `sessionStorage`. `lib/storage.ts` persists
onboarding + completed sessions in `localStorage`.

### Stream integration hooks

- **HeyGen (Stream 2):** `/workout/result` renders a placeholder slot
  marked `data-slot="heygen-avatar"` — target that for embedding.
- **Backend (Stream 1):** replace the call to `mockAnalyze()` in
  `app/workout/page.tsx` with a real `fetch()`. The shape of
  `FormAnalysis` in `lib/types.ts` is the contract.

### Demo controls

The dashboard header has a logout-style icon button that clears local
state — useful for re-running the onboarding flow during a demo.

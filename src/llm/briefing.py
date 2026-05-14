import os

# STREAM 3 MOD (integration-live-agent): swapped Anthropic → Gemini.
# Prompt and output shape unchanged from Luke's original.
from google import genai
from google.genai import types

client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

MODEL = os.environ.get("GEMINI_BRIEFING_MODEL", "gemini-2.5-flash")


def generate_briefing(
    exercise: str,
    user_profile: dict,
    recurring_issues: list[str] | None = None,
    last_critique: dict | None = None,
) -> str:
    injuries = user_profile.get("injuries", [])
    goal = user_profile.get("goal", "general_fitness")
    intensity = user_profile.get("experience", {}).get("intensity", "beginner")

    injury_note = f"User has reported injuries: {', '.join(injuries)}." if injuries else ""
    recurring_note = ""
    if recurring_issues:
        recurring_note = f"Recurring issues to emphasise: {', '.join(recurring_issues)}."

    last_cues = ""
    if last_critique:
        top_fixes = sorted(last_critique.get("fixes", []), key=lambda f: f.get("priority", 99))[:2]
        if top_fixes:
            last_cues = "Key cues from last session: " + "; ".join(f["cue"] for f in top_fixes) + "."

    prompt = f"""You are a motivating strength coach giving a 10-second pre-set reminder to an athlete.

Context:
- Exercise: {exercise}
- Goal: {goal}
- Experience: {intensity}
- {injury_note}
- {recurring_note}
- {last_cues}

Write ONE short, punchy reminder (max 25 words) the athlete should think about before starting this set.
Be specific to the exercise and their history. No fluff. Return plain text only."""

    response = client.models.generate_content(
        model=MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.5,
            max_output_tokens=80,
        ),
    )

    return (response.text or "").strip()

import os
import json
import anthropic

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

MODEL = "claude-haiku-4-5"


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

    message = client.messages.create(
        model=MODEL,
        max_tokens=60,
        messages=[{"role": "user", "content": prompt}],
    )

    return message.content[0].text.strip()

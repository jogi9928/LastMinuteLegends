import os
import json
import anthropic

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

MODEL = "claude-haiku-4-5"

KEYPOINTS_FRAMES_PER_BATCH = 8
LOW_CONFIDENCE_FRAME_THRESHOLD = 5

SYSTEM_PROMPT = (
    "You are an expert strength and conditioning coach analysing a live gym set. "
    "You receive a short clip as a sequence of skeleton-overlay images and the "
    "underlying MoveNet keypoint motion data (normalised x/y/confidence, COCO-17). "
    "Identify what the lifter is doing, evaluate form against safe technique, and "
    "respond with one or two actionable cues. Be brief and encouraging."
)


def _downsample(seq: list, n: int) -> list:
    if not seq or len(seq) <= n:
        return seq
    step = max(1, len(seq) // n)
    return seq[::step][:n]


def _is_low_confidence(batches: list[dict]) -> bool:
    if not batches:
        return True
    total_frames = sum(b.get("frame_count", 0) or 0 for b in batches)
    return total_frames < LOW_CONFIDENCE_FRAME_THRESHOLD


def _build_text_block(
    batches: list[dict],
    user_profile: dict | None,
    recent_sessions: list[dict] | None,
    recurring_issues: list[str] | None,
    last_spoken_cues: list[str] | None,
) -> str:
    exercise = batches[0].get("exercise") if batches else "unknown"
    total_window = sum((b.get("window_seconds") or 0) for b in batches)
    image_count = sum(len(b.get("sampled_images") or []) for b in batches)

    profile_section = ""
    if user_profile:
        injuries = user_profile.get("injuries", [])
        exp = user_profile.get("experience") or {}
        profile_section = (
            "\n## User Profile\n"
            f"- Goal: {user_profile.get('goal', 'general_fitness')}\n"
            f"- Experience: {exp.get('intensity', 'beginner')} ({exp.get('years', 0)} yrs)\n"
            f"- Age: {user_profile.get('age', 'unknown')}\n"
            f"- Injuries: {', '.join(injuries) or 'none'}\n"
            f"- Equipment: {user_profile.get('equipment', 'unknown')}\n"
        )

    memory_section = ""
    if recent_sessions:
        summaries = [s["critique_summary"] for s in recent_sessions if s.get("critique_summary")]
        if summaries:
            memory_section += "\n## Recent Session History (oldest → newest)\n"
            for s in summaries[-3:]:
                memory_section += f"- {s}\n"
    if recurring_issues:
        memory_section += "\n## Recurring Issues (seen 2+ sessions — escalate to priority 1)\n"
        for issue in recurring_issues:
            memory_section += f"- {issue}\n"

    spoken_section = ""
    if last_spoken_cues:
        spoken_section = "\n## Recently Spoken Cues (avatar said these in the last 1-2 calls)\n"
        for c in last_spoken_cues:
            spoken_section += f"- {c}\n"
        spoken_section += (
            "Do NOT repeat these verbatim. If the same flaw clearly persists, "
            "rephrase with a different angle (different body part focus, sensation, "
            "or external cue). If the lifter has corrected it, acknowledge briefly "
            "in `positives` and move on. If nothing new is wrong, return `fixes: []`.\n"
        )

    motion_blocks = []
    for i, b in enumerate(batches):
        sampled = _downsample(b.get("keypoints_sequence") or [], KEYPOINTS_FRAMES_PER_BATCH)
        motion_blocks.append(
            f"### Batch {i + 1} ({(b.get('window_seconds') or 0):.1f}s, "
            f"{b.get('frame_count', 0)} frames)\n"
            f"```json\n{json.dumps(sampled)}\n```"
        )

    return (
        f"Analysing ~{total_window:.1f}s of motion for {exercise}. "
        f"{image_count} skeleton-overlay images precede this text in temporal order.\n"
        f"{profile_section}{memory_section}{spoken_section}\n"
        "## Motion Data (downsampled keypoint frames)\n"
        + "\n\n".join(motion_blocks)
        + "\n\n"
        "Respond ONLY with a JSON object matching this exact schema — no markdown, no extra text:\n"
        "{\n"
        '  "summary": "<≤25-word overall assessment>",\n'
        '  "positives": ["<strength observed>"],\n'
        '  "fixes": [\n'
        '    {"cue": "<verb-first actionable cue>", "priority": <1-3 where 1=highest>}\n'
        "  ]\n"
        "}\n\n"
        "Rules:\n"
        "- Priority 1 = safety/injury risk (spoken mid-set), 2 = major performance loss, 3 = refinement\n"
        "- Cues MUST start with a verb (\"Drive…\", \"Brace…\", \"Sit…\"); no vague observations\n"
        "- If user has injuries, elevate any related issue to priority 1\n"
        "- If an issue appears in recurring_issues, escalate it to priority 1 regardless of severity\n"
        "- Do NOT repeat any cue from \"Recently Spoken Cues\" verbatim — change angle or stay silent\n"
        "- Summary: ≤25 words, no filler\n"
        "- Positives: 0-2 items, each ≤10 words\n"
        "- Fixes: 0-4 items — empty list is valid when form is clean or only the recently-spoken issue persists\n"
        "- Acknowledge trend from session history only if clearly improving or worsening"
    )


def _low_confidence_response() -> dict:
    return {
        "summary": "Camera barely caught that — frame yourself fully and we'll dial in form cues next set.",
        "positives": ["You showed up and put in the work"],
        "fixes": [
            {"cue": "Set up the camera at hip height, 3-4 feet to your side for clear form feedback", "priority": 3}
        ],
    }


def _parse_critique_response(raw: str) -> dict:
    """Parse Claude's response into the critique schema, tolerating markdown fences
    and surrounding prose. Falls back to a safe default rather than crashing.
    """
    text = raw.strip()
    # Strip ```json ... ``` or ``` ... ``` fences
    if text.startswith("```"):
        text = text[3:]
        if text.lower().startswith("json"):
            text = text[4:]
        text = text.strip("`").strip()
    # First try direct
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Try to slice the first balanced {...} block
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end > start:
        try:
            return json.loads(text[start:end + 1])
        except json.JSONDecodeError:
            pass
    # Last resort: keep the pipeline alive
    return {
        "summary": "Form analysis unavailable - model returned unparseable output. Keep your set safe and steady.",
        "positives": ["You completed the rep"],
        "fixes": [
            {"cue": "Continue with current form; feedback will sharpen as more data comes in.", "priority": 3}
        ],
        "_parse_error": True,
    }


def run_critique(
    batches: list[dict],
    user_profile: dict | None = None,
    recent_sessions: list[dict] | None = None,
    recurring_issues: list[str] | None = None,
    last_spoken_cues: list[str] | None = None,
) -> dict:
    """Analyse 1-2 ContextBatches (~2-4s of motion) and return critique JSON.

    Multimodal: each batch's sampled_images become image blocks; the
    keypoints_sequence is downsampled and joined into a single text block.
    `last_spoken_cues` are the priority-1 cues the avatar said in recent
    calls — passed in so the model rephrases instead of repeating verbatim.
    """
    if _is_low_confidence(batches):
        return _low_confidence_response()

    content = []
    for b in batches:
        for img in (b.get("sampled_images") or []):
            content.append({
                "type": "image",
                "source": {"type": "base64", "media_type": "image/jpeg", "data": img},
            })
    content.append({
        "type": "text",
        "text": _build_text_block(
            batches, user_profile, recent_sessions, recurring_issues, last_spoken_cues
        ),
    })

    n_images = sum(1 for c in content if c.get("type") == "image")
    n_keypoint_frames = sum(len(b.get("keypoints_sequence") or []) for b in batches)
    print(f"[critique] -> Claude  images={n_images}  keypoint_frames={n_keypoint_frames}  batches={len(batches)}")

    message = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=[
            {"role": "user", "content": content},
            {"role": "assistant", "content": "{"},
        ],
    )

    raw = "{" + message.content[0].text
    return _parse_critique_response(raw)


RECAP_SYSTEM_PROMPT = (
    "You are a strength coach giving a short post-workout debrief. "
    "You receive a list of minor form cues (priority 2-3) that came up during "
    "the session but were not spoken to the lifter mid-set. Consolidate them: "
    "merge duplicates, keep what's recurrent or impactful, drop noise."
)


def _empty_recap() -> dict:
    return {
        "summary": "Clean session — nothing minor worth flagging.",
        "top_fixes": [],
        "next_session_focus": "Keep the same setup and intent next time.",
    }


def run_post_workout_recap(
    small_fixes: list[dict],
    user_profile: dict | None = None,
) -> dict:
    """Consolidate accumulated priority 2-3 cues from a workout into 1-3
    final coaching points for the user to hear after the set ends.

    Input `small_fixes`: list of {"cue": str, "priority": int} dicts captured
    across the workout. Returns:
        {
          "summary": str,                   # ≤30 words
          "top_fixes": [{cue, priority}],   # 0-3 consolidated cues
          "next_session_focus": str         # one short sentence
        }
    """
    if not small_fixes:
        return _empty_recap()

    profile_section = ""
    if user_profile:
        injuries = user_profile.get("injuries", [])
        exp = user_profile.get("experience") or {}
        profile_section = (
            "\n## User Profile\n"
            f"- Goal: {user_profile.get('goal', 'general_fitness')}\n"
            f"- Experience: {exp.get('intensity', 'beginner')} ({exp.get('years', 0)} yrs)\n"
            f"- Injuries: {', '.join(injuries) or 'none'}\n"
        )

    cue_lines = "\n".join(
        f"- (p{f.get('priority', 3)}) {f.get('cue', '').strip()}"
        for f in small_fixes
        if f.get("cue")
    )

    user_text = (
        f"Workout produced {len(small_fixes)} minor cues across the session.\n"
        f"{profile_section}\n"
        "## Captured Cues\n"
        f"{cue_lines}\n\n"
        "Respond ONLY with a JSON object — no markdown, no prose:\n"
        "{\n"
        '  "summary": "<≤30-word debrief>",\n'
        '  "top_fixes": [\n'
        '    {"cue": "<verb-first cue>", "priority": <2 or 3>}\n'
        "  ],\n"
        '  "next_session_focus": "<one short sentence>"\n'
        "}\n\n"
        "Rules:\n"
        "- 1-3 fixes max — merge near-duplicates into a single cleaner cue\n"
        "- Order top_fixes by impact (most important first)\n"
        "- Cues must be verb-first and specific\n"
        "- Tone: encouraging and direct, not preachy"
    )

    message = client.messages.create(
        model=MODEL,
        max_tokens=512,
        system=RECAP_SYSTEM_PROMPT,
        messages=[
            {"role": "user", "content": user_text},
            {"role": "assistant", "content": "{"},
        ],
    )

    raw = "{" + message.content[0].text
    parsed = _parse_critique_response(raw)
    # _parse_critique_response returns a critique-shaped fallback on failure;
    # normalize to recap shape.
    if "top_fixes" not in parsed:
        return {
            "summary": parsed.get("summary", "Recap unavailable."),
            "top_fixes": parsed.get("fixes", [])[:3],
            "next_session_focus": "Repeat today's setup; we'll refine next session.",
            "_parse_error": parsed.get("_parse_error", False),
        }
    parsed["top_fixes"] = parsed.get("top_fixes", [])[:3]
    return parsed

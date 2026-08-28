"""
AI-drafted narrative summary of the Stakeholder dashboard aggregates.

Turns the numbers `/api/stakeholder/overview` already computes into two
short paragraphs of plain prose via one Gemini API call. The model only
*phrases* the report — every figure is computed by this application and
handed to it pre-formatted; the prompt forbids inventing or extrapolating
numbers, so a wrong figure in the output is a prompt bug, not a data bug.

Entirely optional at runtime, same posture as CLIP/EasyOCR: if
GEMINI_API_KEY is unset or the call fails, callers get None and the
dashboard simply renders without the summary card — never an error.

Results are cached in-process, keyed by a hash of the input figures, so
repeated dashboard loads don't re-bill the API while the data hasn't
changed. The TTL (AI_SUMMARY_CACHE_TTL_SECONDS) exists only to bound the
cache's size over time, not for freshness — a data change always misses
the cache immediately because the key changes with the figures.
"""

import hashlib
import json
import logging
import re
import time
from dataclasses import dataclass

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

GEMINI_ENDPOINT = (
    "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
)
REQUEST_TIMEOUT_SECONDS = 20.0

# {figures_hash: (summary_text, expires_at_monotonic)}
_cache: dict[str, tuple[str, float]] = {}


@dataclass
class SummaryResult:
    summary: str
    model: str
    cached: bool


# The style rules below are the anti-"AI slop" contract: no markdown, no
# bullet lists, no boilerplate openers/closers, no filler adjectives —
# and only the figures provided, so the text reads like a programme
# officer's briefing note rather than a chatbot answer. _tidy() enforces
# the formatting rules again after the fact in case the model slips.
_STYLE_RULES = """\
Write the summary as exactly two short paragraphs of plain prose, 60 to 120 words in total.

Hard rules:
- Use ONLY the figures provided above. Never invent, estimate, extrapolate, or re-derive a number.
- Plain text only: no headings, no bullet points, no numbered lists, no markdown symbols, no emojis.
- Name specific districts and figures rather than writing vaguely ("Pune accounts for 3 of 4 high-risk submissions", not "some districts show elevated risk").
- Do not open with "This report", "This summary", "Overall" or any sentence describing the document itself. Start directly with a finding.
- Banned phrases and their variants: "it is worth noting", "in conclusion", "moving forward", "continued monitoring is recommended", "robust", "landscape", "delve", "underscore", "highlight the importance".
- No recommendations and no praise — state what the figures show and stop.
- If submission volume is small, say so plainly instead of drawing trend conclusions from it.
- Write in the direct, factual register of an internal government programme briefing."""


def _figures_hash(figures_text: str) -> str:
    return hashlib.sha256(f"{settings.GEMINI_MODEL}\n{figures_text}".encode()).hexdigest()


def _format_figures(overview: dict) -> str:
    """Render the overview dict as pre-computed, labelled facts.

    Handing the model finished sentences-worth of numbers (rather than raw
    JSON) is deliberate: it leaves no arithmetic for the model to attempt,
    which is where LLM summaries usually go wrong.
    """
    lines = [f"Total submissions: {overview.get('total_submissions', 0)}"]

    by_status = overview.get("by_status") or {}
    if by_status:
        lines.append(
            "By workflow status: "
            + ", ".join(f"{k} {v}" for k, v in by_status.items() if v)
        )

    by_risk = overview.get("by_risk_level") or {}
    if by_risk:
        lines.append(
            "By automated risk level: "
            + ", ".join(f"{k} {v}" for k, v in by_risk.items())
        )

    lines.append(
        f"Share of submissions that reached a final decision: {overview.get('completion_rate', 0.0)}%"
    )

    avg_hours = overview.get("avg_hours_to_decision")
    if avg_hours is not None:
        lines.append(f"Average hours from upload to reviewer decision: {avg_hours}")

    daily = overview.get("daily_volume") or []
    if daily:
        total_14d = sum(d.get("count", 0) for d in daily)
        peak = max(daily, key=lambda d: d.get("count", 0))
        lines.append(
            f"Submissions in the last 14 days: {total_14d}"
            f" (busiest day {peak.get('date')} with {peak.get('count')})"
        )
    else:
        lines.append("Submissions in the last 14 days: 0")

    districts = overview.get("top_flagged_districts") or []
    if districts:
        lines.append(
            "Districts by HIGH-risk submission count: "
            + ", ".join(f"{d.get('district')} {d.get('high_risk_count')}" for d in districts)
        )

    return "\n".join(lines)


def _build_prompt(overview: dict) -> str:
    return (
        "You are drafting the opening narrative of an internal oversight report "
        "for India's MPLADS scheme (Members of Parliament Local Area Development "
        "Scheme). The reader is a district programme officer who already knows "
        "the scheme; the figures below summarise work-completion photo "
        "submissions and their automated fraud-risk assessment.\n\n"
        f"Figures (the only numbers you may use):\n{_format_figures(overview)}\n\n"
        f"{_STYLE_RULES}"
    )


def _call_gemini(prompt: str) -> str:
    """One generateContent call. Raises on any HTTP or shape problem."""
    response = httpx.post(
        GEMINI_ENDPOINT.format(model=settings.GEMINI_MODEL),
        headers={"x-goog-api-key": settings.GEMINI_API_KEY},
        json={
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 1024,
                # The summary needs phrasing, not reasoning — spending
                # "thinking" tokens here only adds latency and cost.
                "thinkingConfig": {"thinkingBudget": 0},
            },
        },
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    body = response.json()
    text = body["candidates"][0]["content"]["parts"][0]["text"]
    if not text.strip():
        raise ValueError("Gemini returned an empty summary")
    return text


def _tidy(text: str) -> str:
    """Strip any markdown the model produced despite the prompt."""
    text = re.sub(r"[*_`#]+", "", text)
    # A leading list marker on a line ("- " / "1. ") becomes plain prose.
    text = re.sub(r"^\s*(?:[-•]|\d+[.)])\s+", "", text, flags=re.MULTILINE)
    # Collapse 3+ newlines to a paragraph break, trim trailing spaces.
    text = re.sub(r"\n{3,}", "\n\n", text)
    return "\n".join(line.rstrip() for line in text.splitlines()).strip()


def generate_overview_summary(overview: dict) -> SummaryResult | None:
    """Produce (or reuse) the narrative summary for one overview snapshot.

    Returns None when the feature is unconfigured or the API call fails —
    the caller degrades to numbers-only, mirroring how the risk pipeline
    records a skipped CLIP/OCR layer instead of erroring.
    """
    if not settings.GEMINI_API_KEY:
        return None

    figures_text = _format_figures(overview)
    key = _figures_hash(figures_text)
    now = time.monotonic()

    cached = _cache.get(key)
    if cached and cached[1] > now:
        return SummaryResult(summary=cached[0], model=settings.GEMINI_MODEL, cached=True)

    try:
        summary = _tidy(_call_gemini(_build_prompt(overview)))
    except Exception as exc:  # network, HTTP status, or response shape
        logger.warning("AI summary generation failed: %s", exc)
        return None

    # Drop expired entries so the cache can't grow unboundedly across
    # many distinct data snapshots.
    for stale_key in [k for k, (_, exp) in _cache.items() if exp <= now]:
        del _cache[stale_key]
    _cache[key] = (summary, now + settings.AI_SUMMARY_CACHE_TTL_SECONDS)

    return SummaryResult(summary=summary, model=settings.GEMINI_MODEL, cached=False)

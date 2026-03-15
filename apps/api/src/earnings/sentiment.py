"""
Sentiment scoring for earnings press release outlook sections.

Uses Claude to score management tone from the outlook/forward-looking
section of SEC EDGAR Exhibit 99.1 press releases.
"""

import json
import logging

from sqlalchemy.orm import Session

from src.earnings.models import Transcript, TranscriptChunk

logger = logging.getLogger(__name__)

_SENTIMENT_PROMPT = """You are analyzing the outlook/forward-looking section of an earnings press release.

Score the management tone on a scale of 0-100 where:
- 90-100: Very positive — strong growth, raised guidance, confident language
- 70-89: Positive — beats expectations, optimistic tone, modest growth outlook
- 50-69: Neutral — in-line results, mixed signals, cautious optimism
- 30-49: Cautious — headwinds mentioned, hedging language, lowered or withdrawn guidance
- 0-29: Negative — significant challenges, missed targets, declining outlook

Look for:
- Explicit guidance (raised/lowered/maintained/withdrawn)
- Hedging language ("we believe", "subject to", "may", "could", "uncertain")
- Confidence markers ("we are confident", "strong demand", "accelerating")
- Risk language ("challenging", "headwinds", "macro uncertainty", "softness")

Respond with JSON only:
{
  "score": <integer 0-100>,
  "label": <"positive" | "neutral" | "cautious" | "negative">,
  "reasoning": <one sentence>
}

Outlook text:
"""

_LABEL_THRESHOLDS = [
    (70, "positive"),
    (50, "neutral"),
    (30, "cautious"),
]


async def score_outlook_sentiment(
    db: Session,
    transcript_id: int,
) -> dict | None:
    """
    Score sentiment of the outlook section for a transcript.

    Fetches outlook chunks, calls Claude, stores result on Transcript.
    Returns {"score": float, "label": str, "reasoning": str} or None on failure.
    """
    transcript = db.get(Transcript, transcript_id)
    if not transcript:
        return None

    # Already scored
    if transcript.sentiment_score is not None:
        return {
            "score": transcript.sentiment_score,
            "label": transcript.sentiment_label,
        }

    # Get outlook chunks; fall back to last quarter of prepared_remarks chunks
    outlook_chunks = (
        db.query(TranscriptChunk)
        .filter(
            TranscriptChunk.transcript_id == transcript_id,
            TranscriptChunk.section == "outlook",
        )
        .order_by(TranscriptChunk.chunk_index)
        .all()
    )

    if not outlook_chunks:
        all_chunks = (
            db.query(TranscriptChunk)
            .filter(TranscriptChunk.transcript_id == transcript_id)
            .order_by(TranscriptChunk.chunk_index)
            .all()
        )
        if not all_chunks:
            return None
        cutoff = max(0, len(all_chunks) - len(all_chunks) // 4)
        outlook_chunks = all_chunks[cutoff:]

    # Concatenate — cap at ~3000 chars to stay within a tight prompt
    text = " ".join(c.content for c in outlook_chunks)[:3000]

    result = await _call_claude(text)
    if not result:
        return None

    transcript.sentiment_score = float(result["score"])
    transcript.sentiment_label = result["label"]
    db.commit()

    return result


async def _call_claude(text: str) -> dict | None:
    """Call Claude to score sentiment. Returns parsed dict or None."""
    try:
        import anthropic

        from src.core.config import settings

        client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        message = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=200,
            messages=[{"role": "user", "content": _SENTIMENT_PROMPT + text}],
        )
        raw = message.content[0].text.strip()

        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]

        parsed = json.loads(raw)
        score = int(parsed["score"])
        score = max(0, min(100, score))

        # Derive label from score if not valid
        label = parsed.get("label", "")
        if label not in ("positive", "neutral", "cautious", "negative"):
            label = "negative"
            for threshold, lbl in _LABEL_THRESHOLDS:
                if score >= threshold:
                    label = lbl
                    break

        return {
            "score": score,
            "label": label,
            "reasoning": parsed.get("reasoning", ""),
        }

    except Exception as e:
        logger.error(f"Sentiment scoring failed: {e}")
        return None

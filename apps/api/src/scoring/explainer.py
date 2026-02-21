"""Generate human-readable explanations for scores."""

from typing import Any


def generate_factor_explanation(
    factor_label: str,
    factor_score: float | None,
    components: list[dict[str, Any]],
) -> str:
    """Generate a plain-text explanation for a factor score."""
    if factor_score is None:
        return f"{factor_label}: Insufficient data to calculate score."

    # Sort by contribution (score * weight), descending
    scored = [c for c in components if c["score"] is not None]
    scored.sort(key=lambda c: (c["score"] or 0) * c["weight"], reverse=True)

    # Overall assessment
    if factor_score >= 80:
        assessment = "Excellent"
    elif factor_score >= 65:
        assessment = "Strong"
    elif factor_score >= 50:
        assessment = "Moderate"
    elif factor_score >= 35:
        assessment = "Below average"
    else:
        assessment = "Weak"

    lines = [f"{factor_label}: {factor_score:.0f}/100 — {assessment}"]

    # Top contributors
    if len(scored) >= 1:
        top = scored[0]
        lines.append("")
        lines.append("Key strengths:")
        for c in scored[:2]:
            if c["score"] and c["score"] >= 60:
                raw = _format_raw(c["raw_value"], c["label"])
                lines.append(f"  • {c['label']}: {raw} (score: {c['score']:.0f})")

    # Weaknesses
    weak = [c for c in scored if c["score"] is not None and c["score"] < 40]
    if weak:
        lines.append("")
        lines.append("Areas of concern:")
        for c in weak[:2]:
            raw = _format_raw(c["raw_value"], c["label"])
            lines.append(f"  • {c['label']}: {raw} (score: {c['score']:.0f})")

    return "\n".join(lines)


def _format_raw(value: float | None, label: str) -> str:
    """Format a raw metric value for display."""
    if value is None:
        return "N/A"

    label_lower = label.lower()
    if any(kw in label_lower for kw in ["margin", "growth", "yield", "roe", "roa", "change"]):
        return f"{value:.1f}%"
    elif any(kw in label_lower for kw in ["ratio", "p/e", "p/b", "p/s", "ev/", "peg"]):
        return f"{value:.2f}x"
    else:
        return f"{value:.2f}"

"""Scoring methods: threshold, linear, percentile (simplified)."""

from typing import Any


def score_threshold(value: float, metric_config: dict[str, Any]) -> float:
    """Score using step-function thresholds."""
    thresholds = metric_config.get("thresholds", [])
    higher_is_better = metric_config.get("higher_is_better", True)

    for t in thresholds:
        if higher_is_better:
            # For "higher is better" metrics, check min thresholds (descending)
            if "min" in t and value >= t["min"]:
                return float(t["score"])
        else:
            # For "lower is better" metrics, check max thresholds (ascending)
            if "max" in t and value <= t["max"]:
                return float(t["score"])

    # Return default score if no threshold matched
    for t in thresholds:
        if "default" in t:
            return float(t["default"])
    return 0.0


def score_linear(value: float, metric_config: dict[str, Any]) -> float:
    """Score using linear interpolation between bounds."""
    bounds = metric_config.get("linear_bounds", {})
    input_min = bounds.get("input_min", 0)
    input_max = bounds.get("input_max", 100)
    output_min = bounds.get("output_min", 0)
    output_max = bounds.get("output_max", 100)

    # Clamp input to bounds
    clamped = max(input_min, min(input_max, value))

    # Linear interpolation
    if input_max == input_min:
        return output_max

    ratio = (clamped - input_min) / (input_max - input_min)
    return output_min + ratio * (output_max - output_min)


def score_metric(value: float | None, metric_config: dict[str, Any]) -> float | None:
    """Score a single metric using the configured method."""
    if value is None:
        return None

    method = metric_config.get("scoring_method", "linear")

    if method == "threshold":
        return round(score_threshold(value, metric_config), 1)
    elif method in ("linear", "percentile", "percentile_inverse"):
        # For MVP, percentile methods fall back to linear scoring
        return round(score_linear(value, metric_config), 1)
    else:
        return None

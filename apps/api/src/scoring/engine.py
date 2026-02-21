"""Main scoring engine: calculates factor and composite scores."""

import logging
from typing import Any

from src.scoring.configs import load_factor_config, load_profile
from src.scoring.explainer import generate_factor_explanation
from src.scoring.methods import score_metric

logger = logging.getLogger(__name__)


def resolve_metric_value(source: str, fundamentals: dict[str, Any]) -> float | None:
    """Resolve a dotted source path like 'valuation.pe_ttm' from fundamentals data."""
    parts = source.split(".")
    current = fundamentals
    for part in parts:
        if isinstance(current, dict):
            current = current.get(part)
        else:
            return None
        if current is None:
            return None
    if isinstance(current, (int, float)):
        return float(current)
    return None


def calculate_factor_score(
    factor_config_name: str,
    fundamentals: dict[str, Any],
    stock_info: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Calculate score for a single factor."""
    config = load_factor_config(factor_config_name)
    metrics = config.get("metrics", [])

    components = []
    weighted_sum = 0.0
    total_weight = 0.0

    for metric_cfg in metrics:
        source = metric_cfg["source"]

        # Try fundamentals first, then stock_info for analyst data
        raw_value = resolve_metric_value(source, fundamentals)

        # Special handling for computed analyst metrics
        if raw_value is None and stock_info and source.startswith("analyst."):
            raw_value = _resolve_analyst_metric(source, stock_info, fundamentals)

        score = score_metric(raw_value, metric_cfg)
        weight = metric_cfg.get("weight", 1.0 / len(metrics))

        component = {
            "metric_id": metric_cfg["id"],
            "label": metric_cfg["label"],
            "raw_value": raw_value,
            "score": score,
            "weight": weight,
        }
        components.append(component)

        if score is not None:
            weighted_sum += score * weight
            total_weight += weight

    factor_score = round(weighted_sum / total_weight, 1) if total_weight > 0 else None

    explanation = generate_factor_explanation(
        config.get("label", config["factor"]),
        factor_score,
        components,
    )

    return {
        "factor": config["factor"],
        "label": config.get("label", config["factor"]),
        "score": factor_score,
        "components": components,
        "explanation": explanation,
    }


def _resolve_analyst_metric(
    source: str, stock_info: dict[str, Any], fundamentals: dict[str, Any]
) -> float | None:
    """Resolve computed analyst metrics."""
    analyst = fundamentals.get("analyst", {})
    if source == "analyst.upside_pct":
        target = analyst.get("target_mean")
        price = stock_info.get("price")
        if target and price and price > 0:
            return round((target / price - 1) * 100, 2)
    elif source == "analyst.rating_score":
        # Convert "1.9 - Buy" format to numeric 1-5 scale, then invert (1=best)
        rating_str = analyst.get("rating", "")
        if rating_str:
            try:
                numeric = float(rating_str.split(" ")[0])
                # Invert: 1.0 (Strong Buy) -> 5.0, 5.0 (Strong Sell) -> 1.0
                return round(6.0 - numeric, 2)
            except (ValueError, IndexError):
                pass
    elif source == "analyst.num_analysts":
        return analyst.get("num_analysts")
    return None


def calculate_composite_score(
    fundamentals: dict[str, Any],
    stock_info: dict[str, Any] | None = None,
    profile_name: str = "default_profile",
) -> dict[str, Any]:
    """Calculate overall composite score from all factors."""
    profile = load_profile(profile_name)
    factors_config = profile.get("factors", [])

    factor_results = {}
    weighted_sum = 0.0
    total_weight = 0.0

    for factor_entry in factors_config:
        config_name = factor_entry["config"]
        weight = factor_entry.get("weight", 0.2)

        result = calculate_factor_score(config_name, fundamentals, stock_info)
        result["weight"] = weight
        factor_results[result["factor"]] = result

        if result["score"] is not None:
            weighted_sum += result["score"] * weight
            total_weight += weight

    overall_score = round(weighted_sum / total_weight, 1) if total_weight > 0 else None

    return {
        "overall_score": overall_score,
        "factors": factor_results,
        "profile_used": profile.get("label", profile_name),
    }

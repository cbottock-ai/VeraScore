import os
from pathlib import Path
from typing import Any

import yaml

CONFIGS_DIR = Path(__file__).resolve().parent.parent.parent / "configs" / "scoring"


def load_factor_config(factor_name: str) -> dict[str, Any]:
    """Load a factor scoring config from YAML."""
    path = CONFIGS_DIR / f"{factor_name}.yaml"
    if not path.exists():
        raise FileNotFoundError(f"Scoring config not found: {path}")
    with open(path) as f:
        return yaml.safe_load(f)


def load_profile(profile_name: str = "default_profile") -> dict[str, Any]:
    """Load a scoring profile from YAML."""
    path = CONFIGS_DIR / f"{profile_name}.yaml"
    if not path.exists():
        raise FileNotFoundError(f"Scoring profile not found: {path}")
    with open(path) as f:
        return yaml.safe_load(f)


def list_configs() -> list[dict[str, Any]]:
    """List all available scoring configs."""
    configs = []
    for path in sorted(CONFIGS_DIR.glob("*.yaml")):
        with open(path) as f:
            data = yaml.safe_load(f)
        if "factor" in data:
            configs.append({
                "filename": path.stem,
                "factor": data["factor"],
                "label": data.get("label", data["factor"]),
                "version": data.get("version", 1),
                "default_weight": data.get("default_weight", 0),
                "metrics_count": len(data.get("metrics", [])),
            })
    return configs

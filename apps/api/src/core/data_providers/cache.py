import time
from typing import Any

# TTL values in seconds
CACHE_TTL_FUNDAMENTALS = 24 * 60 * 60  # 24 hours
CACHE_TTL_PRICES = 15 * 60  # 15 minutes
CACHE_TTL_SEARCH = 60 * 60  # 1 hour

_cache: dict[str, tuple[Any, float]] = {}


def cache_get(key: str) -> Any | None:
    if key in _cache:
        value, expiry = _cache[key]
        if time.time() < expiry:
            return value
        del _cache[key]
    return None


def cache_set(key: str, value: Any, ttl: int) -> None:
    _cache[key] = (value, time.time() + ttl)


def cache_clear() -> None:
    _cache.clear()

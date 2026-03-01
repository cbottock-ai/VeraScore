import time
from typing import Any

# TTL values in seconds
CACHE_TTL_FUNDAMENTALS = 24 * 60 * 60  # 24 hours (daily)
CACHE_TTL_PRICES = 5 * 60  # 5 minutes
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


def cache_clear_ticker(ticker: str) -> int:
    """Clear all cached data for a specific ticker. Returns count cleared."""
    ticker_upper = ticker.upper()
    keys_to_delete = [k for k in _cache if ticker_upper in k.upper()]
    for key in keys_to_delete:
        del _cache[key]
    return len(keys_to_delete)


def cache_clear_portfolio(portfolio_id: int) -> None:
    """Clear cache marker for portfolio refresh."""
    # This is just a signal - actual clearing happens per-ticker
    pass

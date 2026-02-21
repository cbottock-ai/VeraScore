import logging

from src.core.data_providers.cache import (
    CACHE_TTL_FUNDAMENTALS,
    CACHE_TTL_PRICES,
    CACHE_TTL_SEARCH,
    cache_get,
    cache_set,
)
from src.core.data_providers.fmp import (
    fmp_financial_growth,
    fmp_search,
)
from src.core.data_providers.yahoo import yahoo_get_momentum, yahoo_get_stock_info

logger = logging.getLogger(__name__)


async def fetch_search(query: str, limit: int = 10) -> list[dict]:
    cache_key = f"search:{query}:{limit}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached
    results = await fmp_search(query, limit)
    cache_set(cache_key, results, CACHE_TTL_SEARCH)
    return results


async def fetch_stock_info(ticker: str) -> dict:
    """Fetch profile + price + all metrics from yfinance (single call)."""
    cache_key = f"stock_info:{ticker}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached
    info = await yahoo_get_stock_info(ticker)
    if info:
        cache_set(cache_key, info, CACHE_TTL_PRICES)
    return info


async def fetch_fundamentals(ticker: str) -> dict:
    cache_key = f"fundamentals:{ticker}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    # yfinance for all high-level metrics
    info = await fetch_stock_info(ticker)

    # FMP for multi-year historical growth
    growth = await fmp_financial_growth(ticker)

    # yfinance for momentum (price history)
    momentum = await yahoo_get_momentum(ticker)

    result = {
        "valuation": {
            "pe_ttm": _round(info.get("pe_ttm")),
            "pe_ntm": _round(info.get("pe_ntm")),
            "ps_ttm": _round(info.get("ps_ttm")),
            "pb_ratio": _round(info.get("pb_ratio")),
            "ev_to_ebitda": _round(info.get("ev_to_ebitda")),
            "ev_to_revenue": _round(info.get("ev_to_revenue")),
            "peg_ratio": _round(info.get("peg_ratio")),
            "eps_ttm": _round(info.get("eps_ttm")),
            "eps_ntm": _round(info.get("eps_ntm")),
        },
        "growth": {
            "revenue_growth_yoy": info.get("revenue_growth_yoy"),
            "earnings_growth_yoy": info.get("earnings_growth_yoy"),
            "earnings_growth_quarterly": info.get("earnings_growth_quarterly"),
            "revenue_growth_3y": _pct(growth, "threeYRevenueGrowthPerShare"),
            "earnings_growth_3y": _pct(growth, "threeYNetIncomeGrowthPerShare"),
            "revenue_growth_5y": _pct(growth, "fiveYRevenueGrowthPerShare"),
            "revenue_growth_10y": _pct(growth, "tenYRevenueGrowthPerShare"),
        },
        "profitability": {
            "gross_margin": info.get("gross_margin"),
            "ebitda_margin": info.get("ebitda_margin"),
            "operating_margin": info.get("operating_margin"),
            "net_margin": info.get("net_margin"),
            "roe": info.get("roe"),
            "roa": info.get("roa"),
        },
        "quality": {
            "current_ratio": _round(info.get("current_ratio")),
            "quick_ratio": _round(info.get("quick_ratio")),
            "debt_to_equity": info.get("debt_to_equity"),
            "total_debt": info.get("total_debt"),
            "total_cash": info.get("total_cash"),
            "free_cash_flow": info.get("free_cash_flow"),
            "operating_cash_flow": info.get("operating_cash_flow"),
            "fcf_yield": info.get("fcf_yield"),
        },
        "momentum": momentum,
        "dividend": {
            "dividend_yield": info.get("dividend_yield"),
            "payout_ratio": info.get("payout_ratio"),
        },
        "analyst": {
            "target_mean": info.get("target_mean"),
            "target_median": info.get("target_median"),
            "target_high": info.get("target_high"),
            "target_low": info.get("target_low"),
            "rating": info.get("rating"),
            "num_analysts": info.get("num_analysts"),
        },
    }
    cache_set(cache_key, result, CACHE_TTL_FUNDAMENTALS)
    return result


def _round(val: float | None) -> float | None:
    if val is None:
        return None
    return round(val, 2)


def _pct(data: dict | None, key: str) -> float | None:
    """Get a decimal value from FMP and convert to percentage."""
    if data is None:
        return None
    val = data.get(key)
    if val is None:
        return None
    try:
        return round(float(val) * 100, 2)
    except (ValueError, TypeError):
        return None

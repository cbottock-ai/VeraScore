"""
FMP-based data fetcher - Primary data source for all stock data.
"""

import asyncio
import logging
from datetime import datetime
from typing import Any

from src.core.data_providers.cache import (
    CACHE_TTL_FUNDAMENTALS,
    CACHE_TTL_PRICES,
    cache_get,
    cache_set,
)
from src.core.data_providers.fmp import (
    fmp_financial_growth,
    fmp_key_metrics_ttm,
    fmp_profile,
    fmp_quote,
    fmp_ratios_ttm,
)
from src.core.config import settings
import httpx

logger = logging.getLogger(__name__)

FMP_BASE = "https://financialmodelingprep.com/stable"


async def _fmp_analyst_estimates_current(ticker: str) -> dict | None:
    """Get current fiscal year analyst estimates for forward P/E calculation."""
    if not settings.fmp_api_key:
        return None
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{FMP_BASE}/analyst-estimates",
                params={
                    "symbol": ticker,
                    "period": "annual",
                    "limit": 5,
                    "apikey": settings.fmp_api_key,
                },
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
            if not isinstance(data, list) or not data:
                return None

            # Find the estimate for current fiscal year (prefer current over next)
            current_year = datetime.now().year
            current_year_est = None
            next_year_est = None

            for est in data:
                est_date = est.get("date", "")
                if est_date:
                    est_year = int(est_date[:4])
                    if est_year == current_year:
                        current_year_est = est
                    elif est_year == current_year + 1 and next_year_est is None:
                        next_year_est = est

            # Prefer current year, fall back to next year
            if current_year_est:
                return current_year_est
            if next_year_est:
                return next_year_est

            # Fall back to the estimate closest to current year
            closest = None
            min_diff = float('inf')
            for est in data:
                est_date = est.get("date", "")
                if est_date:
                    est_year = int(est_date[:4])
                    diff = abs(est_year - current_year)
                    if diff < min_diff:
                        min_diff = diff
                        closest = est
            return closest
    except Exception as e:
        logger.warning(f"FMP analyst estimates failed for {ticker}: {e}")
        return None


async def fetch_fmp_quote(ticker: str) -> dict:
    """Fetch real-time quote data from FMP."""
    cache_key = f"fmp_quote:{ticker}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    quote = await fmp_quote(ticker)
    if not quote:
        return {}

    result = {
        "price": quote.get("price"),
        "change": quote.get("change"),
        "change_percent": quote.get("changePercentage"),
        "volume": quote.get("volume"),
        "day_high": quote.get("dayHigh"),
        "day_low": quote.get("dayLow"),
        "open": quote.get("open"),
        "previous_close": quote.get("previousClose"),
        "market_cap": quote.get("marketCap"),
        "year_high": quote.get("yearHigh"),
        "year_low": quote.get("yearLow"),
        "avg_50": quote.get("priceAvg50"),
        "avg_200": quote.get("priceAvg200"),
    }

    cache_set(cache_key, result, CACHE_TTL_PRICES)
    return result


async def fetch_fmp_profile(ticker: str) -> dict:
    """Fetch company profile from FMP."""
    cache_key = f"fmp_profile:{ticker}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    profile = await fmp_profile(ticker)
    if not profile:
        return {}

    result = {
        "name": profile.get("companyName"),
        "sector": profile.get("sector"),
        "industry": profile.get("industry"),
        "market_cap": profile.get("marketCap"),
        "beta": profile.get("beta"),
        "exchange": profile.get("exchange"),
        "ceo": profile.get("ceo"),
        "employees": profile.get("fullTimeEmployees"),
        "website": profile.get("website"),
        "description": profile.get("description"),
        "country": profile.get("country"),
        "ipo_date": profile.get("ipoDate"),
        "avg_volume": profile.get("averageVolume"),
    }

    cache_set(cache_key, result, CACHE_TTL_FUNDAMENTALS)
    return result


async def fetch_fmp_fundamentals(ticker: str) -> dict:
    """Fetch all fundamental data from FMP (ratios, metrics, estimates)."""
    cache_key = f"fmp_fundamentals:{ticker}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    # Fetch ratios, metrics, growth, and estimates in parallel
    ratios, metrics, growth, estimates = await asyncio.gather(
        fmp_ratios_ttm(ticker),
        fmp_key_metrics_ttm(ticker),
        fmp_financial_growth(ticker),
        _fmp_analyst_estimates_current(ticker),
        return_exceptions=True,
    )

    # Handle exceptions
    if isinstance(ratios, Exception):
        ratios = None
    if isinstance(metrics, Exception):
        metrics = None
    if isinstance(growth, Exception):
        growth = None
    if isinstance(estimates, Exception):
        estimates = None

    ratios = ratios or {}
    metrics = metrics or {}
    growth = growth or {}
    estimates = estimates or {}

    # Get quote for forward P/E calculation
    quote = await fetch_fmp_quote(ticker)
    price = quote.get("price")

    # Calculate forward P/E from analyst estimates
    forward_pe = None
    forward_eps = estimates.get("epsAvg")
    if price and forward_eps and forward_eps > 0:
        forward_pe = round(price / forward_eps, 2)

    result = {
        "valuation": {
            "pe_ttm": _round(ratios.get("priceToEarningsRatioTTM")),
            "pe_ntm": forward_pe,  # Calculated from analyst estimates
            "ps_ttm": _round(ratios.get("priceToSalesRatioTTM")),
            "pb_ratio": _round(ratios.get("priceToBookRatioTTM")),
            "ev_to_ebitda": _round(metrics.get("evToEBITDATTM")),
            "ev_to_revenue": _round(metrics.get("evToSalesTTM")),
            "peg_ratio": _round(ratios.get("priceToEarningsGrowthRatioTTM")),
            "eps_ttm": _round(ratios.get("netIncomePerShareTTM")),
            "eps_ntm": _round(estimates.get("epsAvg")),
            "price_to_fcf": _round(ratios.get("priceToFreeCashFlowRatioTTM")),
        },
        "growth": {
            "revenue_growth_yoy": _pct(growth.get("revenueGrowth")),
            "earnings_growth_yoy": _pct(growth.get("netIncomeGrowth")),
            "revenue_growth_3y": _pct(growth.get("threeYRevenueGrowthPerShare")),
            "revenue_growth_5y": _pct(growth.get("fiveYRevenueGrowthPerShare")),
            "revenue_growth_10y": _pct(growth.get("tenYRevenueGrowthPerShare")),
            "earnings_growth_3y": _pct(growth.get("threeYNetIncomeGrowthPerShare")),
            "eps_growth_yoy": _pct(growth.get("epsgrowth")),
        },
        "profitability": {
            "gross_margin": _pct(ratios.get("grossProfitMarginTTM")),
            "ebitda_margin": _pct(ratios.get("ebitdaMarginTTM")),
            "operating_margin": _pct(ratios.get("operatingProfitMarginTTM")),
            "net_margin": _pct(ratios.get("netProfitMarginTTM")),
            "roe": _pct(metrics.get("roeTTM")),
            "roa": _pct(metrics.get("returnOnTangibleAssetsTTM")),
            "roic": _pct(metrics.get("roicTTM")),
        },
        "quality": {
            "current_ratio": _round(ratios.get("currentRatioTTM")),
            "quick_ratio": _round(ratios.get("quickRatioTTM")),
            "debt_to_equity": _round(ratios.get("debtToEquityRatioTTM")),
            "interest_coverage": _round(ratios.get("interestCoverageRatioTTM")),
            "fcf_per_share": _round(ratios.get("freeCashFlowPerShareTTM")),
            "fcf_yield": _pct(metrics.get("freeCashFlowYieldTTM")),
            "earnings_yield": _pct(metrics.get("earningsYieldTTM")),
        },
        "dividend": {
            "dividend_yield": _pct(ratios.get("dividendYieldTTM")),
            "payout_ratio": _pct(ratios.get("dividendPayoutRatioTTM")),
            "dividend_per_share": _round(ratios.get("dividendPerShareTTM")),
        },
        "analyst": {
            "eps_estimate": _round(estimates.get("epsAvg")),
            "eps_estimate_high": _round(estimates.get("epsHigh")),
            "eps_estimate_low": _round(estimates.get("epsLow")),
            "revenue_estimate": estimates.get("revenueAvg"),
            "num_analysts_eps": estimates.get("numAnalystsEps"),
            "num_analysts_revenue": estimates.get("numAnalystsRevenue"),
        },
    }

    cache_set(cache_key, result, CACHE_TTL_FUNDAMENTALS)
    return result


async def fetch_fmp_all(ticker: str) -> dict[str, Any]:
    """Fetch all FMP data for a ticker in parallel."""
    quote, profile, fundamentals = await asyncio.gather(
        fetch_fmp_quote(ticker),
        fetch_fmp_profile(ticker),
        fetch_fmp_fundamentals(ticker),
        return_exceptions=True,
    )

    if isinstance(quote, Exception):
        logger.warning(f"FMP quote failed for {ticker}: {quote}")
        quote = {}
    if isinstance(profile, Exception):
        logger.warning(f"FMP profile failed for {ticker}: {profile}")
        profile = {}
    if isinstance(fundamentals, Exception):
        logger.warning(f"FMP fundamentals failed for {ticker}: {fundamentals}")
        fundamentals = {}

    return {
        "quote": quote,
        "profile": profile,
        "fundamentals": fundamentals,
    }


def _round(val: float | None) -> float | None:
    """Round a value to 2 decimal places."""
    if val is None:
        return None
    try:
        return round(float(val), 2)
    except (ValueError, TypeError):
        return None


def _pct(val: float | None) -> float | None:
    """Convert decimal to percentage if needed."""
    if val is None:
        return None
    try:
        v = float(val)
        # FMP sometimes returns decimals (0.47) and sometimes percentages (47.0)
        # If abs value > 1, assume it's already a percentage
        if abs(v) <= 1:
            return round(v * 100, 2)
        return round(v, 2)
    except (ValueError, TypeError):
        return None

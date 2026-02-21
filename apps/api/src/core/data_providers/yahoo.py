import logging
from concurrent.futures import ThreadPoolExecutor

import yfinance as yf

logger = logging.getLogger(__name__)

_executor = ThreadPoolExecutor(max_workers=4)


def _get_stock_info_sync(ticker: str) -> dict:
    """Pull all high-level stats directly from yfinance."""
    try:
        t = yf.Ticker(ticker)
        info = t.info
        fast = t.fast_info
        return {
            # Price
            "price": float(fast.last_price) if fast.last_price else info.get("currentPrice"),
            "change_percent": (
                round(float(fast.last_price / fast.previous_close - 1) * 100, 2)
                if fast.last_price and fast.previous_close
                else None
            ),
            # Profile
            "name": info.get("longName") or info.get("shortName"),
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "market_cap": info.get("marketCap"),
            "exchange": info.get("exchange"),
            "beta": info.get("beta"),
            "week_52_high": info.get("fiftyTwoWeekHigh"),
            "week_52_low": info.get("fiftyTwoWeekLow"),
            "avg_volume": info.get("averageVolume"),
            # Valuation — TTM & NTM
            "pe_ttm": info.get("trailingPE"),
            "pe_ntm": info.get("forwardPE"),
            "ps_ttm": info.get("priceToSalesTrailing12Months"),
            "pb_ratio": info.get("priceToBook"),
            "ev_to_ebitda": info.get("enterpriseToEbitda"),
            "ev_to_revenue": info.get("enterpriseToRevenue"),
            "peg_ratio": info.get("trailingPegRatio"),
            "eps_ttm": info.get("epsTrailingTwelveMonths"),
            "eps_ntm": info.get("epsForward"),
            # Growth (YoY from yfinance)
            "revenue_growth_yoy": _to_pct(info.get("revenueGrowth")),
            "earnings_growth_yoy": _to_pct(info.get("earningsGrowth")),
            "earnings_growth_quarterly": _to_pct(info.get("earningsQuarterlyGrowth")),
            # Profitability
            "gross_margin": _to_pct(info.get("grossMargins")),
            "ebitda_margin": _to_pct(info.get("ebitdaMargins")),
            "operating_margin": _to_pct(info.get("operatingMargins")),
            "net_margin": _to_pct(info.get("profitMargins")),
            "roe": _to_pct(info.get("returnOnEquity")),
            "roa": _to_pct(info.get("returnOnAssets")),
            # Quality
            "current_ratio": info.get("currentRatio"),
            "quick_ratio": info.get("quickRatio"),
            "debt_to_equity": (
                round(info["debtToEquity"] / 100, 2)
                if info.get("debtToEquity") is not None
                else None
            ),
            "total_debt": info.get("totalDebt"),
            "total_cash": info.get("totalCash"),
            "free_cash_flow": info.get("freeCashflow"),
            "operating_cash_flow": info.get("operatingCashflow"),
            "fcf_yield": (
                round(info["freeCashflow"] / info["marketCap"] * 100, 2)
                if info.get("freeCashflow") and info.get("marketCap")
                else None
            ),
            # Dividend
            "dividend_yield": info.get("dividendYield"),  # already in percent
            "payout_ratio": _to_pct(info.get("payoutRatio")),
            # Analyst
            "target_mean": info.get("targetMeanPrice"),
            "target_median": info.get("targetMedianPrice"),
            "target_high": info.get("targetHighPrice"),
            "target_low": info.get("targetLowPrice"),
            "rating": info.get("averageAnalystRating"),
            "num_analysts": info.get("numberOfAnalystOpinions"),
        }
    except Exception:
        logger.exception("yfinance info fetch failed for %s", ticker)
        return {}


def _get_momentum_sync(ticker: str) -> dict:
    try:
        t = yf.Ticker(ticker)
        hist = t.history(period="1y")
        if hist.empty:
            return {}
        current = float(hist["Close"].iloc[-1])
        result = {}
        for label, days in [("1m", 21), ("3m", 63), ("6m", 126), ("1y", 252)]:
            if len(hist) >= days:
                past = float(hist["Close"].iloc[-days])
                result[f"price_change_{label}"] = round((current / past - 1) * 100, 2)
        return result
    except Exception:
        logger.exception("yfinance momentum fetch failed for %s", ticker)
        return {}


def _to_pct(val: float | None) -> float | None:
    """Convert decimal to percentage (0.47 → 47.0)."""
    if val is None:
        return None
    return round(val * 100, 2)


async def yahoo_get_stock_info(ticker: str) -> dict:
    import asyncio

    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(_executor, _get_stock_info_sync, ticker)


async def yahoo_get_momentum(ticker: str) -> dict:
    import asyncio

    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(_executor, _get_momentum_sync, ticker)

import asyncio
import logging
import time
from typing import Any

import httpx

from src.core.config import settings

logger = logging.getLogger(__name__)

# Simple in-memory cache for quotes (30 second TTL)
_quote_cache: dict[str, tuple[float, dict[str, Any]]] = {}
QUOTE_CACHE_TTL = 30  # seconds

FMP_BASE = "https://financialmodelingprep.com/stable"


async def fmp_search(query: str, limit: int = 10) -> list[dict]:
    if not settings.fmp_api_key:
        logger.warning("FMP_API_KEY not set")
        return []
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{FMP_BASE}/search-symbol",
            params={"query": query, "limit": limit, "apikey": settings.fmp_api_key},
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()


async def fmp_profile(ticker: str) -> dict | None:
    if not settings.fmp_api_key:
        return None
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{FMP_BASE}/profile",
            params={"symbol": ticker, "apikey": settings.fmp_api_key},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        return data[0] if isinstance(data, list) and data else data if isinstance(data, dict) else None


async def fmp_key_metrics_ttm(ticker: str) -> dict | None:
    if not settings.fmp_api_key:
        return None
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{FMP_BASE}/key-metrics-ttm",
            params={"symbol": ticker, "apikey": settings.fmp_api_key},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        return data[0] if isinstance(data, list) and data else data if isinstance(data, dict) else None


async def fmp_ratios_ttm(ticker: str) -> dict | None:
    if not settings.fmp_api_key:
        return None
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{FMP_BASE}/ratios-ttm",
            params={"symbol": ticker, "apikey": settings.fmp_api_key},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        return data[0] if isinstance(data, list) and data else data if isinstance(data, dict) else None


async def fmp_analyst_estimates_current(ticker: str) -> dict | None:
    """Get the single most recent analyst estimate entry (used by fundamentals fetcher)."""
    if not settings.fmp_api_key:
        return None
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{FMP_BASE}/analyst-estimates",
            params={"symbol": ticker, "period": "annual", "limit": 1, "apikey": settings.fmp_api_key},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        return data[0] if isinstance(data, list) and data else data if isinstance(data, dict) else None


async def fmp_financial_growth(ticker: str) -> dict | None:
    if not settings.fmp_api_key:
        return None
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{FMP_BASE}/financial-growth",
            params={"symbol": ticker, "limit": 1, "apikey": settings.fmp_api_key},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        return data[0] if isinstance(data, list) and data else data if isinstance(data, dict) else None


async def fmp_earnings_historical(ticker: str, limit: int = 12) -> list[dict]:
    """Get historical earnings data for a ticker.

    Uses /stable/earnings endpoint which returns both estimates and actuals.
    Returns list with: symbol, date, epsActual, epsEstimated, revenueActual, revenueEstimated
    """
    if not settings.fmp_api_key:
        return []

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{FMP_BASE}/earnings",
            params={
                "symbol": ticker,
                "apikey": settings.fmp_api_key,
            },
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()

        if not isinstance(data, list):
            return []

        # Already sorted by date descending, just limit
        return data[:limit]


async def fmp_earnings_calendar(
    from_date: str | None = None,
    to_date: str | None = None,
) -> list[dict]:
    """Get earnings calendar for a date range. Dates in YYYY-MM-DD format."""
    if not settings.fmp_api_key:
        return []
    params: dict[str, Any] = {"apikey": settings.fmp_api_key}
    if from_date:
        params["from"] = from_date
    if to_date:
        params["to"] = to_date
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{FMP_BASE}/earnings-calendar",
            params=params,
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        return data if isinstance(data, list) else []


async def fmp_earnings_confirmed(from_date: str, to_date: str) -> list[dict]:
    """Get confirmed earnings calendar (more accurate than regular calendar)."""
    if not settings.fmp_api_key:
        return []
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{FMP_BASE}/earning-calendar-confirmed",
            params={"from": from_date, "to": to_date, "apikey": settings.fmp_api_key},
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        return data if isinstance(data, list) else []


async def fmp_transcript(ticker: str, year: int, quarter: int) -> dict | None:
    """Get earnings call transcript for a specific quarter."""
    if not settings.fmp_api_key:
        return None
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{FMP_BASE}/earning-call-transcript",
            params={
                "symbol": ticker,
                "year": year,
                "quarter": quarter,
                "apikey": settings.fmp_api_key,
            },
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        return data[0] if isinstance(data, list) and data else None


async def fmp_transcript_list(ticker: str) -> list[dict]:
    """Get list of available transcripts for a ticker."""
    if not settings.fmp_api_key:
        return []
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{FMP_BASE}/earning-call-transcript",
            params={"symbol": ticker, "apikey": settings.fmp_api_key},
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        return data if isinstance(data, list) else []


async def fmp_quote(symbol: str) -> dict | None:
    """Get real-time quote for a symbol (stock or index ETF)."""
    if not settings.fmp_api_key:
        return None
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{FMP_BASE}/quote",
            params={"symbol": symbol, "apikey": settings.fmp_api_key},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        return data[0] if isinstance(data, list) and data else None


async def fmp_batch_quote(symbols: list[str]) -> list[dict]:
    """Get real-time quotes for multiple symbols with caching and parallel fetching."""
    if not settings.fmp_api_key:
        return []

    now = time.time()
    results = []
    symbols_to_fetch = []

    # Check cache first
    for symbol in symbols:
        cache_key = symbol.upper()
        if cache_key in _quote_cache:
            cached_time, cached_data = _quote_cache[cache_key]
            if now - cached_time < QUOTE_CACHE_TTL:
                results.append(cached_data)
                continue
        symbols_to_fetch.append(symbol)

    if not symbols_to_fetch:
        return results

    # Fetch missing quotes in parallel
    async def fetch_one(client: httpx.AsyncClient, symbol: str) -> dict | None:
        try:
            resp = await client.get(
                f"{FMP_BASE}/quote",
                params={"symbol": symbol, "apikey": settings.fmp_api_key},
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()
            if isinstance(data, list) and data:
                return data[0]
            elif isinstance(data, dict) and data:
                return data
        except Exception:
            pass
        return None

    async with httpx.AsyncClient() as client:
        fetched = await asyncio.gather(*[fetch_one(client, s) for s in symbols_to_fetch])

    # Cache and collect results
    for symbol, data in zip(symbols_to_fetch, fetched):
        if data:
            _quote_cache[symbol.upper()] = (now, data)
            results.append(data)

    return results


async def fmp_screener(
    market_cap_min: int | None = None,
    market_cap_max: int | None = None,
    price_min: float | None = None,
    price_max: float | None = None,
    beta_min: float | None = None,
    beta_max: float | None = None,
    volume_min: int | None = None,
    dividend_min: float | None = None,
    sector: str | None = None,
    industry: str | None = None,
    exchange: str | None = None,
    country: str | None = "US",
    limit: int = 250,
    offset: int = 0,
) -> list[dict]:
    """Screen stocks by various criteria. Returns up to 250 results."""
    if not settings.fmp_api_key:
        return []
    params: dict[str, Any] = {
        "apikey": settings.fmp_api_key,
        "isEtf": "false",
        "isActivelyTrading": "true",
        "limit": limit,
        "offset": offset,
    }
    if country:
        params["country"] = country
    if market_cap_min is not None:
        params["marketCapMoreThan"] = market_cap_min
    if market_cap_max is not None:
        params["marketCapLessThan"] = market_cap_max
    if price_min is not None:
        params["priceMoreThan"] = price_min
    if price_max is not None:
        params["priceLessThan"] = price_max
    if beta_min is not None:
        params["betaMoreThan"] = beta_min
    if beta_max is not None:
        params["betaLessThan"] = beta_max
    if volume_min is not None:
        params["volumeMoreThan"] = volume_min
    if dividend_min is not None:
        params["lastAnnualDividendMoreThan"] = dividend_min
    if sector:
        params["sector"] = sector
    if industry:
        params["industry"] = industry
    if exchange:
        params["exchange"] = exchange
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{FMP_BASE}/company-screener",
            params=params,
            timeout=20,
        )
        resp.raise_for_status()
        data = resp.json()
        return data if isinstance(data, list) else []


async def fmp_earnings_historical(ticker: str, limit: int = 20) -> list[dict]:
    """
    Get historical earnings data for a stock.

    Uses income-statement endpoint (available on free tier) as fallback
    when earnings-surprises is not available.
    """
    if not settings.fmp_api_key:
        return []

    async with httpx.AsyncClient() as client:
        # Try income statement (available on free tier)
        resp = await client.get(
            f"{FMP_BASE}/income-statement",
            params={
                "symbol": ticker,
                "period": "quarter",
                "limit": limit,
                "apikey": settings.fmp_api_key,
            },
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()

        if not isinstance(data, list):
            return []

        # Transform income statement to earnings format
        return [
            {
                "date": item.get("date"),
                "fiscalDateEnding": item.get("date"),
                "actualEarningResult": item.get("eps"),
                "actualEPS": item.get("eps"),
                "revenue": item.get("revenue"),
                "epsSurprise": None,  # Not available from income statement
                "surprisePercentage": None,
            }
            for item in data[:limit]
        ]


async def fmp_earnings_confirmed(
    from_date: str | None = None,
    to_date: str | None = None,
) -> list[dict]:
    """Get confirmed upcoming earnings dates."""
    if not settings.fmp_api_key:
        return []

    params: dict[str, Any] = {"apikey": settings.fmp_api_key}
    if from_date:
        params["from"] = from_date
    if to_date:
        params["to"] = to_date

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{FMP_BASE}/earning-calendar-confirmed",
            params=params,
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()


async def fmp_transcript(ticker: str, year: int, quarter: int) -> dict | None:
    """
    Get earnings call transcript for a specific quarter.

    Args:
        ticker: Stock ticker
        year: Fiscal year
        quarter: Fiscal quarter (1-4)

    Returns:
        Transcript data or None if not found
    """
    if not settings.fmp_api_key:
        return None

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{FMP_BASE}/earning-call-transcript",
            params={
                "symbol": ticker,
                "year": year,
                "quarter": quarter,
                "apikey": settings.fmp_api_key,
            },
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()

        if isinstance(data, list) and data:
            return data[0]
        return data if isinstance(data, dict) else None


async def fmp_transcript_list(ticker: str) -> list[dict]:
    """Get list of available transcripts for a stock."""
    if not settings.fmp_api_key:
        return []

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{FMP_BASE}/earning-call-transcript-list",
            params={"symbol": ticker, "apikey": settings.fmp_api_key},
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()


async def fmp_analyst_estimates(ticker: str, limit: int = 10, period: str = "annual") -> list[dict]:
    """Get forward analyst estimates for a stock."""
    if not settings.fmp_api_key:
        return []
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{FMP_BASE}/analyst-estimates",
            params={"symbol": ticker, "limit": limit, "period": period, "apikey": settings.fmp_api_key},
            timeout=15,
        )
        if resp.status_code != 200:
            return []
        data = resp.json()
        return data if isinstance(data, list) else []


async def fmp_historical_price_light(symbol: str, from_date: str, to_date: str) -> list[dict]:
    """Get daily EOD prices (date + price) for a symbol over a date range."""
    if not settings.fmp_api_key:
        return []
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{FMP_BASE}/historical-price-eod/light",
            params={"symbol": symbol, "from": from_date, "to": to_date, "apikey": settings.fmp_api_key},
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        return data if isinstance(data, list) else []


async def fmp_sector_performance() -> list[dict]:
    """Get current sector performance (% change)."""
    if not settings.fmp_api_key:
        return []
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{FMP_BASE}/sector-performance",
            params={"apikey": settings.fmp_api_key},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        return data if isinstance(data, list) else []


async def fmp_grades(symbol: str, limit: int = 20) -> list[dict]:
    """Get analyst grade changes for a single symbol."""
    if not settings.fmp_api_key:
        return []
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{FMP_BASE}/grades",
            params={"symbol": symbol, "limit": limit, "apikey": settings.fmp_api_key},
            timeout=10,
        )
        if resp.status_code != 200:
            return []
        data = resp.json()
        return data if isinstance(data, list) else []


async def fmp_grades_batch(symbols: list[str], per_symbol_limit: int = 10) -> list[dict]:
    """Fetch analyst grades for multiple symbols in parallel, sorted by date desc."""
    if not symbols:
        return []
    results = await asyncio.gather(*[fmp_grades(s, limit=per_symbol_limit) for s in symbols])
    merged: list[dict] = []
    for rows in results:
        merged.extend(rows)
    merged.sort(key=lambda r: r.get("date") or "", reverse=True)
    return merged


async def fmp_price_target_consensus(symbol: str) -> dict | None:
    """Get analyst price target consensus (high/low/mean/median) for a symbol."""
    if not settings.fmp_api_key:
        return None
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{FMP_BASE}/price-target-consensus",
            params={"symbol": symbol, "apikey": settings.fmp_api_key},
            timeout=10,
        )
        if resp.status_code != 200:
            return None
        data = resp.json()
        return data[0] if isinstance(data, list) and data else None


async def fmp_grades_consensus(symbol: str) -> dict | None:
    """Get analyst buy/hold/sell consensus counts for a symbol."""
    if not settings.fmp_api_key:
        return None
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{FMP_BASE}/grades-consensus",
            params={"symbol": symbol, "apikey": settings.fmp_api_key},
            timeout=10,
        )
        if resp.status_code != 200:
            return None
        data = resp.json()
        return data[0] if isinstance(data, list) and data else None


async def fmp_stock_news(symbol: str, limit: int = 20) -> list[dict]:
    """Get recent news articles for a stock."""
    if not settings.fmp_api_key:
        return []
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{FMP_BASE}/news/stock",
            params={"symbol": symbol, "limit": limit, "apikey": settings.fmp_api_key},
            timeout=10,
        )
        if resp.status_code != 200:
            return []
        data = resp.json()
        return data if isinstance(data, list) else []


async def fmp_income_statement(symbol: str, limit: int = 8, period: str = "annual") -> list[dict]:
    """Get income statement history."""
    if not settings.fmp_api_key:
        return []
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{FMP_BASE}/income-statement",
            params={"symbol": symbol, "limit": limit, "period": period, "apikey": settings.fmp_api_key},
            timeout=10,
        )
        if resp.status_code != 200:
            return []
        data = resp.json()
        return data if isinstance(data, list) else []


async def fmp_insider_trading(limit: int = 1000) -> list[dict]:
    """Get recent insider trading transactions, paginating with delays to avoid rate limits."""
    if not settings.fmp_api_key:
        return []
    results = []
    page = 0
    per_page = 200
    max_pages = 15  # cap at 3,000 raw records; ~15 days of filings
    async with httpx.AsyncClient() as client:
        while len(results) < limit and page < max_pages:
            if page > 0:
                await asyncio.sleep(1.0)  # avoid 429
            resp = await client.get(
                f"{FMP_BASE}/insider-trading/latest",
                params={"page": page, "limit": per_page, "apikey": settings.fmp_api_key},
                timeout=15,
            )
            resp.raise_for_status()
            batch = resp.json()
            if not isinstance(batch, list) or not batch:
                break
            results.extend(batch)
            if len(batch) < per_page:
                break  # last page
            page += 1
    return results

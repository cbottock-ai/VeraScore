import logging

import httpx

from src.core.config import settings

logger = logging.getLogger(__name__)

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


async def fmp_analyst_estimates(ticker: str) -> dict | None:
    if not settings.fmp_api_key:
        return None
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{FMP_BASE}/analyst-estimates",
            params={
                "symbol": ticker,
                "period": "annual",
                "limit": 1,
                "apikey": settings.fmp_api_key,
            },
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


async def fmp_earnings_calendar(from_date: str, to_date: str) -> list[dict]:
    """Get earnings calendar for a date range. Dates in YYYY-MM-DD format."""
    if not settings.fmp_api_key:
        return []
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{FMP_BASE}/earnings-calendar",
            params={"from": from_date, "to": to_date, "apikey": settings.fmp_api_key},
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

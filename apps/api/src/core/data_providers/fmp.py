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

from fastapi import APIRouter, Query
from src.core.data_providers.fmp import fmp_screener

router = APIRouter(tags=["screener"])


@router.get("/screener")
async def screener(
    market_cap_min: int | None = Query(None),
    market_cap_max: int | None = Query(None),
    price_min: float | None = Query(None),
    price_max: float | None = Query(None),
    beta_min: float | None = Query(None),
    beta_max: float | None = Query(None),
    volume_min: int | None = Query(None),
    dividend_min: float | None = Query(None),
    sector: str | None = Query(None),
    industry: str | None = Query(None),
    exchange: str | None = Query(None),
    country: str | None = Query("US"),
    limit: int = Query(50, ge=1, le=250),
    offset: int = Query(0, ge=0),
):
    results = await fmp_screener(
        market_cap_min=market_cap_min,
        market_cap_max=market_cap_max,
        price_min=price_min,
        price_max=price_max,
        beta_min=beta_min,
        beta_max=beta_max,
        volume_min=volume_min,
        dividend_min=dividend_min,
        sector=sector,
        industry=industry,
        exchange=exchange,
        country=country or "US",
        limit=limit,
        offset=offset,
    )
    return {
        "results": [
            {
                "symbol": r.get("symbol"),
                "name": r.get("companyName"),
                "market_cap": r.get("marketCap"),
                "sector": r.get("sector"),
                "industry": r.get("industry"),
                "price": r.get("price"),
                "beta": r.get("beta"),
                "volume": r.get("volume"),
                "dividend": r.get("lastAnnualDividend"),
                "exchange": r.get("exchangeShortName"),
                "country": r.get("country"),
            }
            for r in results
            if r.get("symbol")
        ],
        "offset": offset,
        "limit": limit,
        "count": len(results),
    }

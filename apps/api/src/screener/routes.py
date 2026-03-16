from fastapi import APIRouter, Query
from src.core.data_providers.fmp import fmp_screener

router = APIRouter(tags=["screener"])


@router.get("/screener")
async def screener(
    market_cap_min: int | None = Query(None),
    market_cap_max: int | None = Query(None),
    sector: str | None = Query(None),
    exchange: str | None = Query(None),
    country: str = Query("US"),
    limit: int = Query(50, ge=1, le=250),
    offset: int = Query(0, ge=0),
):
    results = await fmp_screener(
        market_cap_min=market_cap_min,
        market_cap_max=market_cap_max,
        sector=sector,
        exchange=exchange,
        country=country,
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

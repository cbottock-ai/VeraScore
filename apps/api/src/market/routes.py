from fastapi import APIRouter, Query
from src.core.data_providers.fmp import (
    fmp_batch_quote,
    fmp_upgrades_downgrades,
    fmp_insider_trading,
)

router = APIRouter(prefix="/market", tags=["market"])

# Sector ETFs mapped to GICS sector names
SECTOR_ETFS: list[tuple[str, str]] = [
    ("XLK", "Technology"),
    ("XLV", "Healthcare"),
    ("XLF", "Financials"),
    ("XLY", "Consumer Discretionary"),
    ("XLP", "Consumer Staples"),
    ("XLI", "Industrials"),
    ("XLE", "Energy"),
    ("XLU", "Utilities"),
    ("XLRE", "Real Estate"),
    ("XLB", "Materials"),
    ("XLC", "Communication Services"),
]


@router.get("/sectors")
async def sector_performance():
    etf_symbols = [etf for etf, _ in SECTOR_ETFS]
    sector_map = {etf: sector for etf, sector in SECTOR_ETFS}
    try:
        quotes = await fmp_batch_quote(etf_symbols)
    except Exception:
        quotes = []
    quote_by_symbol = {q.get("symbol", "").upper(): q for q in quotes}
    return {
        "sectors": [
            {
                "sector": sector_map[etf],
                "etf": etf,
                "changes_pct": quote_by_symbol.get(etf, {}).get("changePercentage"),
                "price": quote_by_symbol.get(etf, {}).get("price"),
                "change": quote_by_symbol.get(etf, {}).get("change"),
            }
            for etf in etf_symbols
            if etf in sector_map
        ]
    }


@router.get("/analyst-ratings")
async def analyst_ratings(limit: int = Query(100, ge=1, le=500)):
    try:
        data = await fmp_upgrades_downgrades(limit=limit)
    except Exception:
        data = []
    return {
        "ratings": [
            {
                "symbol": r.get("symbol"),
                "name": r.get("companyName"),
                "published_date": r.get("publishedDate"),
                "action": r.get("action"),
                "rating_from": r.get("previousGrade") or r.get("ratingFrom"),
                "rating_to": r.get("newGrade") or r.get("ratingTo"),
                "price_target": r.get("priceTarget"),
                "price_target_from": r.get("previousPriceTarget") or r.get("priceTargetFrom"),
                "firm": r.get("gradingCompany") or r.get("analystFirm"),
            }
            for r in data
            if r.get("symbol")
        ]
    }


@router.get("/insider-trades")
async def insider_trades(
    limit: int = Query(100, ge=1, le=500),
    transaction_type: str | None = Query(None),
):
    try:
        data = await fmp_insider_trading(limit=limit, transaction_type=transaction_type)
    except Exception:
        data = []
    return {
        "trades": [
            {
                "symbol": r.get("symbol"),
                "filing_date": r.get("filingDate"),
                "transaction_date": r.get("transactionDate"),
                "insider_name": r.get("reportingName"),
                "title": r.get("typeOfOwner"),
                "transaction_type": r.get("transactionType"),
                "shares": r.get("securitiesTransacted"),
                "price": r.get("price"),
                "value": _calc_value(r),
            }
            for r in data
            if r.get("symbol")
        ]
    }


def _parse_pct(val) -> float | None:
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    try:
        return float(str(val).replace("%", "").strip())
    except (ValueError, AttributeError):
        return None


def _calc_value(r: dict) -> float | None:
    shares = r.get("securitiesTransacted")
    price = r.get("price")
    if shares is not None and price is not None:
        try:
            return abs(float(shares) * float(price))
        except (TypeError, ValueError):
            pass
    return None

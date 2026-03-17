import asyncio
from datetime import date, timedelta

from fastapi import APIRouter, Query
from src.core.data_providers.fmp import (
    fmp_batch_quote,
    fmp_historical_price_light,
    fmp_grades_batch,
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


@router.get("/sectors/history")
async def sector_history(
    from_date: str = Query(...),
    to_date: str = Query(...),
):
    """Fetch historical daily prices for all 11 sector ETFs, normalized to % return from period start."""
    etf_symbols = [etf for etf, _ in SECTOR_ETFS]
    sector_map = {etf: sector for etf, sector in SECTOR_ETFS}

    async def fetch(etf: str):
        try:
            rows = await fmp_historical_price_light(etf, from_date, to_date)
            # rows are newest-first; reverse to chronological
            rows = list(reversed(rows))
            return etf, rows
        except Exception:
            return etf, []

    results = await asyncio.gather(*[fetch(etf) for etf in etf_symbols])

    # Build a date-aligned structure: {date -> {etf: pct_return}}
    # First pass: collect all dates and base prices
    etf_data: dict[str, list[dict]] = {}
    for etf, rows in results:
        etf_data[etf] = rows

    all_dates: list[str] = sorted(
        {row["date"] for rows in etf_data.values() for row in rows}
    )

    series = []
    for d in all_dates:
        point: dict = {"date": d}
        for etf in etf_symbols:
            rows = etf_data.get(etf, [])
            if rows:
                base = rows[0]["price"]
                row = next((r for r in rows if r["date"] == d), None)
                if row and base:
                    point[etf] = round((row["price"] / base - 1) * 100, 4)
                else:
                    point[etf] = None
        series.append(point)

    return {
        "series": series,
        "etfs": [{"etf": etf, "sector": sector_map[etf]} for etf in etf_symbols],
    }


DEFAULT_ANALYST_SYMBOLS = [
    "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "AVGO", "JPM", "LLY",
    "V", "UNH", "XOM", "MA", "JNJ", "PG", "HD", "COST", "WMT", "NFLX",
    "BAC", "CRM", "ORCL", "AMD", "ABBV", "KO", "CVX", "MRK", "PEP", "ADBE",
    "TMO", "ACN", "CSCO", "LIN", "MCD", "QCOM", "TXN", "GE", "DHR", "INTU",
    "AMGN", "IBM", "CAT", "SPGI", "BKNG", "ISRG", "GS", "BLK", "UBER", "NOW",
]


@router.get("/analyst-ratings")
async def analyst_ratings(
    symbols: str | None = Query(None, description="Comma-separated list of tickers"),
    limit: int = Query(10, ge=1, le=50, description="Grades per symbol"),
):
    symbol_list = [s.strip().upper() for s in symbols.split(",") if s.strip()] if symbols else DEFAULT_ANALYST_SYMBOLS
    try:
        data = await fmp_grades_batch(symbol_list, per_symbol_limit=limit)
    except Exception:
        data = []
    return {
        "ratings": [
            {
                "symbol": r.get("symbol"),
                "date": r.get("date"),
                "action": r.get("action"),
                "rating_from": r.get("previousGrade"),
                "rating_to": r.get("newGrade"),
                "firm": r.get("gradingCompany"),
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

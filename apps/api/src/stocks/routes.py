from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from src.core.data_providers.fmp import fmp_batch_quote
from src.core.database import get_db
from src.stocks.schemas import FundamentalsResponse, StockDetail, StockSearchResponse
from src.stocks.service import get_fundamentals, get_stock, search_stocks

router = APIRouter(prefix="/stocks", tags=["stocks"])

# Major market index ETFs
MARKET_INDICES = [
    {"symbol": "SPY", "name": "S&P 500"},
    {"symbol": "QQQ", "name": "Nasdaq 100"},
    {"symbol": "DIA", "name": "Dow Jones"},
    {"symbol": "GLD", "name": "Gold"},
]


@router.get("/search", response_model=StockSearchResponse)
async def search(q: str = Query(..., min_length=1), limit: int = Query(10, ge=1, le=50)):
    return await search_stocks(q, limit)


@router.get("/market/indices")
async def market_indices():
    """Get current prices and daily changes for major market indices."""
    symbols = [idx["symbol"] for idx in MARKET_INDICES]
    quotes = await fmp_batch_quote(symbols)

    # Map quotes to index info
    quote_map = {q["symbol"]: q for q in quotes}
    result = []
    for idx in MARKET_INDICES:
        quote = quote_map.get(idx["symbol"], {})
        result.append({
            "symbol": idx["symbol"],
            "name": idx["name"],
            "price": quote.get("price"),
            "change": quote.get("change"),
            "changePercent": quote.get("changePercentage"),
        })
    return result


@router.post("/quotes")
async def batch_quotes(tickers: list[str]):
    """Get quotes for multiple tickers."""
    if not tickers:
        return []
    quotes = await fmp_batch_quote(tickers[:20])  # Limit to 20
    return [
        {
            "symbol": q.get("symbol"),
            "name": q.get("name"),
            "price": q.get("price"),
            "change": q.get("change"),
            "changePercent": q.get("changePercentage"),
        }
        for q in quotes
    ]


@router.get("/{ticker}", response_model=StockDetail)
async def detail(ticker: str, db: Session = Depends(get_db)):
    result = await get_stock(ticker.upper(), db)
    if result is None:
        raise HTTPException(status_code=404, detail="Stock not found")
    return result


@router.get("/{ticker}/fundamentals", response_model=FundamentalsResponse)
async def fundamentals(ticker: str, db: Session = Depends(get_db)):
    return await get_fundamentals(ticker.upper(), db)

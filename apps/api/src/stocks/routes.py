from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from src.core.database import get_db
from src.stocks.schemas import FundamentalsResponse, StockDetail, StockSearchResponse
from src.stocks.service import get_fundamentals, get_stock, search_stocks

router = APIRouter(prefix="/stocks", tags=["stocks"])


@router.get("/search", response_model=StockSearchResponse)
async def search(q: str = Query(..., min_length=1), limit: int = Query(10, ge=1, le=50)):
    return await search_stocks(q, limit)


@router.get("/{ticker}", response_model=StockDetail)
async def detail(ticker: str, db: Session = Depends(get_db)):
    result = await get_stock(ticker.upper(), db)
    if result is None:
        raise HTTPException(status_code=404, detail="Stock not found")
    return result


@router.get("/{ticker}/fundamentals", response_model=FundamentalsResponse)
async def fundamentals(ticker: str, db: Session = Depends(get_db)):
    return await get_fundamentals(ticker.upper(), db)

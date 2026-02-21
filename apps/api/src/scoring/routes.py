from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.core.database import get_db
from src.core.data_providers.fetcher import fetch_fundamentals, fetch_stock_info
from src.scoring.configs import list_configs
from src.scoring.engine import calculate_composite_score, calculate_factor_score
from src.scoring.schemas import FactorScoreResponse, StockScoresResponse

router = APIRouter(prefix="/scoring", tags=["scoring"])


@router.get("/stocks/{ticker}/scores", response_model=StockScoresResponse)
async def get_scores(ticker: str, db: Session = Depends(get_db)):
    ticker = ticker.upper()
    stock_info = await fetch_stock_info(ticker)
    fundamentals = await fetch_fundamentals(ticker)

    result = calculate_composite_score(fundamentals, stock_info)

    return StockScoresResponse(
        ticker=ticker,
        overall_score=result["overall_score"],
        factors=result["factors"],
        profile_used=result["profile_used"],
    )


@router.get("/stocks/{ticker}/scores/{factor}", response_model=FactorScoreResponse)
async def get_factor_score(ticker: str, factor: str, db: Session = Depends(get_db)):
    ticker = ticker.upper()
    stock_info = await fetch_stock_info(ticker)
    fundamentals = await fetch_fundamentals(ticker)

    # Map factor name to config file
    config_name = f"{factor}_v1"
    result = calculate_factor_score(config_name, fundamentals, stock_info)

    return FactorScoreResponse(ticker=ticker, factor=result)


@router.get("/configs")
async def get_configs():
    return {"configs": list_configs()}

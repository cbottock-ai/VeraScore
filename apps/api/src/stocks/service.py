from datetime import datetime

from sqlalchemy.orm import Session

from src.core.data_providers.fetcher import fetch_fundamentals, fetch_search, fetch_stock_info
from src.stocks.models import Stock
from src.stocks.schemas import (
    AnalystMetrics,
    DividendMetrics,
    FundamentalsResponse,
    GrowthMetrics,
    MomentumMetrics,
    ProfitabilityMetrics,
    QualityMetrics,
    StockDetail,
    StockSearchResponse,
    StockSearchResult,
    ValuationMetrics,
)


async def search_stocks(query: str, limit: int = 10) -> StockSearchResponse:
    results = await fetch_search(query, limit)
    return StockSearchResponse(
        query=query,
        results=[
            StockSearchResult(
                ticker=r.get("symbol", ""),
                name=r.get("name", ""),
                exchange=r.get("exchange"),
            )
            for r in results
        ],
    )


async def get_stock(ticker: str, db: Session) -> StockDetail | None:
    info = await fetch_stock_info(ticker)
    if not info or not info.get("name"):
        return None

    # Upsert to DB
    stock = db.get(Stock, ticker)
    if stock is None:
        stock = Stock(ticker=ticker)
        db.add(stock)
    stock.name = info.get("name", ticker)
    stock.sector = info.get("sector")
    stock.industry = info.get("industry")
    stock.market_cap = info.get("market_cap")
    stock.exchange = info.get("exchange")
    stock.last_updated = datetime.utcnow()
    db.commit()

    return StockDetail(
        ticker=ticker,
        name=stock.name,
        sector=stock.sector,
        industry=stock.industry,
        market_cap=stock.market_cap,
        exchange=stock.exchange,
        price=info.get("price"),
        change_percent=info.get("change_percent"),
        beta=info.get("beta"),
        week_52_high=info.get("week_52_high"),
        week_52_low=info.get("week_52_low"),
        avg_volume=info.get("avg_volume"),
        dividend_yield=info.get("dividend_yield"),
    )


async def get_fundamentals(ticker: str, db: Session) -> FundamentalsResponse:
    data = await fetch_fundamentals(ticker)

    return FundamentalsResponse(
        ticker=ticker,
        valuation=ValuationMetrics(**data["valuation"]),
        growth=GrowthMetrics(**data["growth"]),
        profitability=ProfitabilityMetrics(**data["profitability"]),
        quality=QualityMetrics(**data["quality"]),
        momentum=MomentumMetrics(**data["momentum"]),
        dividend=DividendMetrics(**data["dividend"]),
        analyst=AnalystMetrics(**data["analyst"]),
    )

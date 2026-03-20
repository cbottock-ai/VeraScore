import json

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.core.data_providers.fmp import fmp_batch_quote, fmp_stock_news, fmp_income_statement, fmp_analyst_estimates, fmp_historical_price_light
from src.core.database import get_db
from src.stocks.models import Stock
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


@router.get("/{ticker}/news")
async def stock_news(ticker: str, limit: int = Query(20, ge=1, le=50)):
    """Get recent news articles for a stock."""
    raw = await fmp_stock_news(ticker.upper(), limit=limit)
    news = [
        {
            "title": item.get("title"),
            "published_date": item.get("publishedDate"),
            "publisher": item.get("publisher"),
            "site": item.get("site"),
            "text": item.get("text"),
            "url": item.get("url"),
            "image": item.get("image"),
        }
        for item in raw
    ]
    return {"news": news}


@router.get("/{ticker}/income-statement")
async def income_statement(
    ticker: str,
    period: str = Query("annual", pattern="^(annual|quarter)$"),
    limit: int = Query(8, ge=1, le=20),
):
    """Get income statement history for a stock."""
    raw = await fmp_income_statement(ticker.upper(), limit=limit, period=period)
    statements = [
        {
            "date": item.get("date"),
            "revenue": item.get("revenue"),
            "gross_profit": item.get("grossProfit"),
            "operating_income": item.get("operatingIncome"),
            "net_income": item.get("netIncome"),
            "eps": item.get("eps"),
            "ebitda": item.get("ebitda"),
            "gross_profit_ratio": item.get("grossProfitRatio"),
            "operating_income_ratio": item.get("operatingIncomeRatio"),
            "net_income_ratio": item.get("netIncomeRatio"),
            "ebitda_ratio": item.get("ebitdaratio"),
        }
        for item in raw
    ]
    return {"statements": statements}


@router.get("/{ticker}/estimates")
async def analyst_estimates_endpoint(
    ticker: str,
    period: str = Query("annual", pattern="^(annual|quarter)$"),
    limit: int = Query(4, ge=1, le=12),
):
    """Get forward analyst estimates for a stock."""
    raw = await fmp_analyst_estimates(ticker.upper(), limit=limit, period=period)
    estimates = [
        {
            "date": item.get("date"),
            "revenue_avg": item.get("revenueAvg"),
            "revenue_low": item.get("revenueLow"),
            "revenue_high": item.get("revenueHigh"),
            "eps_avg": item.get("epsAvg"),
            "eps_low": item.get("epsLow"),
            "eps_high": item.get("epsHigh"),
            "net_income_avg": item.get("netIncomeAvg"),
            "ebitda_avg": item.get("ebitdaAvg"),
            "num_analysts_revenue": item.get("numAnalystsRevenue"),
            "num_analysts_eps": item.get("numAnalystsEps"),
        }
        for item in raw
    ]
    return {"estimates": estimates}


@router.get("/{ticker}/price-history")
async def price_history(
    ticker: str,
    range: str = Query("1Y", pattern="^(1W|1M|3M|6M|1Y|5Y)$"),
):
    """Get daily closing price history for a stock."""
    from datetime import date, timedelta
    today = date.today()
    delta_map = {
        "1W": timedelta(weeks=1),
        "1M": timedelta(days=30),
        "3M": timedelta(days=90),
        "6M": timedelta(days=180),
        "1Y": timedelta(days=365),
        "5Y": timedelta(days=365 * 5),
    }
    from_date = (today - delta_map[range]).isoformat()
    to_date = today.isoformat()
    raw = await fmp_historical_price_light(ticker.upper(), from_date, to_date)
    # FMP returns newest-first; reverse for chronological chart
    raw_sorted = sorted(raw, key=lambda x: x.get("date", ""))
    return [{"date": item["date"], "price": item.get("price")} for item in raw_sorted if item.get("price")]


@router.get("/{ticker}/profile")
async def stock_profile(ticker: str, db: Session = Depends(get_db)):
    """Get company profile with AI-generated description (cached in DB)."""
    from src.core.data_providers.fetcher import fetch_stock_info
    ticker = ticker.upper()
    info = await fetch_stock_info(ticker)

    # Check DB for cached description
    stock = db.get(Stock, ticker)
    if stock and stock.ai_description:
        description = stock.ai_description
    else:
        description = await _generate_description(ticker, info)
        # Persist to DB
        if stock and description:
            stock.ai_description = description
            db.commit()

    return {
        "description": description,
        "website": info.get("website"),
        "full_time_employees": info.get("full_time_employees"),
        "headquarters": info.get("headquarters"),
    }


async def _generate_description(ticker: str, info: dict) -> str | None:
    """Generate a company description using OpenAI."""
    from src.core.config import settings
    import openai

    if not settings.openai_api_key:
        return None

    name = info.get("name", ticker)
    sector = info.get("sector", "")
    industry = info.get("industry", "")
    market_cap = info.get("market_cap")
    market_cap_str = ""
    if market_cap:
        if market_cap >= 1e12:
            market_cap_str = f"${market_cap / 1e12:.1f}T market cap"
        elif market_cap >= 1e9:
            market_cap_str = f"${market_cap / 1e9:.1f}B market cap"

    prompt = (
        f"Write a concise 2-3 sentence business description for {name} ({ticker}), "
        f"a {industry} company in the {sector} sector"
        f"{f' with a {market_cap_str}' if market_cap_str else ''}. "
        "Describe what the company does, its main products or services, and its market position. "
        "Be factual and neutral. Do not mention stock price or financial metrics."
    )

    try:
        client = openai.AsyncOpenAI(api_key=settings.openai_api_key)
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            max_tokens=256,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.choices[0].message.content.strip()
    except Exception:
        return None


# ─── Stock Chat ────────────────────────────────────────────────────────────────

class StockChatMessage(BaseModel):
    role: str
    content: str

class StockChatRequest(BaseModel):
    messages: list[StockChatMessage]
    active_tab: str = "overview"
    context: dict = {}


@router.post("/{ticker}/chat")
async def stock_chat(ticker: str, body: StockChatRequest):
    """Stream a context-aware AI response about a specific stock."""
    from src.core.config import settings
    import openai

    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="AI not configured")

    ticker = ticker.upper()
    ctx = body.context

    # Build a rich system prompt from whatever context the frontend passes
    stock_name = ctx.get("name", ticker)
    sector = ctx.get("sector", "")
    industry = ctx.get("industry", "")
    price = ctx.get("price")
    tab = body.active_tab.replace("_", " ").title()

    context_lines = [
        f"Stock: {stock_name} ({ticker})",
        f"Sector: {sector} | Industry: {industry}",
        f"Current Price: ${price:.2f}" if price else "",
        f"User is viewing the '{tab}' tab.",
        "",
        "Available data:",
        json.dumps(ctx.get("data", {}), indent=2),
    ]
    context_block = "\n".join(l for l in context_lines if l is not None)

    system_prompt = f"""You are a financial analyst assistant embedded in a stock research platform. \
Help the user understand {stock_name} ({ticker}) based on the data currently shown on the page.

{context_block}

Guidelines:
- Be concise and direct. Use bullet points for lists.
- Reference specific numbers from the data when relevant.
- If a metric looks unusually high or low, explain why that might be.
- Do not give buy/sell investment advice.
- If you don't know something not in the data, say so clearly."""

    messages = [{"role": "system", "content": system_prompt}]
    messages += [{"role": m.role, "content": m.content} for m in body.messages]

    async def stream():
        try:
            client = openai.AsyncOpenAI(api_key=settings.openai_api_key)
            async with client.chat.completions.stream(
                model="gpt-4o-mini",
                max_tokens=1024,
                messages=messages,
            ) as stream:
                async for chunk in stream:
                    delta = chunk.choices[0].delta.content if chunk.choices else None
                    if delta:
                        yield f"data: {json.dumps(delta)}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps(f'Error: {str(e)}')}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")

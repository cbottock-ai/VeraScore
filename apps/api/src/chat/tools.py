import json
import logging
from typing import Any

from sqlalchemy.orm import Session

from src.core.data_providers.fetcher import fetch_fundamentals, fetch_search, fetch_stock_info
from src.earnings.ir_fetcher import fetch_earnings_content
from src.earnings.ir_sources import get_ir_source, seed_ir_sources
from src.earnings.sec_edgar import fetch_recent_filings
from src.earnings.service import (
    analyze_earnings_surprises,
    get_earnings_history,
    get_upcoming_earnings,
)
from src.portfolios.schemas import HoldingCreate, PortfolioCreate
from src.portfolios.service import (
    add_holding,
    create_portfolio,
    delete_holding,
    enrich_holdings,
    get_portfolio,
    list_portfolios,
)
from src.rag.search import get_transcript_summary, search_transcripts
from src.scoring.engine import calculate_composite_score, calculate_factor_score

logger = logging.getLogger(__name__)

# Provider-agnostic tool definitions
TOOL_DEFINITIONS: list[dict[str, Any]] = [
    {
        "name": "search_stocks",
        "description": "Search for stocks by name or ticker symbol. Returns matching companies with their ticker, name, and exchange.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query (company name or ticker)"},
                "limit": {"type": "integer", "description": "Max results to return", "default": 5},
            },
            "required": ["query"],
        },
    },
    {
        "name": "get_stock_info",
        "description": "Get current stock information including price, market cap, sector, and key metrics for a given ticker.",
        "parameters": {
            "type": "object",
            "properties": {
                "ticker": {"type": "string", "description": "Stock ticker symbol (e.g. AAPL)"},
            },
            "required": ["ticker"],
        },
    },
    {
        "name": "get_fundamentals",
        "description": "Get detailed fundamental data for a stock including valuation, growth, profitability, quality, momentum, dividend, and analyst data.",
        "parameters": {
            "type": "object",
            "properties": {
                "ticker": {"type": "string", "description": "Stock ticker symbol"},
            },
            "required": ["ticker"],
        },
    },
    {
        "name": "get_stock_score",
        "description": "Get the VeraScore composite score for a stock. Returns overall score (0-100) and factor breakdowns (valuation, growth, profitability, quality, momentum).",
        "parameters": {
            "type": "object",
            "properties": {
                "ticker": {"type": "string", "description": "Stock ticker symbol"},
            },
            "required": ["ticker"],
        },
    },
    {
        "name": "get_factor_score",
        "description": "Get a detailed score for a single factor (valuation, growth, profitability, quality, or momentum) for a stock.",
        "parameters": {
            "type": "object",
            "properties": {
                "ticker": {"type": "string", "description": "Stock ticker symbol"},
                "factor": {
                    "type": "string",
                    "description": "Factor name: valuation, growth, profitability, quality, or momentum",
                },
            },
            "required": ["ticker", "factor"],
        },
    },
    {
        "name": "list_portfolios",
        "description": "List all portfolios with their names, descriptions, and holdings count.",
        "parameters": {
            "type": "object",
            "properties": {},
        },
    },
    {
        "name": "get_portfolio",
        "description": "Get detailed portfolio information including all holdings with current prices, gains/losses, and scores.",
        "parameters": {
            "type": "object",
            "properties": {
                "portfolio_id": {"type": "integer", "description": "Portfolio ID"},
            },
            "required": ["portfolio_id"],
        },
    },
    {
        "name": "create_portfolio",
        "description": "Create a new investment portfolio.",
        "parameters": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Portfolio name"},
                "description": {"type": "string", "description": "Optional description"},
            },
            "required": ["name"],
        },
    },
    {
        "name": "add_holding",
        "description": "Add a stock holding to a portfolio.",
        "parameters": {
            "type": "object",
            "properties": {
                "portfolio_id": {"type": "integer", "description": "Portfolio ID"},
                "ticker": {"type": "string", "description": "Stock ticker symbol"},
                "shares": {"type": "number", "description": "Number of shares"},
                "cost_basis": {"type": "number", "description": "Total cost basis in dollars"},
            },
            "required": ["portfolio_id", "ticker", "shares", "cost_basis"],
        },
    },
    {
        "name": "remove_holding",
        "description": "Remove a holding from a portfolio by holding ID.",
        "parameters": {
            "type": "object",
            "properties": {
                "holding_id": {"type": "integer", "description": "Holding ID to remove"},
            },
            "required": ["holding_id"],
        },
    },
    # Earnings & RAG tools
    {
        "name": "get_earnings_history",
        "description": "Get historical earnings data for a stock including EPS and revenue actuals vs estimates, surprise percentages, and beat/miss history.",
        "parameters": {
            "type": "object",
            "properties": {
                "ticker": {"type": "string", "description": "Stock ticker symbol"},
                "limit": {"type": "integer", "description": "Number of quarters to return", "default": 12},
            },
            "required": ["ticker"],
        },
    },
    {
        "name": "get_upcoming_earnings",
        "description": "Get upcoming earnings announcements for the next N days across all stocks.",
        "parameters": {
            "type": "object",
            "properties": {
                "days": {"type": "integer", "description": "Number of days to look ahead", "default": 7},
            },
        },
    },
    {
        "name": "search_earnings_transcripts",
        "description": "Search earnings call transcripts using semantic search. Find what companies said about specific topics like AI, margins, guidance, etc.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query (e.g. 'AI strategy', 'margin expansion', 'guidance')"},
                "ticker": {"type": "string", "description": "Optional: limit search to specific ticker"},
                "top_k": {"type": "integer", "description": "Number of results to return", "default": 5},
            },
            "required": ["query"],
        },
    },
    {
        "name": "get_transcript_summary",
        "description": "Get a summary of a specific earnings call transcript including key topics discussed and speakers.",
        "parameters": {
            "type": "object",
            "properties": {
                "ticker": {"type": "string", "description": "Stock ticker symbol"},
                "year": {"type": "integer", "description": "Fiscal year (e.g. 2024)"},
                "quarter": {"type": "integer", "description": "Fiscal quarter (1-4)"},
            },
            "required": ["ticker", "year", "quarter"],
        },
    },
    {
        "name": "analyze_earnings_surprises",
        "description": "Analyze a stock's earnings surprise patterns - beat/miss rates, trends, and consistency.",
        "parameters": {
            "type": "object",
            "properties": {
                "ticker": {"type": "string", "description": "Stock ticker symbol"},
                "quarters": {"type": "integer", "description": "Number of quarters to analyze", "default": 12},
            },
            "required": ["ticker"],
        },
    },
    {
        "name": "get_earnings_documents",
        "description": "Get links to earnings documents (10-Q, 10-K, 8-K filings) from SEC EDGAR and company IR pages. Returns recent SEC filings and any available IR page content.",
        "parameters": {
            "type": "object",
            "properties": {
                "ticker": {"type": "string", "description": "Stock ticker symbol"},
                "limit": {"type": "integer", "description": "Max filings to return", "default": 5},
            },
            "required": ["ticker"],
        },
    },
]


async def execute_tool(name: str, args: dict[str, Any], db: Session) -> str:
    """Execute a tool by name and return the result as a JSON string."""
    try:
        if name == "search_stocks":
            results = await fetch_search(args["query"], args.get("limit", 5))
            return json.dumps(results, default=str)

        elif name == "get_stock_info":
            info = await fetch_stock_info(args["ticker"].upper())
            return json.dumps(info, default=str)

        elif name == "get_fundamentals":
            data = await fetch_fundamentals(args["ticker"].upper())
            return json.dumps(data, default=str)

        elif name == "get_stock_score":
            ticker = args["ticker"].upper()
            info = await fetch_stock_info(ticker)
            fundamentals = await fetch_fundamentals(ticker)
            result = calculate_composite_score(fundamentals, info)
            return json.dumps(result, default=str)

        elif name == "get_factor_score":
            ticker = args["ticker"].upper()
            info = await fetch_stock_info(ticker)
            fundamentals = await fetch_fundamentals(ticker)
            config_name = f"{args['factor']}_v1"
            result = calculate_factor_score(config_name, fundamentals, info)
            return json.dumps(result, default=str)

        elif name == "list_portfolios":
            portfolios = list_portfolios(db)
            return json.dumps([p.model_dump() for p in portfolios], default=str)

        elif name == "get_portfolio":
            portfolio = get_portfolio(args["portfolio_id"], db)
            if not portfolio:
                return json.dumps({"error": "Portfolio not found"})
            enriched = await enrich_holdings(portfolio.holdings)
            return json.dumps(
                {
                    "id": portfolio.id,
                    "name": portfolio.name,
                    "description": portfolio.description,
                    "holdings": [h.model_dump() for h in enriched],
                },
                default=str,
            )

        elif name == "create_portfolio":
            data = PortfolioCreate(name=args["name"], description=args.get("description"))
            result = create_portfolio(data, db)
            return json.dumps(result.model_dump(), default=str)

        elif name == "add_holding":
            data = HoldingCreate(
                ticker=args["ticker"].upper(),
                shares=args["shares"],
                cost_basis=args["cost_basis"],
            )
            holding = add_holding(args["portfolio_id"], data, db)
            if not holding:
                return json.dumps({"error": "Portfolio not found"})
            return json.dumps(
                {
                    "id": holding.id,
                    "ticker": holding.ticker,
                    "shares": holding.shares,
                    "cost_basis": holding.cost_basis,
                },
                default=str,
            )

        elif name == "remove_holding":
            success = delete_holding(args["holding_id"], db)
            if not success:
                return json.dumps({"error": "Holding not found"})
            return json.dumps({"success": True, "message": "Holding removed"})

        # Earnings & RAG tools
        elif name == "get_earnings_history":
            result = await get_earnings_history(
                args["ticker"].upper(), db, args.get("limit", 12)
            )
            return json.dumps(result.model_dump(), default=str)

        elif name == "get_upcoming_earnings":
            result = await get_upcoming_earnings(db, args.get("days", 7))
            return json.dumps(result.model_dump(), default=str)

        elif name == "search_earnings_transcripts":
            result = await search_transcripts(
                query=args["query"],
                db=db,
                ticker=args.get("ticker"),
                top_k=args.get("top_k", 5),
            )
            return json.dumps(result.model_dump(), default=str)

        elif name == "get_transcript_summary":
            result = await get_transcript_summary(
                ticker=args["ticker"].upper(),
                year=args["year"],
                quarter=args["quarter"],
                db=db,
            )
            return json.dumps(result, default=str)

        elif name == "analyze_earnings_surprises":
            # First ensure we have earnings data
            await get_earnings_history(
                args["ticker"].upper(), db, args.get("quarters", 12)
            )
            result = analyze_earnings_surprises(
                args["ticker"].upper(), db, args.get("quarters", 12)
            )
            if not result:
                return json.dumps({"error": "No earnings data found"})
            return json.dumps(result.model_dump(), default=str)

        elif name == "get_earnings_documents":
            ticker = args["ticker"].upper()
            limit = args.get("limit", 5)

            # Seed IR sources if needed
            seed_ir_sources(db)

            # Get SEC filings (always available)
            sec_filings = await fetch_recent_filings(ticker, limit=limit)

            # Try to get IR page content if we have a mapping
            ir_source = get_ir_source(ticker, db)
            ir_content = None
            if ir_source:
                ir_content = await fetch_earnings_content(ticker, db)

            return json.dumps(
                {
                    "ticker": ticker,
                    "sec_filings": [
                        {
                            "form_type": f.form_type,
                            "filing_date": f.filing_date,
                            "url": f.primary_doc_url,
                            "description": f.description,
                        }
                        for f in sec_filings
                    ],
                    "ir_source": {
                        "company": ir_source.company_name if ir_source else None,
                        "ir_url": ir_source.ir_home_url if ir_source else None,
                        "documents": [
                            {"type": d.doc_type, "url": d.url}
                            for d in (ir_content.documents if ir_content else [])
                        ],
                    },
                },
                default=str,
            )

        else:
            return json.dumps({"error": f"Unknown tool: {name}"})

    except Exception as e:
        logger.exception(f"Tool execution error: {name}")
        return json.dumps({"error": str(e)})


def get_anthropic_tools() -> list[dict]:
    """Convert tool definitions to Anthropic's tool format."""
    return [
        {
            "name": tool["name"],
            "description": tool["description"],
            "input_schema": tool["parameters"],
        }
        for tool in TOOL_DEFINITIONS
    ]


def get_openai_tools() -> list[dict]:
    """Convert tool definitions to OpenAI's function-calling format."""
    return [
        {
            "type": "function",
            "function": {
                "name": tool["name"],
                "description": tool["description"],
                "parameters": tool["parameters"],
            },
        }
        for tool in TOOL_DEFINITIONS
    ]

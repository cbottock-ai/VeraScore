"""
Column Registry - Maps watchlist columns to their data sources.

Each column defines:
- id: Unique identifier
- label: Display name
- source: Data category (quote, profile, fundamentals, growth, momentum, holding, computed)
- field: Field path within the source data
- format: Formatting hint (currency, percent, large_number, number, string)
"""

from dataclasses import dataclass
from enum import Enum


class DataSource(str, Enum):
    """Data source categories with different TTLs and fetch methods."""
    HOLDING = "holding"          # From database (user's position)
    QUOTE = "quote"              # Real-time price data (5 min TTL)
    PROFILE = "profile"          # Company info (daily TTL)
    FUNDAMENTALS = "fundamentals"  # Financial metrics (daily TTL)
    GROWTH = "growth"            # Historical CAGR rates (daily TTL)
    MOMENTUM = "momentum"        # Price momentum (daily TTL)
    COMPUTED = "computed"        # Calculated from other fields


class FormatType(str, Enum):
    STRING = "string"
    NUMBER = "number"
    CURRENCY = "currency"
    PERCENT = "percent"
    LARGE_NUMBER = "large_number"  # For market cap, revenue (B/M/T)
    SCORE = "score"


@dataclass
class ColumnDef:
    id: str
    label: str
    source: DataSource
    field: str  # Field path, e.g. "valuation.pe_ttm" or just "price"
    format: FormatType
    description: str = ""


# All available columns
COLUMN_REGISTRY: dict[str, ColumnDef] = {}


def _register(*columns: ColumnDef) -> None:
    for col in columns:
        COLUMN_REGISTRY[col.id] = col


# --- Holding (from user's portfolio) ---
_register(
    ColumnDef("ticker", "Ticker", DataSource.HOLDING, "ticker", FormatType.STRING),
    ColumnDef("shares", "Shares", DataSource.HOLDING, "shares", FormatType.NUMBER),
    ColumnDef("cost_basis", "Cost Basis", DataSource.HOLDING, "cost_basis", FormatType.CURRENCY),
    ColumnDef("cost_per_share", "Cost/Share", DataSource.COMPUTED, "cost_per_share", FormatType.CURRENCY),
    ColumnDef("purchase_date", "Purchase Date", DataSource.HOLDING, "purchase_date", FormatType.STRING),
)

# --- Quote (real-time, 5 min TTL) ---
_register(
    ColumnDef("price", "Last Price", DataSource.QUOTE, "price", FormatType.CURRENCY),
    ColumnDef("day_change", "Day Change $", DataSource.QUOTE, "change", FormatType.CURRENCY),
    ColumnDef("day_change_pct", "Day Change %", DataSource.QUOTE, "change_percent", FormatType.PERCENT),
)

# --- Computed from quote + holding ---
_register(
    ColumnDef("value", "Market Value", DataSource.COMPUTED, "current_value", FormatType.CURRENCY),
    ColumnDef("gain_loss", "Gain/Loss $", DataSource.COMPUTED, "gain_loss", FormatType.CURRENCY),
    ColumnDef("gain_loss_pct", "Gain/Loss %", DataSource.COMPUTED, "gain_loss_pct", FormatType.PERCENT),
)

# --- Profile (company info, daily TTL) ---
_register(
    ColumnDef("sector", "Sector", DataSource.PROFILE, "sector", FormatType.STRING),
    ColumnDef("industry", "Industry", DataSource.PROFILE, "industry", FormatType.STRING),
    ColumnDef("market_cap", "Market Cap", DataSource.PROFILE, "market_cap", FormatType.LARGE_NUMBER),
    ColumnDef("beta", "Beta", DataSource.PROFILE, "beta", FormatType.NUMBER),
    ColumnDef("week_52_high", "52W High", DataSource.PROFILE, "week_52_high", FormatType.CURRENCY),
    ColumnDef("week_52_low", "52W Low", DataSource.PROFILE, "week_52_low", FormatType.CURRENCY),
    ColumnDef("avg_volume", "Avg Volume", DataSource.PROFILE, "avg_volume", FormatType.LARGE_NUMBER),
)

# --- Valuation metrics (from fundamentals) ---
_register(
    ColumnDef("pe_ttm", "P/E (TTM)", DataSource.FUNDAMENTALS, "valuation.pe_ttm", FormatType.NUMBER),
    ColumnDef("pe_ntm", "P/E (NTM)", DataSource.FUNDAMENTALS, "valuation.pe_ntm", FormatType.NUMBER),
    ColumnDef("ps_ttm", "P/S (TTM)", DataSource.FUNDAMENTALS, "valuation.ps_ttm", FormatType.NUMBER),
    ColumnDef("pb_ratio", "P/B Ratio", DataSource.FUNDAMENTALS, "valuation.pb_ratio", FormatType.NUMBER),
    ColumnDef("ev_ebitda", "EV/EBITDA", DataSource.FUNDAMENTALS, "valuation.ev_to_ebitda", FormatType.NUMBER),
    ColumnDef("ev_revenue", "EV/Revenue", DataSource.FUNDAMENTALS, "valuation.ev_to_revenue", FormatType.NUMBER),
    ColumnDef("peg_ratio", "PEG Ratio", DataSource.FUNDAMENTALS, "valuation.peg_ratio", FormatType.NUMBER),
    ColumnDef("eps_ttm", "EPS (TTM)", DataSource.FUNDAMENTALS, "valuation.eps_ttm", FormatType.CURRENCY),
    ColumnDef("eps_ntm", "EPS (NTM)", DataSource.FUNDAMENTALS, "valuation.eps_ntm", FormatType.CURRENCY),
)

# --- Growth metrics ---
_register(
    ColumnDef("revenue_growth_yoy", "Rev Growth YoY", DataSource.FUNDAMENTALS, "growth.revenue_growth_yoy", FormatType.PERCENT),
    ColumnDef("earnings_growth_yoy", "Earnings Growth YoY", DataSource.FUNDAMENTALS, "growth.earnings_growth_yoy", FormatType.PERCENT),
    ColumnDef("revenue_growth_3y", "Rev CAGR 3Y", DataSource.GROWTH, "revenue_growth_3y", FormatType.PERCENT),
    ColumnDef("earnings_growth_3y", "Earnings CAGR 3Y", DataSource.GROWTH, "earnings_growth_3y", FormatType.PERCENT),
    ColumnDef("revenue_growth_5y", "Rev CAGR 5Y", DataSource.GROWTH, "revenue_growth_5y", FormatType.PERCENT),
    ColumnDef("revenue_growth_10y", "Rev CAGR 10Y", DataSource.GROWTH, "revenue_growth_10y", FormatType.PERCENT),
)

# --- Profitability metrics ---
_register(
    ColumnDef("gross_margin", "Gross Margin", DataSource.FUNDAMENTALS, "profitability.gross_margin", FormatType.PERCENT),
    ColumnDef("ebitda_margin", "EBITDA Margin", DataSource.FUNDAMENTALS, "profitability.ebitda_margin", FormatType.PERCENT),
    ColumnDef("operating_margin", "Op Margin", DataSource.FUNDAMENTALS, "profitability.operating_margin", FormatType.PERCENT),
    ColumnDef("net_margin", "Net Margin", DataSource.FUNDAMENTALS, "profitability.net_margin", FormatType.PERCENT),
    ColumnDef("roe", "ROE", DataSource.FUNDAMENTALS, "profitability.roe", FormatType.PERCENT),
    ColumnDef("roa", "ROA", DataSource.FUNDAMENTALS, "profitability.roa", FormatType.PERCENT),
)

# --- Quality/Balance Sheet metrics ---
_register(
    ColumnDef("current_ratio", "Current Ratio", DataSource.FUNDAMENTALS, "quality.current_ratio", FormatType.NUMBER),
    ColumnDef("quick_ratio", "Quick Ratio", DataSource.FUNDAMENTALS, "quality.quick_ratio", FormatType.NUMBER),
    ColumnDef("debt_to_equity", "Debt/Equity", DataSource.FUNDAMENTALS, "quality.debt_to_equity", FormatType.NUMBER),
    ColumnDef("total_debt", "Total Debt", DataSource.FUNDAMENTALS, "quality.total_debt", FormatType.LARGE_NUMBER),
    ColumnDef("total_cash", "Total Cash", DataSource.FUNDAMENTALS, "quality.total_cash", FormatType.LARGE_NUMBER),
    ColumnDef("fcf", "Free Cash Flow", DataSource.FUNDAMENTALS, "quality.free_cash_flow", FormatType.LARGE_NUMBER),
    ColumnDef("ocf", "Operating CF", DataSource.FUNDAMENTALS, "quality.operating_cash_flow", FormatType.LARGE_NUMBER),
    ColumnDef("fcf_yield", "FCF Yield", DataSource.FUNDAMENTALS, "quality.fcf_yield", FormatType.PERCENT),
)

# --- Momentum ---
_register(
    ColumnDef("price_change_1m", "1M Return", DataSource.MOMENTUM, "price_change_1m", FormatType.PERCENT),
    ColumnDef("price_change_3m", "3M Return", DataSource.MOMENTUM, "price_change_3m", FormatType.PERCENT),
    ColumnDef("price_change_6m", "6M Return", DataSource.MOMENTUM, "price_change_6m", FormatType.PERCENT),
    ColumnDef("price_change_1y", "1Y Return", DataSource.MOMENTUM, "price_change_1y", FormatType.PERCENT),
)

# --- Dividend ---
_register(
    ColumnDef("dividend_yield", "Div Yield", DataSource.FUNDAMENTALS, "dividend.dividend_yield", FormatType.PERCENT),
    ColumnDef("payout_ratio", "Payout Ratio", DataSource.FUNDAMENTALS, "dividend.payout_ratio", FormatType.PERCENT),
)

# --- Analyst ---
_register(
    ColumnDef("target_price", "Target Price", DataSource.FUNDAMENTALS, "analyst.target_mean", FormatType.CURRENCY),
    ColumnDef("analyst_rating", "Analyst Rating", DataSource.FUNDAMENTALS, "analyst.rating", FormatType.STRING),
    ColumnDef("num_analysts", "# Analysts", DataSource.FUNDAMENTALS, "analyst.num_analysts", FormatType.NUMBER),
)

# --- VeraScore ---
_register(
    ColumnDef("score", "VeraScore", DataSource.COMPUTED, "score", FormatType.SCORE),
)


def get_required_sources(column_ids: list[str]) -> set[DataSource]:
    """Determine which data sources are needed for the requested columns."""
    sources = set()
    for col_id in column_ids:
        if col_id in COLUMN_REGISTRY:
            col = COLUMN_REGISTRY[col_id]
            sources.add(col.source)
            # Computed fields may need multiple sources
            if col.source == DataSource.COMPUTED:
                if col_id in ("value", "gain_loss", "gain_loss_pct", "cost_per_share"):
                    sources.add(DataSource.HOLDING)
                    sources.add(DataSource.QUOTE)
                if col_id == "score":
                    sources.add(DataSource.FUNDAMENTALS)
                    sources.add(DataSource.PROFILE)
    return sources


def get_column_def(column_id: str) -> ColumnDef | None:
    return COLUMN_REGISTRY.get(column_id)


def list_all_columns() -> list[dict]:
    """Return all available columns for the frontend."""
    return [
        {
            "id": col.id,
            "label": col.label,
            "source": col.source.value,
            "format": col.format.value,
            "description": col.description,
        }
        for col in COLUMN_REGISTRY.values()
    ]

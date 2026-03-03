"""
Column Registry - Maps watchlist columns to their FMP data sources.

Each column defines:
- id: Unique identifier
- label: Display name
- source: Data category (quote, profile, fundamentals, holding, computed)
- field: Field path within the source data
- format: Formatting hint (currency, percent, large_number, number, string)
"""

from dataclasses import dataclass
from enum import Enum


class DataSource(str, Enum):
    """Data source categories - all from FMP except HOLDING and COMPUTED."""
    HOLDING = "holding"
    QUOTE = "quote"
    PROFILE = "profile"
    FUNDAMENTALS = "fundamentals"
    COMPUTED = "computed"


class FormatType(str, Enum):
    STRING = "string"
    NUMBER = "number"
    CURRENCY = "currency"
    PERCENT = "percent"
    LARGE_NUMBER = "large_number"
    SCORE = "score"
    DAYS = "days"
    RATIO = "ratio"


class Category(str, Enum):
    POSITION = "Position"
    PRICE = "Price"
    COMPANY = "Company"
    VALUATION = "Valuation"
    PER_SHARE = "Per Share"
    PROFITABILITY = "Profitability"
    GROWTH_YOY = "Growth (YoY)"
    GROWTH_3Y = "Growth (3Y CAGR)"
    GROWTH_5Y = "Growth (5Y CAGR)"
    GROWTH_10Y = "Growth (10Y CAGR)"
    LIQUIDITY = "Liquidity"
    LEVERAGE = "Leverage"
    EFFICIENCY = "Efficiency"
    CASH_FLOW = "Cash Flow"
    DIVIDEND = "Dividend"
    OTHER = "Other"
    ANALYST = "Analyst"


@dataclass
class ColumnDef:
    id: str
    label: str
    source: DataSource
    field: str
    format: FormatType
    category: Category
    description: str = ""


COLUMN_REGISTRY: dict[str, ColumnDef] = {}


def _register(category: Category, *columns: ColumnDef) -> None:
    for col in columns:
        col.category = category
        COLUMN_REGISTRY[col.id] = col


# =============================================================================
# POSITION (from user's portfolio database)
# =============================================================================
_register(Category.POSITION,
    ColumnDef("ticker", "Ticker", DataSource.HOLDING, "ticker", FormatType.STRING, Category.POSITION),
    ColumnDef("shares", "Shares", DataSource.HOLDING, "shares", FormatType.NUMBER, Category.POSITION),
    ColumnDef("cost_basis", "Cost Basis", DataSource.HOLDING, "cost_basis", FormatType.CURRENCY, Category.POSITION),
    ColumnDef("cost_per_share", "Cost/Share", DataSource.COMPUTED, "cost_per_share", FormatType.CURRENCY, Category.POSITION),
    ColumnDef("purchase_date", "Purchase Date", DataSource.HOLDING, "purchase_date", FormatType.STRING, Category.POSITION),
    ColumnDef("value", "Mkt Value", DataSource.COMPUTED, "current_value", FormatType.CURRENCY, Category.POSITION),
    ColumnDef("gain_loss", "Gain/Loss $", DataSource.COMPUTED, "gain_loss", FormatType.CURRENCY, Category.POSITION),
    ColumnDef("gain_loss_pct", "Gain/Loss %", DataSource.COMPUTED, "gain_loss_pct", FormatType.PERCENT, Category.POSITION),
    ColumnDef("score", "VeraScore", DataSource.COMPUTED, "score", FormatType.SCORE, Category.POSITION),
)

# =============================================================================
# PRICE (FMP real-time, 5 min TTL)
# =============================================================================
_register(Category.PRICE,
    ColumnDef("price", "Price", DataSource.QUOTE, "price", FormatType.CURRENCY, Category.PRICE),
    ColumnDef("day_change", "Day Chg $", DataSource.QUOTE, "change", FormatType.CURRENCY, Category.PRICE),
    ColumnDef("day_change_pct", "Day Chg %", DataSource.QUOTE, "change_percent", FormatType.PERCENT, Category.PRICE),
    ColumnDef("volume", "Volume", DataSource.QUOTE, "volume", FormatType.LARGE_NUMBER, Category.PRICE),
    ColumnDef("day_high", "Day High", DataSource.QUOTE, "day_high", FormatType.CURRENCY, Category.PRICE),
    ColumnDef("day_low", "Day Low", DataSource.QUOTE, "day_low", FormatType.CURRENCY, Category.PRICE),
    ColumnDef("open", "Open", DataSource.QUOTE, "open", FormatType.CURRENCY, Category.PRICE),
    ColumnDef("prev_close", "Prev Close", DataSource.QUOTE, "previous_close", FormatType.CURRENCY, Category.PRICE),
    ColumnDef("year_high", "52W High", DataSource.QUOTE, "year_high", FormatType.CURRENCY, Category.PRICE),
    ColumnDef("year_low", "52W Low", DataSource.QUOTE, "year_low", FormatType.CURRENCY, Category.PRICE),
    ColumnDef("avg_50", "50D Avg", DataSource.QUOTE, "avg_50", FormatType.CURRENCY, Category.PRICE),
    ColumnDef("avg_200", "200D Avg", DataSource.QUOTE, "avg_200", FormatType.CURRENCY, Category.PRICE),
)

# =============================================================================
# COMPANY (FMP company info, daily TTL)
# =============================================================================
_register(Category.COMPANY,
    ColumnDef("name", "Name", DataSource.PROFILE, "name", FormatType.STRING, Category.COMPANY),
    ColumnDef("sector", "Sector", DataSource.PROFILE, "sector", FormatType.STRING, Category.COMPANY),
    ColumnDef("industry", "Industry", DataSource.PROFILE, "industry", FormatType.STRING, Category.COMPANY),
    ColumnDef("market_cap", "Mkt Cap", DataSource.PROFILE, "market_cap", FormatType.LARGE_NUMBER, Category.COMPANY),
    ColumnDef("beta", "Beta", DataSource.PROFILE, "beta", FormatType.NUMBER, Category.COMPANY),
    ColumnDef("avg_volume", "Avg Vol", DataSource.PROFILE, "avg_volume", FormatType.LARGE_NUMBER, Category.COMPANY),
    ColumnDef("exchange", "Exchange", DataSource.PROFILE, "exchange", FormatType.STRING, Category.COMPANY),
    ColumnDef("employees", "Employees", DataSource.PROFILE, "employees", FormatType.LARGE_NUMBER, Category.COMPANY),
    ColumnDef("country", "Country", DataSource.PROFILE, "country", FormatType.STRING, Category.COMPANY),
    ColumnDef("ipo_date", "IPO Date", DataSource.PROFILE, "ipo_date", FormatType.STRING, Category.COMPANY),
)

# =============================================================================
# VALUATION (FMP ratios/estimates)
# =============================================================================
_register(Category.VALUATION,
    ColumnDef("pe_ttm", "P/E TTM", DataSource.FUNDAMENTALS, "valuation.pe_ttm", FormatType.RATIO, Category.VALUATION),
    ColumnDef("pe_ntm", "P/E NTM", DataSource.FUNDAMENTALS, "valuation.pe_ntm", FormatType.RATIO, Category.VALUATION),
    ColumnDef("ps_ttm", "P/S TTM", DataSource.FUNDAMENTALS, "valuation.ps_ttm", FormatType.RATIO, Category.VALUATION),
    ColumnDef("pb_ratio", "P/B", DataSource.FUNDAMENTALS, "valuation.pb_ratio", FormatType.RATIO, Category.VALUATION),
    ColumnDef("price_to_tangible_book", "P/TB", DataSource.FUNDAMENTALS, "valuation.price_to_tangible_book", FormatType.RATIO, Category.VALUATION),
    ColumnDef("ev_to_ebitda", "EV/EBITDA", DataSource.FUNDAMENTALS, "valuation.ev_to_ebitda", FormatType.RATIO, Category.VALUATION),
    ColumnDef("ev_to_sales", "EV/Sales", DataSource.FUNDAMENTALS, "valuation.ev_to_sales", FormatType.RATIO, Category.VALUATION),
    ColumnDef("ev_to_fcf", "EV/FCF", DataSource.FUNDAMENTALS, "valuation.ev_to_fcf", FormatType.RATIO, Category.VALUATION),
    ColumnDef("ev_to_ocf", "EV/OCF", DataSource.FUNDAMENTALS, "valuation.ev_to_ocf", FormatType.RATIO, Category.VALUATION),
    ColumnDef("price_to_fcf", "P/FCF", DataSource.FUNDAMENTALS, "valuation.price_to_fcf", FormatType.RATIO, Category.VALUATION),
    ColumnDef("price_to_ocf", "P/OCF", DataSource.FUNDAMENTALS, "valuation.price_to_ocf", FormatType.RATIO, Category.VALUATION),
    ColumnDef("peg_ratio", "PEG", DataSource.FUNDAMENTALS, "valuation.peg_ratio", FormatType.RATIO, Category.VALUATION),
    ColumnDef("forward_peg", "Fwd PEG", DataSource.FUNDAMENTALS, "valuation.forward_peg", FormatType.RATIO, Category.VALUATION),
    ColumnDef("ev_multiple", "EV Multiple", DataSource.FUNDAMENTALS, "valuation.ev_multiple", FormatType.RATIO, Category.VALUATION),
    ColumnDef("enterprise_value", "EV", DataSource.FUNDAMENTALS, "valuation.enterprise_value", FormatType.LARGE_NUMBER, Category.VALUATION),
    ColumnDef("earnings_yield", "Earn Yield", DataSource.FUNDAMENTALS, "valuation.earnings_yield", FormatType.PERCENT, Category.VALUATION),
    ColumnDef("fcf_yield", "FCF Yield", DataSource.FUNDAMENTALS, "valuation.fcf_yield", FormatType.PERCENT, Category.VALUATION),
    ColumnDef("graham_number", "Graham #", DataSource.FUNDAMENTALS, "valuation.graham_number", FormatType.CURRENCY, Category.VALUATION),
)

# =============================================================================
# PER SHARE METRICS
# =============================================================================
_register(Category.PER_SHARE,
    ColumnDef("eps_ttm", "EPS TTM", DataSource.FUNDAMENTALS, "per_share.eps_ttm", FormatType.CURRENCY, Category.PER_SHARE),
    ColumnDef("eps_ntm", "EPS NTM", DataSource.FUNDAMENTALS, "per_share.eps_ntm", FormatType.CURRENCY, Category.PER_SHARE),
    ColumnDef("revenue_per_share", "Rev/Share", DataSource.FUNDAMENTALS, "per_share.revenue_per_share", FormatType.CURRENCY, Category.PER_SHARE),
    ColumnDef("book_value_per_share", "BV/Share", DataSource.FUNDAMENTALS, "per_share.book_value_per_share", FormatType.CURRENCY, Category.PER_SHARE),
    ColumnDef("tangible_book_per_share", "TBV/Share", DataSource.FUNDAMENTALS, "per_share.tangible_book_per_share", FormatType.CURRENCY, Category.PER_SHARE),
    ColumnDef("fcf_per_share", "FCF/Share", DataSource.FUNDAMENTALS, "per_share.fcf_per_share", FormatType.CURRENCY, Category.PER_SHARE),
    ColumnDef("ocf_per_share", "OCF/Share", DataSource.FUNDAMENTALS, "per_share.ocf_per_share", FormatType.CURRENCY, Category.PER_SHARE),
    ColumnDef("cash_per_share", "Cash/Share", DataSource.FUNDAMENTALS, "per_share.cash_per_share", FormatType.CURRENCY, Category.PER_SHARE),
    ColumnDef("dividend_per_share", "Div/Share", DataSource.FUNDAMENTALS, "per_share.dividend_per_share", FormatType.CURRENCY, Category.PER_SHARE),
    ColumnDef("capex_per_share", "Capex/Share", DataSource.FUNDAMENTALS, "per_share.capex_per_share", FormatType.CURRENCY, Category.PER_SHARE),
    ColumnDef("equity_per_share", "Equity/Share", DataSource.FUNDAMENTALS, "per_share.shareholders_equity_per_share", FormatType.CURRENCY, Category.PER_SHARE),
)

# =============================================================================
# PROFITABILITY
# =============================================================================
_register(Category.PROFITABILITY,
    ColumnDef("gross_margin", "Gross Margin", DataSource.FUNDAMENTALS, "profitability.gross_margin", FormatType.PERCENT, Category.PROFITABILITY),
    ColumnDef("ebitda_margin", "EBITDA Margin", DataSource.FUNDAMENTALS, "profitability.ebitda_margin", FormatType.PERCENT, Category.PROFITABILITY),
    ColumnDef("ebit_margin", "EBIT Margin", DataSource.FUNDAMENTALS, "profitability.ebit_margin", FormatType.PERCENT, Category.PROFITABILITY),
    ColumnDef("operating_margin", "Op Margin", DataSource.FUNDAMENTALS, "profitability.operating_margin", FormatType.PERCENT, Category.PROFITABILITY),
    ColumnDef("pretax_margin", "Pretax Margin", DataSource.FUNDAMENTALS, "profitability.pretax_margin", FormatType.PERCENT, Category.PROFITABILITY),
    ColumnDef("net_margin", "Net Margin", DataSource.FUNDAMENTALS, "profitability.net_margin", FormatType.PERCENT, Category.PROFITABILITY),
    ColumnDef("bottom_line_margin", "Bottom Line", DataSource.FUNDAMENTALS, "profitability.bottom_line_margin", FormatType.PERCENT, Category.PROFITABILITY),
    ColumnDef("roe", "ROE", DataSource.FUNDAMENTALS, "profitability.roe", FormatType.PERCENT, Category.PROFITABILITY),
    ColumnDef("roa", "ROA", DataSource.FUNDAMENTALS, "profitability.roa", FormatType.PERCENT, Category.PROFITABILITY),
    ColumnDef("roic", "ROIC", DataSource.FUNDAMENTALS, "profitability.roic", FormatType.PERCENT, Category.PROFITABILITY),
    ColumnDef("roce", "ROCE", DataSource.FUNDAMENTALS, "profitability.roce", FormatType.PERCENT, Category.PROFITABILITY),
    ColumnDef("rota", "ROTA", DataSource.FUNDAMENTALS, "profitability.rota", FormatType.PERCENT, Category.PROFITABILITY),
    ColumnDef("operating_roa", "Op ROA", DataSource.FUNDAMENTALS, "profitability.operating_roa", FormatType.PERCENT, Category.PROFITABILITY),
)

# =============================================================================
# GROWTH - YoY
# =============================================================================
_register(Category.GROWTH_YOY,
    ColumnDef("revenue_growth_yoy", "Rev Growth YoY", DataSource.FUNDAMENTALS, "growth.revenue_growth_yoy", FormatType.PERCENT, Category.GROWTH_YOY),
    ColumnDef("gross_profit_growth_yoy", "GP Growth YoY", DataSource.FUNDAMENTALS, "growth.gross_profit_growth_yoy", FormatType.PERCENT, Category.GROWTH_YOY),
    ColumnDef("operating_income_growth_yoy", "Op Inc Growth YoY", DataSource.FUNDAMENTALS, "growth.operating_income_growth_yoy", FormatType.PERCENT, Category.GROWTH_YOY),
    ColumnDef("ebitda_growth_yoy", "EBITDA Growth YoY", DataSource.FUNDAMENTALS, "growth.ebitda_growth_yoy", FormatType.PERCENT, Category.GROWTH_YOY),
    ColumnDef("ebit_growth_yoy", "EBIT Growth YoY", DataSource.FUNDAMENTALS, "growth.ebit_growth_yoy", FormatType.PERCENT, Category.GROWTH_YOY),
    ColumnDef("net_income_growth_yoy", "NI Growth YoY", DataSource.FUNDAMENTALS, "growth.net_income_growth_yoy", FormatType.PERCENT, Category.GROWTH_YOY),
    ColumnDef("eps_growth_yoy", "EPS Growth YoY", DataSource.FUNDAMENTALS, "growth.eps_growth_yoy", FormatType.PERCENT, Category.GROWTH_YOY),
    ColumnDef("eps_diluted_growth_yoy", "EPS Dil Growth YoY", DataSource.FUNDAMENTALS, "growth.eps_diluted_growth_yoy", FormatType.PERCENT, Category.GROWTH_YOY),
    ColumnDef("fcf_growth_yoy", "FCF Growth YoY", DataSource.FUNDAMENTALS, "growth.fcf_growth_yoy", FormatType.PERCENT, Category.GROWTH_YOY),
    ColumnDef("ocf_growth_yoy", "OCF Growth YoY", DataSource.FUNDAMENTALS, "growth.ocf_growth_yoy", FormatType.PERCENT, Category.GROWTH_YOY),
    ColumnDef("dividend_growth_yoy", "Div Growth YoY", DataSource.FUNDAMENTALS, "growth.dividend_growth_yoy", FormatType.PERCENT, Category.GROWTH_YOY),
    ColumnDef("asset_growth_yoy", "Asset Growth YoY", DataSource.FUNDAMENTALS, "growth.asset_growth_yoy", FormatType.PERCENT, Category.GROWTH_YOY),
    ColumnDef("debt_growth_yoy", "Debt Growth YoY", DataSource.FUNDAMENTALS, "growth.debt_growth_yoy", FormatType.PERCENT, Category.GROWTH_YOY),
    ColumnDef("rd_growth_yoy", "R&D Growth YoY", DataSource.FUNDAMENTALS, "growth.rd_growth_yoy", FormatType.PERCENT, Category.GROWTH_YOY),
    ColumnDef("sga_growth_yoy", "SG&A Growth YoY", DataSource.FUNDAMENTALS, "growth.sga_growth_yoy", FormatType.PERCENT, Category.GROWTH_YOY),
    ColumnDef("book_value_growth_yoy", "BV Growth YoY", DataSource.FUNDAMENTALS, "growth.book_value_growth_yoy", FormatType.PERCENT, Category.GROWTH_YOY),
    ColumnDef("shares_growth_yoy", "Shares Growth YoY", DataSource.FUNDAMENTALS, "growth.shares_growth_yoy", FormatType.PERCENT, Category.GROWTH_YOY),
)

# =============================================================================
# GROWTH - 3 Year CAGR
# =============================================================================
_register(Category.GROWTH_3Y,
    ColumnDef("revenue_cagr_3y", "Rev CAGR 3Y", DataSource.FUNDAMENTALS, "growth.revenue_cagr_3y", FormatType.PERCENT, Category.GROWTH_3Y),
    ColumnDef("net_income_cagr_3y", "NI CAGR 3Y", DataSource.FUNDAMENTALS, "growth.net_income_cagr_3y", FormatType.PERCENT, Category.GROWTH_3Y),
    ColumnDef("ocf_cagr_3y", "OCF CAGR 3Y", DataSource.FUNDAMENTALS, "growth.ocf_cagr_3y", FormatType.PERCENT, Category.GROWTH_3Y),
    ColumnDef("dividend_cagr_3y", "Div CAGR 3Y", DataSource.FUNDAMENTALS, "growth.dividend_cagr_3y", FormatType.PERCENT, Category.GROWTH_3Y),
    ColumnDef("equity_cagr_3y", "Equity CAGR 3Y", DataSource.FUNDAMENTALS, "growth.equity_cagr_3y", FormatType.PERCENT, Category.GROWTH_3Y),
)

# =============================================================================
# GROWTH - 5 Year CAGR
# =============================================================================
_register(Category.GROWTH_5Y,
    ColumnDef("revenue_cagr_5y", "Rev CAGR 5Y", DataSource.FUNDAMENTALS, "growth.revenue_cagr_5y", FormatType.PERCENT, Category.GROWTH_5Y),
    ColumnDef("net_income_cagr_5y", "NI CAGR 5Y", DataSource.FUNDAMENTALS, "growth.net_income_cagr_5y", FormatType.PERCENT, Category.GROWTH_5Y),
    ColumnDef("ocf_cagr_5y", "OCF CAGR 5Y", DataSource.FUNDAMENTALS, "growth.ocf_cagr_5y", FormatType.PERCENT, Category.GROWTH_5Y),
    ColumnDef("dividend_cagr_5y", "Div CAGR 5Y", DataSource.FUNDAMENTALS, "growth.dividend_cagr_5y", FormatType.PERCENT, Category.GROWTH_5Y),
    ColumnDef("equity_cagr_5y", "Equity CAGR 5Y", DataSource.FUNDAMENTALS, "growth.equity_cagr_5y", FormatType.PERCENT, Category.GROWTH_5Y),
)

# =============================================================================
# GROWTH - 10 Year CAGR
# =============================================================================
_register(Category.GROWTH_10Y,
    ColumnDef("revenue_cagr_10y", "Rev CAGR 10Y", DataSource.FUNDAMENTALS, "growth.revenue_cagr_10y", FormatType.PERCENT, Category.GROWTH_10Y),
    ColumnDef("net_income_cagr_10y", "NI CAGR 10Y", DataSource.FUNDAMENTALS, "growth.net_income_cagr_10y", FormatType.PERCENT, Category.GROWTH_10Y),
    ColumnDef("ocf_cagr_10y", "OCF CAGR 10Y", DataSource.FUNDAMENTALS, "growth.ocf_cagr_10y", FormatType.PERCENT, Category.GROWTH_10Y),
    ColumnDef("dividend_cagr_10y", "Div CAGR 10Y", DataSource.FUNDAMENTALS, "growth.dividend_cagr_10y", FormatType.PERCENT, Category.GROWTH_10Y),
    ColumnDef("equity_cagr_10y", "Equity CAGR 10Y", DataSource.FUNDAMENTALS, "growth.equity_cagr_10y", FormatType.PERCENT, Category.GROWTH_10Y),
)

# =============================================================================
# LIQUIDITY & SOLVENCY
# =============================================================================
_register(Category.LIQUIDITY,
    ColumnDef("current_ratio", "Current Ratio", DataSource.FUNDAMENTALS, "liquidity.current_ratio", FormatType.RATIO, Category.LIQUIDITY),
    ColumnDef("quick_ratio", "Quick Ratio", DataSource.FUNDAMENTALS, "liquidity.quick_ratio", FormatType.RATIO, Category.LIQUIDITY),
    ColumnDef("cash_ratio", "Cash Ratio", DataSource.FUNDAMENTALS, "liquidity.cash_ratio", FormatType.RATIO, Category.LIQUIDITY),
    ColumnDef("working_capital", "Working Cap", DataSource.FUNDAMENTALS, "liquidity.working_capital", FormatType.LARGE_NUMBER, Category.LIQUIDITY),
    ColumnDef("solvency_ratio", "Solvency", DataSource.FUNDAMENTALS, "liquidity.solvency_ratio", FormatType.RATIO, Category.LIQUIDITY),
)

# =============================================================================
# LEVERAGE & DEBT
# =============================================================================
_register(Category.LEVERAGE,
    ColumnDef("debt_to_equity", "D/E", DataSource.FUNDAMENTALS, "leverage.debt_to_equity", FormatType.RATIO, Category.LEVERAGE),
    ColumnDef("debt_to_assets", "D/A", DataSource.FUNDAMENTALS, "leverage.debt_to_assets", FormatType.RATIO, Category.LEVERAGE),
    ColumnDef("debt_to_capital", "D/Cap", DataSource.FUNDAMENTALS, "leverage.debt_to_capital", FormatType.RATIO, Category.LEVERAGE),
    ColumnDef("debt_to_market_cap", "D/MktCap", DataSource.FUNDAMENTALS, "leverage.debt_to_market_cap", FormatType.RATIO, Category.LEVERAGE),
    ColumnDef("lt_debt_to_capital", "LTD/Cap", DataSource.FUNDAMENTALS, "leverage.long_term_debt_to_capital", FormatType.RATIO, Category.LEVERAGE),
    ColumnDef("financial_leverage", "Fin Leverage", DataSource.FUNDAMENTALS, "leverage.financial_leverage", FormatType.RATIO, Category.LEVERAGE),
    ColumnDef("interest_coverage", "Int Coverage", DataSource.FUNDAMENTALS, "leverage.interest_coverage", FormatType.RATIO, Category.LEVERAGE),
    ColumnDef("debt_service_coverage", "Debt Svc Cov", DataSource.FUNDAMENTALS, "leverage.debt_service_coverage", FormatType.RATIO, Category.LEVERAGE),
    ColumnDef("net_debt_to_ebitda", "NetD/EBITDA", DataSource.FUNDAMENTALS, "leverage.net_debt_to_ebitda", FormatType.RATIO, Category.LEVERAGE),
    ColumnDef("interest_debt_per_share", "Int Debt/Shr", DataSource.FUNDAMENTALS, "leverage.interest_debt_per_share", FormatType.CURRENCY, Category.LEVERAGE),
)

# =============================================================================
# EFFICIENCY & TURNOVER
# =============================================================================
_register(Category.EFFICIENCY,
    ColumnDef("asset_turnover", "Asset Turn", DataSource.FUNDAMENTALS, "efficiency.asset_turnover", FormatType.RATIO, Category.EFFICIENCY),
    ColumnDef("fixed_asset_turnover", "FA Turn", DataSource.FUNDAMENTALS, "efficiency.fixed_asset_turnover", FormatType.RATIO, Category.EFFICIENCY),
    ColumnDef("inventory_turnover", "Inv Turn", DataSource.FUNDAMENTALS, "efficiency.inventory_turnover", FormatType.RATIO, Category.EFFICIENCY),
    ColumnDef("receivables_turnover", "AR Turn", DataSource.FUNDAMENTALS, "efficiency.receivables_turnover", FormatType.RATIO, Category.EFFICIENCY),
    ColumnDef("payables_turnover", "AP Turn", DataSource.FUNDAMENTALS, "efficiency.payables_turnover", FormatType.RATIO, Category.EFFICIENCY),
    ColumnDef("wc_turnover", "WC Turn", DataSource.FUNDAMENTALS, "efficiency.working_capital_turnover", FormatType.RATIO, Category.EFFICIENCY),
    ColumnDef("days_inventory", "Days Inv", DataSource.FUNDAMENTALS, "efficiency.days_inventory", FormatType.DAYS, Category.EFFICIENCY),
    ColumnDef("days_receivables", "Days AR", DataSource.FUNDAMENTALS, "efficiency.days_receivables", FormatType.DAYS, Category.EFFICIENCY),
    ColumnDef("days_payables", "Days AP", DataSource.FUNDAMENTALS, "efficiency.days_payables", FormatType.DAYS, Category.EFFICIENCY),
    ColumnDef("cash_conversion_cycle", "CCC", DataSource.FUNDAMENTALS, "efficiency.cash_conversion_cycle", FormatType.DAYS, Category.EFFICIENCY),
    ColumnDef("operating_cycle", "Op Cycle", DataSource.FUNDAMENTALS, "efficiency.operating_cycle", FormatType.DAYS, Category.EFFICIENCY),
)

# =============================================================================
# CASH FLOW
# =============================================================================
_register(Category.CASH_FLOW,
    ColumnDef("ocf_margin", "OCF Margin", DataSource.FUNDAMENTALS, "cash_flow.ocf_margin", FormatType.PERCENT, Category.CASH_FLOW),
    ColumnDef("fcf_to_ocf", "FCF/OCF", DataSource.FUNDAMENTALS, "cash_flow.fcf_to_ocf", FormatType.PERCENT, Category.CASH_FLOW),
    ColumnDef("capex_to_ocf", "Capex/OCF", DataSource.FUNDAMENTALS, "cash_flow.capex_to_ocf", FormatType.PERCENT, Category.CASH_FLOW),
    ColumnDef("capex_to_revenue", "Capex/Rev", DataSource.FUNDAMENTALS, "cash_flow.capex_to_revenue", FormatType.PERCENT, Category.CASH_FLOW),
    ColumnDef("capex_to_depreciation", "Capex/Depr", DataSource.FUNDAMENTALS, "cash_flow.capex_to_depreciation", FormatType.RATIO, Category.CASH_FLOW),
    ColumnDef("capex_coverage", "Capex Cov", DataSource.FUNDAMENTALS, "cash_flow.capex_coverage", FormatType.RATIO, Category.CASH_FLOW),
    ColumnDef("dividend_capex_coverage", "Div+Capex Cov", DataSource.FUNDAMENTALS, "cash_flow.dividend_capex_coverage", FormatType.RATIO, Category.CASH_FLOW),
    ColumnDef("ocf_coverage", "OCF Coverage", DataSource.FUNDAMENTALS, "cash_flow.ocf_coverage", FormatType.RATIO, Category.CASH_FLOW),
    ColumnDef("income_quality", "Inc Quality", DataSource.FUNDAMENTALS, "cash_flow.income_quality", FormatType.RATIO, Category.CASH_FLOW),
    ColumnDef("fcf_to_equity", "FCF to Equity", DataSource.FUNDAMENTALS, "cash_flow.fcf_to_equity", FormatType.LARGE_NUMBER, Category.CASH_FLOW),
    ColumnDef("fcf_to_firm", "FCF to Firm", DataSource.FUNDAMENTALS, "cash_flow.fcf_to_firm", FormatType.LARGE_NUMBER, Category.CASH_FLOW),
)

# =============================================================================
# DIVIDEND
# =============================================================================
_register(Category.DIVIDEND,
    ColumnDef("dividend_yield", "Div Yield", DataSource.FUNDAMENTALS, "dividend.dividend_yield", FormatType.PERCENT, Category.DIVIDEND),
    ColumnDef("payout_ratio", "Payout Ratio", DataSource.FUNDAMENTALS, "dividend.payout_ratio", FormatType.PERCENT, Category.DIVIDEND),
)

# =============================================================================
# OTHER METRICS
# =============================================================================
_register(Category.OTHER,
    ColumnDef("effective_tax_rate", "Tax Rate", DataSource.FUNDAMENTALS, "other.effective_tax_rate", FormatType.PERCENT, Category.OTHER),
    ColumnDef("tax_burden", "Tax Burden", DataSource.FUNDAMENTALS, "other.tax_burden", FormatType.RATIO, Category.OTHER),
    ColumnDef("interest_burden", "Int Burden", DataSource.FUNDAMENTALS, "other.interest_burden", FormatType.RATIO, Category.OTHER),
    ColumnDef("rd_to_revenue", "R&D/Rev", DataSource.FUNDAMENTALS, "other.rd_to_revenue", FormatType.PERCENT, Category.OTHER),
    ColumnDef("sga_to_revenue", "SG&A/Rev", DataSource.FUNDAMENTALS, "other.sga_to_revenue", FormatType.PERCENT, Category.OTHER),
    ColumnDef("stock_comp_to_revenue", "SBC/Rev", DataSource.FUNDAMENTALS, "other.stock_comp_to_revenue", FormatType.PERCENT, Category.OTHER),
    ColumnDef("intangibles_to_assets", "Intang/Assets", DataSource.FUNDAMENTALS, "other.intangibles_to_assets", FormatType.PERCENT, Category.OTHER),
    ColumnDef("invested_capital", "Inv Capital", DataSource.FUNDAMENTALS, "other.invested_capital", FormatType.LARGE_NUMBER, Category.OTHER),
    ColumnDef("tangible_asset_value", "Tang Assets", DataSource.FUNDAMENTALS, "other.tangible_asset_value", FormatType.LARGE_NUMBER, Category.OTHER),
    ColumnDef("net_current_asset_value", "NCAV", DataSource.FUNDAMENTALS, "other.net_current_asset_value", FormatType.LARGE_NUMBER, Category.OTHER),
)

# =============================================================================
# ANALYST ESTIMATES
# =============================================================================
_register(Category.ANALYST,
    ColumnDef("eps_estimate", "EPS Est", DataSource.FUNDAMENTALS, "analyst.eps_estimate", FormatType.CURRENCY, Category.ANALYST),
    ColumnDef("eps_estimate_high", "EPS Est High", DataSource.FUNDAMENTALS, "analyst.eps_estimate_high", FormatType.CURRENCY, Category.ANALYST),
    ColumnDef("eps_estimate_low", "EPS Est Low", DataSource.FUNDAMENTALS, "analyst.eps_estimate_low", FormatType.CURRENCY, Category.ANALYST),
    ColumnDef("revenue_estimate", "Rev Est", DataSource.FUNDAMENTALS, "analyst.revenue_estimate", FormatType.LARGE_NUMBER, Category.ANALYST),
    ColumnDef("num_analysts", "# Analysts", DataSource.FUNDAMENTALS, "analyst.num_analysts_eps", FormatType.NUMBER, Category.ANALYST),
)


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

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
            "category": col.category.value,
            "description": col.description,
        }
        for col in COLUMN_REGISTRY.values()
    ]


def list_categories() -> list[str]:
    """Return all category names in order."""
    return [c.value for c in Category]

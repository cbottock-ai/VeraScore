"""
FMP-based data fetcher - Primary data source for all stock data.
"""

import asyncio
import logging
from datetime import datetime
from typing import Any

from src.core.data_providers.cache import (
    CACHE_TTL_FUNDAMENTALS,
    CACHE_TTL_PRICES,
    cache_get,
    cache_set,
)
from src.core.data_providers.fmp import (
    fmp_financial_growth,
    fmp_key_metrics_ttm,
    fmp_profile,
    fmp_quote,
    fmp_ratios_ttm,
)
from src.core.config import settings
import httpx

logger = logging.getLogger(__name__)

FMP_BASE = "https://financialmodelingprep.com/stable"


async def _fmp_analyst_estimates_current(ticker: str) -> dict | None:
    """Get current fiscal year analyst estimates for forward P/E calculation."""
    if not settings.fmp_api_key:
        return None
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{FMP_BASE}/analyst-estimates",
                params={
                    "symbol": ticker,
                    "period": "annual",
                    "limit": 5,
                    "apikey": settings.fmp_api_key,
                },
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
            if not isinstance(data, list) or not data:
                return None

            # Find the estimate for current fiscal year (prefer current over next)
            current_year = datetime.now().year
            current_year_est = None
            next_year_est = None

            for est in data:
                est_date = est.get("date", "")
                if est_date:
                    est_year = int(est_date[:4])
                    if est_year == current_year:
                        current_year_est = est
                    elif est_year == current_year + 1 and next_year_est is None:
                        next_year_est = est

            # Prefer current year, fall back to next year
            if current_year_est:
                return current_year_est
            if next_year_est:
                return next_year_est

            # Fall back to the estimate closest to current year
            closest = None
            min_diff = float('inf')
            for est in data:
                est_date = est.get("date", "")
                if est_date:
                    est_year = int(est_date[:4])
                    diff = abs(est_year - current_year)
                    if diff < min_diff:
                        min_diff = diff
                        closest = est
            return closest
    except Exception as e:
        logger.warning(f"FMP analyst estimates failed for {ticker}: {e}")
        return None


async def fetch_fmp_quote(ticker: str) -> dict:
    """Fetch real-time quote data from FMP."""
    cache_key = f"fmp_quote:{ticker}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    quote = await fmp_quote(ticker)
    if not quote:
        return {}

    result = {
        "price": quote.get("price"),
        "change": quote.get("change"),
        "change_percent": quote.get("changePercentage"),
        "volume": quote.get("volume"),
        "day_high": quote.get("dayHigh"),
        "day_low": quote.get("dayLow"),
        "open": quote.get("open"),
        "previous_close": quote.get("previousClose"),
        "market_cap": quote.get("marketCap"),
        "year_high": quote.get("yearHigh"),
        "year_low": quote.get("yearLow"),
        "avg_50": quote.get("priceAvg50"),
        "avg_200": quote.get("priceAvg200"),
    }

    cache_set(cache_key, result, CACHE_TTL_PRICES)
    return result


async def fetch_fmp_profile(ticker: str) -> dict:
    """Fetch company profile from FMP."""
    cache_key = f"fmp_profile:{ticker}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    profile = await fmp_profile(ticker)
    if not profile:
        return {}

    result = {
        "name": profile.get("companyName"),
        "sector": profile.get("sector"),
        "industry": profile.get("industry"),
        "market_cap": profile.get("marketCap"),
        "beta": profile.get("beta"),
        "exchange": profile.get("exchange"),
        "ceo": profile.get("ceo"),
        "employees": profile.get("fullTimeEmployees"),
        "website": profile.get("website"),
        "description": profile.get("description"),
        "country": profile.get("country"),
        "ipo_date": profile.get("ipoDate"),
        "avg_volume": profile.get("averageVolume"),
    }

    cache_set(cache_key, result, CACHE_TTL_FUNDAMENTALS)
    return result


async def fetch_fmp_fundamentals(ticker: str) -> dict:
    """Fetch all fundamental data from FMP (ratios, metrics, estimates)."""
    cache_key = f"fmp_fundamentals:{ticker}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    # Fetch ratios, metrics, growth, and estimates in parallel
    ratios, metrics, growth, estimates = await asyncio.gather(
        fmp_ratios_ttm(ticker),
        fmp_key_metrics_ttm(ticker),
        fmp_financial_growth(ticker),
        _fmp_analyst_estimates_current(ticker),
        return_exceptions=True,
    )

    # Handle exceptions
    if isinstance(ratios, Exception):
        ratios = None
    if isinstance(metrics, Exception):
        metrics = None
    if isinstance(growth, Exception):
        growth = None
    if isinstance(estimates, Exception):
        estimates = None

    ratios = ratios or {}
    metrics = metrics or {}
    growth = growth or {}
    estimates = estimates or {}

    # Get quote for forward P/E calculation
    quote = await fetch_fmp_quote(ticker)
    price = quote.get("price")

    # Calculate forward P/E from analyst estimates
    forward_pe = None
    forward_eps = estimates.get("epsAvg")
    if price and forward_eps and forward_eps > 0:
        forward_pe = round(price / forward_eps, 2)

    result = {
        # === VALUATION ===
        "valuation": {
            "pe_ttm": _round(ratios.get("priceToEarningsRatioTTM")),
            "pe_ntm": forward_pe,
            "ps_ttm": _round(ratios.get("priceToSalesRatioTTM")),
            "pb_ratio": _round(ratios.get("priceToBookRatioTTM")),
            "price_to_tangible_book": _round(ratios.get("priceToFairValueTTM")),
            "ev_to_ebitda": _round(metrics.get("evToEBITDATTM")),
            "ev_to_sales": _round(metrics.get("evToSalesTTM")),
            "ev_to_fcf": _round(metrics.get("evToFreeCashFlowTTM")),
            "ev_to_ocf": _round(metrics.get("evToOperatingCashFlowTTM")),
            "price_to_fcf": _round(ratios.get("priceToFreeCashFlowRatioTTM")),
            "price_to_ocf": _round(ratios.get("priceToOperatingCashFlowRatioTTM")),
            "peg_ratio": _round(ratios.get("priceToEarningsGrowthRatioTTM")),
            "forward_peg": _round(ratios.get("forwardPriceToEarningsGrowthRatioTTM")),
            "enterprise_value": metrics.get("enterpriseValueTTM"),
            "ev_multiple": _round(ratios.get("enterpriseValueMultipleTTM")),
            "earnings_yield": _pct(metrics.get("earningsYieldTTM")),
            "fcf_yield": _pct(metrics.get("freeCashFlowYieldTTM")),
            "graham_number": _round(metrics.get("grahamNumberTTM")),
        },
        # === PER SHARE METRICS ===
        "per_share": {
            "eps_ttm": _round(ratios.get("netIncomePerShareTTM")),
            "eps_ntm": _round(estimates.get("epsAvg")),
            "revenue_per_share": _round(ratios.get("revenuePerShareTTM")),
            "book_value_per_share": _round(ratios.get("bookValuePerShareTTM")),
            "tangible_book_per_share": _round(ratios.get("tangibleBookValuePerShareTTM")),
            "fcf_per_share": _round(ratios.get("freeCashFlowPerShareTTM")),
            "ocf_per_share": _round(ratios.get("operatingCashFlowPerShareTTM")),
            "cash_per_share": _round(ratios.get("cashPerShareTTM")),
            "dividend_per_share": _round(ratios.get("dividendPerShareTTM")),
            "capex_per_share": _round(ratios.get("capexPerShareTTM")),
            "shareholders_equity_per_share": _round(ratios.get("shareholdersEquityPerShareTTM")),
        },
        # === PROFITABILITY ===
        "profitability": {
            "gross_margin": _pct(ratios.get("grossProfitMarginTTM")),
            "ebitda_margin": _pct(ratios.get("ebitdaMarginTTM")),
            "ebit_margin": _pct(ratios.get("ebitMarginTTM")),
            "operating_margin": _pct(ratios.get("operatingProfitMarginTTM")),
            "pretax_margin": _pct(ratios.get("pretaxProfitMarginTTM")),
            "net_margin": _pct(ratios.get("netProfitMarginTTM")),
            "bottom_line_margin": _pct(ratios.get("bottomLineProfitMarginTTM")),
            "roe": _pct(metrics.get("returnOnEquityTTM")),
            "roa": _pct(metrics.get("returnOnAssetsTTM")),
            "roic": _pct(metrics.get("returnOnInvestedCapitalTTM")),
            "roce": _pct(metrics.get("returnOnCapitalEmployedTTM")),
            "rota": _pct(metrics.get("returnOnTangibleAssetsTTM")),
            "operating_roa": _pct(metrics.get("operatingReturnOnAssetsTTM")),
        },
        # === GROWTH ===
        "growth": {
            # YoY Growth
            "revenue_growth_yoy": _pct(growth.get("revenueGrowth")),
            "gross_profit_growth_yoy": _pct(growth.get("grossProfitGrowth")),
            "operating_income_growth_yoy": _pct(growth.get("operatingIncomeGrowth")),
            "ebitda_growth_yoy": _pct(growth.get("ebitdaGrowth")),
            "ebit_growth_yoy": _pct(growth.get("ebitgrowth")),
            "net_income_growth_yoy": _pct(growth.get("netIncomeGrowth")),
            "eps_growth_yoy": _pct(growth.get("epsgrowth")),
            "eps_diluted_growth_yoy": _pct(growth.get("epsdilutedGrowth")),
            "fcf_growth_yoy": _pct(growth.get("freeCashFlowGrowth")),
            "ocf_growth_yoy": _pct(growth.get("operatingCashFlowGrowth")),
            "dividend_growth_yoy": _pct(growth.get("dividendsPerShareGrowth")),
            "asset_growth_yoy": _pct(growth.get("assetGrowth")),
            "debt_growth_yoy": _pct(growth.get("debtGrowth")),
            "rd_growth_yoy": _pct(growth.get("rdexpenseGrowth")),
            "sga_growth_yoy": _pct(growth.get("sgaexpensesGrowth")),
            "book_value_growth_yoy": _pct(growth.get("bookValueperShareGrowth")),
            "shares_growth_yoy": _pct(growth.get("weightedAverageSharesGrowth")),
            # 3-Year CAGR
            "revenue_cagr_3y": _pct(growth.get("threeYRevenueGrowthPerShare")),
            "net_income_cagr_3y": _pct(growth.get("threeYNetIncomeGrowthPerShare")),
            "ocf_cagr_3y": _pct(growth.get("threeYOperatingCFGrowthPerShare")),
            "dividend_cagr_3y": _pct(growth.get("threeYDividendperShareGrowthPerShare")),
            "equity_cagr_3y": _pct(growth.get("threeYShareholdersEquityGrowthPerShare")),
            # 5-Year CAGR
            "revenue_cagr_5y": _pct(growth.get("fiveYRevenueGrowthPerShare")),
            "net_income_cagr_5y": _pct(growth.get("fiveYNetIncomeGrowthPerShare")),
            "ocf_cagr_5y": _pct(growth.get("fiveYOperatingCFGrowthPerShare")),
            "dividend_cagr_5y": _pct(growth.get("fiveYDividendperShareGrowthPerShare")),
            "equity_cagr_5y": _pct(growth.get("fiveYShareholdersEquityGrowthPerShare")),
            # 10-Year CAGR
            "revenue_cagr_10y": _pct(growth.get("tenYRevenueGrowthPerShare")),
            "net_income_cagr_10y": _pct(growth.get("tenYNetIncomeGrowthPerShare")),
            "ocf_cagr_10y": _pct(growth.get("tenYOperatingCFGrowthPerShare")),
            "dividend_cagr_10y": _pct(growth.get("tenYDividendperShareGrowthPerShare")),
            "equity_cagr_10y": _pct(growth.get("tenYShareholdersEquityGrowthPerShare")),
        },
        # === LIQUIDITY & SOLVENCY ===
        "liquidity": {
            "current_ratio": _round(ratios.get("currentRatioTTM")),
            "quick_ratio": _round(ratios.get("quickRatioTTM")),
            "cash_ratio": _round(ratios.get("cashRatioTTM")),
            "working_capital": metrics.get("workingCapitalTTM"),
            "solvency_ratio": _round(ratios.get("solvencyRatioTTM")),
        },
        # === LEVERAGE & DEBT ===
        "leverage": {
            "debt_to_equity": _round(ratios.get("debtToEquityRatioTTM")),
            "debt_to_assets": _round(ratios.get("debtToAssetsRatioTTM")),
            "debt_to_capital": _round(ratios.get("debtToCapitalRatioTTM")),
            "debt_to_market_cap": _round(ratios.get("debtToMarketCapTTM")),
            "long_term_debt_to_capital": _round(ratios.get("longTermDebtToCapitalRatioTTM")),
            "financial_leverage": _round(ratios.get("financialLeverageRatioTTM")),
            "interest_coverage": _round(ratios.get("interestCoverageRatioTTM")),
            "debt_service_coverage": _round(ratios.get("debtServiceCoverageRatioTTM")),
            "net_debt_to_ebitda": _round(metrics.get("netDebtToEBITDATTM")),
            "interest_debt_per_share": _round(ratios.get("interestDebtPerShareTTM")),
        },
        # === EFFICIENCY & TURNOVER ===
        "efficiency": {
            "asset_turnover": _round(ratios.get("assetTurnoverTTM")),
            "fixed_asset_turnover": _round(ratios.get("fixedAssetTurnoverTTM")),
            "inventory_turnover": _round(ratios.get("inventoryTurnoverTTM")),
            "receivables_turnover": _round(ratios.get("receivablesTurnoverTTM")),
            "payables_turnover": _round(ratios.get("payablesTurnoverTTM")),
            "working_capital_turnover": _round(ratios.get("workingCapitalTurnoverRatioTTM")),
            "days_inventory": _round(metrics.get("daysOfInventoryOutstandingTTM")),
            "days_receivables": _round(metrics.get("daysOfSalesOutstandingTTM")),
            "days_payables": _round(metrics.get("daysOfPayablesOutstandingTTM")),
            "cash_conversion_cycle": _round(metrics.get("cashConversionCycleTTM")),
            "operating_cycle": _round(metrics.get("operatingCycleTTM")),
        },
        # === CASH FLOW ===
        "cash_flow": {
            "ocf_margin": _pct(ratios.get("operatingCashFlowSalesRatioTTM")),
            "fcf_to_ocf": _pct(ratios.get("freeCashFlowOperatingCashFlowRatioTTM")),
            "capex_to_ocf": _pct(metrics.get("capexToOperatingCashFlowTTM")),
            "capex_to_revenue": _pct(metrics.get("capexToRevenueTTM")),
            "capex_to_depreciation": _round(metrics.get("capexToDepreciationTTM")),
            "capex_coverage": _round(ratios.get("capitalExpenditureCoverageRatioTTM")),
            "dividend_capex_coverage": _round(ratios.get("dividendPaidAndCapexCoverageRatioTTM")),
            "ocf_coverage": _round(ratios.get("operatingCashFlowCoverageRatioTTM")),
            "income_quality": _round(metrics.get("incomeQualityTTM")),
            "fcf_to_equity": metrics.get("freeCashFlowToEquityTTM"),
            "fcf_to_firm": metrics.get("freeCashFlowToFirmTTM"),
        },
        # === DIVIDEND ===
        "dividend": {
            "dividend_yield": _pct(ratios.get("dividendYieldTTM")),
            "payout_ratio": _pct(ratios.get("dividendPayoutRatioTTM")),
            "dividend_per_share": _round(ratios.get("dividendPerShareTTM")),
        },
        # === OTHER ===
        "other": {
            "effective_tax_rate": _pct(ratios.get("effectiveTaxRateTTM")),
            "tax_burden": _round(metrics.get("taxBurdenTTM")),
            "interest_burden": _round(metrics.get("interestBurdenTTM")),
            "rd_to_revenue": _pct(metrics.get("researchAndDevelopementToRevenueTTM")),
            "sga_to_revenue": _pct(metrics.get("salesGeneralAndAdministrativeToRevenueTTM")),
            "stock_comp_to_revenue": _pct(metrics.get("stockBasedCompensationToRevenueTTM")),
            "intangibles_to_assets": _pct(metrics.get("intangiblesToTotalAssetsTTM")),
            "invested_capital": metrics.get("investedCapitalTTM"),
            "tangible_asset_value": metrics.get("tangibleAssetValueTTM"),
            "net_current_asset_value": metrics.get("netCurrentAssetValueTTM"),
        },
        # === ANALYST ESTIMATES ===
        "analyst": {
            "eps_estimate": _round(estimates.get("epsAvg")),
            "eps_estimate_high": _round(estimates.get("epsHigh")),
            "eps_estimate_low": _round(estimates.get("epsLow")),
            "revenue_estimate": estimates.get("revenueAvg"),
            "num_analysts_eps": estimates.get("numAnalystsEps"),
            "num_analysts_revenue": estimates.get("numAnalystsRevenue"),
        },
    }

    cache_set(cache_key, result, CACHE_TTL_FUNDAMENTALS)
    return result


async def fetch_fmp_all(ticker: str) -> dict[str, Any]:
    """Fetch all FMP data for a ticker in parallel."""
    quote, profile, fundamentals = await asyncio.gather(
        fetch_fmp_quote(ticker),
        fetch_fmp_profile(ticker),
        fetch_fmp_fundamentals(ticker),
        return_exceptions=True,
    )

    if isinstance(quote, Exception):
        logger.warning(f"FMP quote failed for {ticker}: {quote}")
        quote = {}
    if isinstance(profile, Exception):
        logger.warning(f"FMP profile failed for {ticker}: {profile}")
        profile = {}
    if isinstance(fundamentals, Exception):
        logger.warning(f"FMP fundamentals failed for {ticker}: {fundamentals}")
        fundamentals = {}

    return {
        "quote": quote,
        "profile": profile,
        "fundamentals": fundamentals,
    }


def _round(val: float | None) -> float | None:
    """Round a value to 2 decimal places."""
    if val is None:
        return None
    try:
        return round(float(val), 2)
    except (ValueError, TypeError):
        return None


def _pct(val: float | None) -> float | None:
    """Convert decimal to percentage if needed."""
    if val is None:
        return None
    try:
        v = float(val)
        # FMP sometimes returns decimals (0.47) and sometimes percentages (47.0)
        # If abs value > 1, assume it's already a percentage
        if abs(v) <= 1:
            return round(v * 100, 2)
        return round(v, 2)
    except (ValueError, TypeError):
        return None

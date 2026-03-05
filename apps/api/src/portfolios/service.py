import asyncio
import csv
import io
import logging
from typing import Any

from sqlalchemy.orm import Session

from src.core.data_providers.fmp_fetcher import (
    fetch_fmp_all,
    fetch_fmp_fundamentals,
    fetch_fmp_profile,
    fetch_fmp_quote,
)
from src.portfolios.columns import (
    COLUMN_REGISTRY,
    DataSource,
    get_required_sources,
)
from src.portfolios.models import Holding, Portfolio
from src.portfolios.schemas import (
    CsvImportResult,
    HoldingCreate,
    HoldingDetail,
    HoldingUpdate,
    PortfolioCreate,
    PortfolioDetailResponse,
    PortfolioMetrics,
    PortfolioSummary,
    PortfolioUpdate,
)
from src.scoring.engine import calculate_composite_score

logger = logging.getLogger(__name__)


# --- Portfolio CRUD ---

def list_portfolios(db: Session, user_id: int | None = None) -> list[PortfolioSummary]:
    query = db.query(Portfolio)
    if user_id is not None:
        query = query.filter(Portfolio.user_id == user_id)
    portfolios = query.all()
    return [
        PortfolioSummary(
            id=p.id,
            name=p.name,
            description=p.description,
            holdings_count=len(p.holdings),
        )
        for p in portfolios
    ]


def create_portfolio(data: PortfolioCreate, db: Session, user_id: int | None = None) -> PortfolioSummary:
    portfolio = Portfolio(name=data.name, description=data.description, user_id=user_id)
    db.add(portfolio)
    db.commit()
    db.refresh(portfolio)
    return PortfolioSummary(id=portfolio.id, name=portfolio.name, description=portfolio.description)


def get_portfolio(portfolio_id: int, db: Session) -> Portfolio | None:
    return db.get(Portfolio, portfolio_id)


def update_portfolio(portfolio_id: int, data: PortfolioUpdate, db: Session) -> Portfolio | None:
    portfolio = db.get(Portfolio, portfolio_id)
    if not portfolio:
        return None
    if data.name is not None:
        portfolio.name = data.name
    if data.description is not None:
        portfolio.description = data.description
    db.commit()
    db.refresh(portfolio)
    return portfolio


def delete_portfolio(portfolio_id: int, db: Session) -> bool:
    portfolio = db.get(Portfolio, portfolio_id)
    if not portfolio:
        return False
    db.delete(portfolio)
    db.commit()
    return True


# --- Holdings CRUD ---

def add_holding(portfolio_id: int, data: HoldingCreate, db: Session) -> Holding | None:
    portfolio = db.get(Portfolio, portfolio_id)
    if not portfolio:
        return None
    holding = Holding(
        portfolio_id=portfolio_id,
        ticker=data.ticker.upper(),
        shares=data.shares,
        cost_basis=data.cost_basis,
        purchase_date=data.purchase_date,
        notes=data.notes,
    )
    db.add(holding)
    db.commit()
    db.refresh(holding)
    return holding


def update_holding(holding_id: int, data: HoldingUpdate, db: Session) -> Holding | None:
    holding = db.get(Holding, holding_id)
    if not holding:
        return None
    if data.shares is not None:
        holding.shares = data.shares
    if data.cost_basis is not None:
        holding.cost_basis = data.cost_basis
    if data.purchase_date is not None:
        holding.purchase_date = data.purchase_date
    if data.notes is not None:
        holding.notes = data.notes
    db.commit()
    db.refresh(holding)
    return holding


def delete_holding(holding_id: int, db: Session) -> bool:
    holding = db.get(Holding, holding_id)
    if not holding:
        return False
    db.delete(holding)
    db.commit()
    return True


# --- CSV Import/Export ---

def _get_csv_value(row: dict, *keys: str) -> str:
    """Get value from row trying multiple possible column names (case-insensitive)."""
    row_lower = {k.lower(): v for k, v in row.items()}
    for key in keys:
        val = row_lower.get(key.lower(), "")
        if val:
            return val.strip()
    return ""


def _parse_number(value: str) -> float:
    """Parse a number that may have $, commas, or other formatting."""
    if not value:
        return 0.0
    # Remove $, commas, spaces
    cleaned = value.replace("$", "").replace(",", "").strip()
    return float(cleaned) if cleaned else 0.0


def import_csv(portfolio_id: int, csv_content: str, db: Session) -> CsvImportResult:
    portfolio = db.get(Portfolio, portfolio_id)
    if not portfolio:
        return CsvImportResult(imported=0, errors=["Portfolio not found"])

    # Detect delimiter (tab or comma)
    first_line = csv_content.split('\n')[0] if csv_content else ''
    delimiter = '\t' if '\t' in first_line else ','

    reader = csv.DictReader(io.StringIO(csv_content), delimiter=delimiter)
    imported = 0
    errors = []

    for i, row in enumerate(reader, start=2):
        try:
            # Flexible column names for ticker
            ticker = _get_csv_value(row, "ticker", "symbol").upper()
            if not ticker:
                errors.append(f"Row {i}: missing ticker/symbol")
                continue

            # Flexible column names for shares
            shares_str = _get_csv_value(row, "shares", "quantity", "qty", "qty (quantity)")
            shares = _parse_number(shares_str)

            cost_basis_str = _get_csv_value(row, "cost_basis", "cost basis", "cost", "total_cost")
            cost_basis = _parse_number(cost_basis_str)

            purchase_date = _get_csv_value(row, "purchase_date", "date") or None
            notes = _get_csv_value(row, "notes", "note") or None

            holding = Holding(
                portfolio_id=portfolio_id,
                ticker=ticker,
                shares=shares,
                cost_basis=cost_basis,
                purchase_date=purchase_date,
                notes=notes,
            )
            db.add(holding)
            imported += 1
        except (ValueError, KeyError) as e:
            errors.append(f"Row {i}: {e}")

    db.commit()
    return CsvImportResult(imported=imported, errors=errors)


def export_csv(portfolio_id: int, db: Session) -> str | None:
    portfolio = db.get(Portfolio, portfolio_id)
    if not portfolio:
        return None

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ticker", "shares", "cost_basis", "purchase_date", "notes"])
    for h in portfolio.holdings:
        writer.writerow([h.ticker, h.shares, h.cost_basis, h.purchase_date or "", h.notes or ""])
    return output.getvalue()


# --- Enrichment (async) - FMP Primary Source ---

async def _fetch_ticker_data(
    ticker: str, sources: set[DataSource]
) -> dict[str, Any]:
    """Fetch data for a ticker from FMP based on required sources."""
    tasks = {}

    if DataSource.QUOTE in sources:
        tasks["quote"] = fetch_fmp_quote(ticker)

    if DataSource.PROFILE in sources:
        tasks["profile"] = fetch_fmp_profile(ticker)

    if DataSource.FUNDAMENTALS in sources:
        tasks["fundamentals"] = fetch_fmp_fundamentals(ticker)

    if not tasks:
        return {}

    # Fetch all needed data in parallel
    results = await asyncio.gather(*tasks.values(), return_exceptions=True)

    data = {}
    for key, result in zip(tasks.keys(), results):
        if isinstance(result, Exception):
            logger.warning(f"Failed to fetch {key} for {ticker}: {result}")
            data[key] = {}
        else:
            data[key] = result or {}

    return data


def _get_nested_value(data: dict, path: str) -> Any:
    """Get a nested value from a dict using dot notation."""
    parts = path.split(".")
    val = data
    for part in parts:
        if isinstance(val, dict):
            val = val.get(part)
        else:
            return None
    return val


def _build_holding_row(
    holding: Holding,
    data: dict[str, Any],
    columns: list[str],
) -> dict[str, Any]:
    """Build a single holding's data row for the requested columns."""
    quote = data.get("quote", {})
    profile = data.get("profile", {})
    fundamentals = data.get("fundamentals", {})

    # Pre-compute common values
    price = quote.get("price")
    current_value = price * holding.shares if price else None
    gain_loss = current_value - holding.cost_basis if current_value else None
    gain_loss_pct = (
        (gain_loss / holding.cost_basis * 100)
        if gain_loss is not None and holding.cost_basis > 0
        else None
    )
    cost_per_share = (
        round(holding.cost_basis / holding.shares, 2)
        if holding.shares > 0
        else None
    )

    # Calculate score if needed
    score = None
    if "score" in columns and fundamentals:
        try:
            # Build info dict for scoring engine
            info = {**quote, **profile}
            score_result = calculate_composite_score(fundamentals, info)
            score = score_result.get("overall_score")
        except Exception as e:
            logger.warning(f"Score calculation failed for {holding.ticker}: {e}")

    # Build the row with all requested columns
    row: dict[str, Any] = {
        "id": holding.id,
        "ticker": holding.ticker,
    }

    for col_id in columns:
        col_def = COLUMN_REGISTRY.get(col_id)
        if not col_def:
            continue

        val = None
        source = col_def.source
        field = col_def.field

        if source == DataSource.HOLDING:
            val = getattr(holding, field, None)
        elif source == DataSource.QUOTE:
            val = quote.get(field)
        elif source == DataSource.PROFILE:
            val = profile.get(field)
        elif source == DataSource.FUNDAMENTALS:
            val = _get_nested_value(fundamentals, field)
        elif source == DataSource.COMPUTED:
            # Handle computed fields
            if col_id == "cost_per_share":
                val = cost_per_share
            elif col_id == "value":
                val = round(current_value, 2) if current_value else None
            elif col_id == "gain_loss":
                val = round(gain_loss, 2) if gain_loss is not None else None
            elif col_id == "gain_loss_pct":
                val = round(gain_loss_pct, 2) if gain_loss_pct is not None else None
            elif col_id == "score":
                val = score

        # Round numeric values
        if isinstance(val, float) and col_id not in ("shares",):
            val = round(val, 2)

        row[col_id] = val

    # Always include these core fields for the frontend
    row["shares"] = holding.shares
    row["cost_basis"] = holding.cost_basis
    if price:
        row["price"] = round(price, 2)
        row["current_value"] = round(current_value, 2) if current_value else None

    return row


async def enrich_holdings_dynamic(
    holdings: list[Holding],
    columns: list[str],
) -> list[dict[str, Any]]:
    """Fetch and enrich holdings based on requested columns using FMP data."""
    if not holdings:
        return []

    # Determine which data sources we need
    sources = get_required_sources(columns)
    logger.info(f"Enriching {len(holdings)} holdings with FMP sources: {sources}")

    # Fetch data for all tickers in parallel
    tickers = [h.ticker for h in holdings]
    tasks = [_fetch_ticker_data(ticker, sources) for ticker in tickers]
    all_data = await asyncio.gather(*tasks)

    # Build rows
    results = []
    for holding, data in zip(holdings, all_data):
        row = _build_holding_row(holding, data, columns)
        results.append(row)

    return results


async def _fetch_holding_data(ticker: str) -> tuple[dict | None, dict | None]:
    """Fetch quote and fundamentals from FMP for a single ticker (legacy support)."""
    try:
        fmp_data = await fetch_fmp_all(ticker)
        # Merge quote and profile into "info" for backwards compatibility
        info = {**fmp_data.get("quote", {}), **fmp_data.get("profile", {})}
        fundamentals = fmp_data.get("fundamentals", {})
        return info, fundamentals
    except Exception as e:
        logger.warning(f"FMP fetch failed for {ticker}: {e}")
        return None, None


async def enrich_holdings(holdings: list[Holding]) -> list[HoldingDetail]:
    """Fetch current prices and enrich holdings with FMP data (parallel)."""
    if not holdings:
        return []

    # Fetch all FMP data in parallel
    tickers = [h.ticker for h in holdings]
    fetch_tasks = [_fetch_holding_data(ticker) for ticker in tickers]
    all_data = await asyncio.gather(*fetch_tasks)

    results = []
    for h, (info, fundamentals) in zip(holdings, all_data):
        price = info.get("price") if info else None
        current_value = price * h.shares if price else None
        gain_loss = current_value - h.cost_basis if current_value else None
        gain_loss_pct = (gain_loss / h.cost_basis * 100) if gain_loss is not None and h.cost_basis > 0 else None

        # Get score
        score = None
        if fundamentals and info:
            try:
                score_result = calculate_composite_score(fundamentals, info)
                score = score_result.get("overall_score")
            except Exception:
                pass

        # Extract fundamentals from FMP structure
        pe_ratio = None
        dividend_yield = None
        eps = None
        if fundamentals:
            valuation = fundamentals.get("valuation", {})
            pe_ratio = valuation.get("pe_ntm") or valuation.get("pe_ttm")
            eps = valuation.get("eps_ttm")
            dividend = fundamentals.get("dividend", {})
            dividend_yield = dividend.get("dividend_yield")

        results.append(HoldingDetail(
            id=h.id,
            ticker=h.ticker,
            shares=h.shares,
            cost_basis=h.cost_basis,
            cost_per_share=round(h.cost_basis / h.shares, 2) if h.shares > 0 else None,
            purchase_date=h.purchase_date,
            notes=h.notes,
            current_price=round(price, 2) if price else None,
            current_value=round(current_value, 2) if current_value else None,
            day_change=info.get("change") if info else None,
            day_change_pct=info.get("change_percent") if info else None,
            gain_loss=round(gain_loss, 2) if gain_loss is not None else None,
            gain_loss_pct=round(gain_loss_pct, 2) if gain_loss_pct is not None else None,
            sector=info.get("sector") if info else None,
            market_cap=info.get("market_cap") if info else None,
            pe_ratio=round(pe_ratio, 2) if pe_ratio else None,
            revenue_ttm=None,
            eps=round(eps, 2) if eps else None,
            dividend_yield=round(dividend_yield, 2) if dividend_yield else None,
            score=score,
        ))
    return results


async def calculate_portfolio_metrics(
    enriched_holdings: list[HoldingDetail],
) -> PortfolioMetrics:
    """Calculate aggregate portfolio metrics from enriched holdings."""
    total_value = sum(h.current_value or 0 for h in enriched_holdings)
    total_cost = sum(h.cost_basis for h in enriched_holdings)
    total_gl = total_value - total_cost
    total_gl_pct = (total_gl / total_cost * 100) if total_cost > 0 else 0

    # Sector allocation
    sectors: dict[str, float] = {}
    for h in enriched_holdings:
        sector = h.sector or "Unknown"
        sectors[sector] = sectors.get(sector, 0) + (h.current_value or 0)
    sector_allocation = {
        s: round(v / total_value * 100, 1) if total_value > 0 else 0
        for s, v in sorted(sectors.items(), key=lambda x: -x[1])
    }

    # Top holdings by value
    sorted_holdings = sorted(enriched_holdings, key=lambda h: -(h.current_value or 0))
    top_holdings = [
        {
            "ticker": h.ticker,
            "value": h.current_value,
            "pct": round((h.current_value or 0) / total_value * 100, 1) if total_value > 0 else 0,
        }
        for h in sorted_holdings[:5]
    ]

    # Weighted score
    weighted_score = None
    scored = [(h.current_value or 0, h.score) for h in enriched_holdings if h.score is not None]
    if scored and total_value > 0:
        weighted_score = round(
            sum(val * score for val, score in scored) / sum(val for val, _ in scored), 1
        )

    return PortfolioMetrics(
        total_value=round(total_value, 2),
        total_cost_basis=round(total_cost, 2),
        total_gain_loss=round(total_gl, 2),
        total_gain_loss_pct=round(total_gl_pct, 2),
        holdings_count=len(enriched_holdings),
        sector_allocation=sector_allocation,
        top_holdings=top_holdings,
        weighted_score=weighted_score,
    )

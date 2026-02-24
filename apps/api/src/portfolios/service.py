import csv
import io
import logging
from typing import Any

from sqlalchemy.orm import Session

from src.core.data_providers.fetcher import fetch_stock_info, fetch_fundamentals
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

def list_portfolios(db: Session) -> list[PortfolioSummary]:
    portfolios = db.query(Portfolio).all()
    return [
        PortfolioSummary(
            id=p.id,
            name=p.name,
            description=p.description,
            holdings_count=len(p.holdings),
        )
        for p in portfolios
    ]


def create_portfolio(data: PortfolioCreate, db: Session) -> PortfolioSummary:
    portfolio = Portfolio(name=data.name, description=data.description)
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

def import_csv(portfolio_id: int, csv_content: str, db: Session) -> CsvImportResult:
    portfolio = db.get(Portfolio, portfolio_id)
    if not portfolio:
        return CsvImportResult(imported=0, errors=["Portfolio not found"])

    reader = csv.DictReader(io.StringIO(csv_content))
    imported = 0
    errors = []

    for i, row in enumerate(reader, start=2):
        try:
            ticker = row.get("ticker", "").strip().upper()
            if not ticker:
                errors.append(f"Row {i}: missing ticker")
                continue

            shares = float(row.get("shares", 0))
            cost_basis = float(row.get("cost_basis", 0))
            purchase_date = row.get("purchase_date", "").strip() or None
            notes = row.get("notes", "").strip() or None

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


# --- Enrichment (async) ---

async def enrich_holdings(holdings: list[Holding]) -> list[HoldingDetail]:
    """Fetch current prices and enrich holdings with live data."""
    results = []
    for h in holdings:
        info = await fetch_stock_info(h.ticker)
        price = info.get("price") if info else None
        current_value = price * h.shares if price else None
        gain_loss = current_value - h.cost_basis if current_value else None
        gain_loss_pct = (gain_loss / h.cost_basis * 100) if gain_loss is not None and h.cost_basis > 0 else None

        # Get score
        score = None
        try:
            fundamentals = await fetch_fundamentals(h.ticker)
            score_result = calculate_composite_score(fundamentals, info)
            score = score_result.get("overall_score")
        except Exception:
            pass

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
            gain_loss=round(gain_loss, 2) if gain_loss is not None else None,
            gain_loss_pct=round(gain_loss_pct, 2) if gain_loss_pct is not None else None,
            sector=info.get("sector") if info else None,
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

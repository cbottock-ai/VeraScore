from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from src.auth import User, get_optional_user
from src.core.data_providers.cache import cache_clear_ticker
from src.core.database import get_db
from src.portfolios.columns import list_all_columns
from src.portfolios.schemas import (
    CsvImportResult,
    HoldingCreate,
    HoldingDetail,
    HoldingsResponse,
    HoldingUpdate,
    PortfolioCreate,
    PortfolioDetailResponse,
    PortfolioDynamicResponse,
    PortfolioListResponse,
    PortfolioSummary,
    PortfolioUpdate,
)
from src.portfolios.service import (
    add_holding,
    calculate_portfolio_metrics,
    create_portfolio,
    delete_holding,
    delete_portfolio,
    enrich_holdings,
    enrich_holdings_dynamic,
    export_csv,
    get_portfolio,
    import_csv,
    list_portfolios,
    save_column_config,
    update_holding,
    update_portfolio,
)

router = APIRouter(prefix="/portfolios", tags=["portfolios"])


# --- Column Registry ---

@router.get("/columns")
async def get_columns():
    """Get all available columns with their metadata."""
    return {"columns": list_all_columns()}


# --- Portfolio CRUD ---

@router.get("", response_model=PortfolioListResponse)
async def list_all(
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    user_id = user.id if user else None
    return PortfolioListResponse(portfolios=list_portfolios(db, user_id=user_id))


@router.post("", response_model=PortfolioSummary, status_code=201)
async def create(
    data: PortfolioCreate,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    user_id = user.id if user else None
    return create_portfolio(data, db, user_id=user_id)


@router.get("/{portfolio_id}")
async def detail(
    portfolio_id: int,
    columns: Optional[str] = Query(None, description="Comma-separated column IDs"),
    db: Session = Depends(get_db),
):
    """
    Get portfolio details with holdings data.

    If `columns` is provided, uses dynamic enrichment to fetch only the data
    needed for those columns. Otherwise, returns the legacy HoldingDetail format.
    """
    portfolio = get_portfolio(portfolio_id, db)
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    if columns:
        # Dynamic column-based enrichment
        column_list = [c.strip() for c in columns.split(",") if c.strip()]
        holdings_data = await enrich_holdings_dynamic(portfolio.holdings, column_list)

        # Calculate basic metrics from the holdings data
        total_value = sum(h.get("current_value") or 0 for h in holdings_data)
        total_cost = sum(h.get("cost_basis") or 0 for h in holdings_data)
        total_gl = total_value - total_cost
        total_gl_pct = (total_gl / total_cost * 100) if total_cost > 0 else 0

        # Weighted score
        weighted_score = None
        scored = [(h.get("current_value") or 0, h.get("score")) for h in holdings_data if h.get("score") is not None]
        if scored and total_value > 0:
            weighted_score = round(
                sum(val * score for val, score in scored) / sum(val for val, _ in scored), 1
            )

        return PortfolioDynamicResponse(
            id=portfolio.id,
            name=portfolio.name,
            description=portfolio.description,
            metrics={
                "total_value": round(total_value, 2),
                "total_cost_basis": round(total_cost, 2),
                "total_gain_loss": round(total_gl, 2),
                "total_gain_loss_pct": round(total_gl_pct, 2),
                "holdings_count": len(holdings_data),
                "weighted_score": weighted_score,
            },
            holdings=holdings_data,
            columns=column_list,
        )

    # Legacy format (no columns specified)
    enriched = await enrich_holdings(portfolio.holdings)
    metrics = await calculate_portfolio_metrics(enriched)

    return PortfolioDetailResponse(
        id=portfolio.id,
        name=portfolio.name,
        description=portfolio.description,
        metrics=metrics,
        holdings=enriched,
    )


@router.post("/{portfolio_id}/refresh")
async def refresh(
    portfolio_id: int,
    columns: Optional[str] = Query(None, description="Comma-separated column IDs"),
    db: Session = Depends(get_db),
):
    """Clear cache and fetch fresh data for all holdings."""
    portfolio = get_portfolio(portfolio_id, db)
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    # Clear cache for each ticker
    for holding in portfolio.holdings:
        cache_clear_ticker(holding.ticker)

    if columns:
        # Dynamic column-based refresh
        column_list = [c.strip() for c in columns.split(",") if c.strip()]
        holdings_data = await enrich_holdings_dynamic(portfolio.holdings, column_list)

        total_value = sum(h.get("current_value") or 0 for h in holdings_data)
        total_cost = sum(h.get("cost_basis") or 0 for h in holdings_data)
        total_gl = total_value - total_cost
        total_gl_pct = (total_gl / total_cost * 100) if total_cost > 0 else 0

        weighted_score = None
        scored = [(h.get("current_value") or 0, h.get("score")) for h in holdings_data if h.get("score") is not None]
        if scored and total_value > 0:
            weighted_score = round(
                sum(val * score for val, score in scored) / sum(val for val, _ in scored), 1
            )

        return PortfolioDynamicResponse(
            id=portfolio.id,
            name=portfolio.name,
            description=portfolio.description,
            metrics={
                "total_value": round(total_value, 2),
                "total_cost_basis": round(total_cost, 2),
                "total_gain_loss": round(total_gl, 2),
                "total_gain_loss_pct": round(total_gl_pct, 2),
                "holdings_count": len(holdings_data),
                "weighted_score": weighted_score,
            },
            holdings=holdings_data,
            columns=column_list,
        )

    # Legacy format
    enriched = await enrich_holdings(portfolio.holdings)
    metrics = await calculate_portfolio_metrics(enriched)

    return PortfolioDetailResponse(
        id=portfolio.id,
        name=portfolio.name,
        description=portfolio.description,
        metrics=metrics,
        holdings=enriched,
    )


@router.put("/{portfolio_id}", response_model=PortfolioSummary)
async def update(portfolio_id: int, data: PortfolioUpdate, db: Session = Depends(get_db)):
    portfolio = update_portfolio(portfolio_id, data, db)
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return PortfolioSummary(
        id=portfolio.id,
        name=portfolio.name,
        description=portfolio.description,
        holdings_count=len(portfolio.holdings),
    )


@router.patch("/{portfolio_id}/columns", status_code=204)
async def save_columns(portfolio_id: int, data: dict, db: Session = Depends(get_db)):
    """Persist the user's column selection for this portfolio."""
    columns = data.get("columns", [])
    if not isinstance(columns, list):
        raise HTTPException(status_code=422, detail="columns must be a list")
    if not save_column_config(portfolio_id, columns, db):
        raise HTTPException(status_code=404, detail="Portfolio not found")


@router.delete("/{portfolio_id}", status_code=204)
async def delete(portfolio_id: int, db: Session = Depends(get_db)):
    if not delete_portfolio(portfolio_id, db):
        raise HTTPException(status_code=404, detail="Portfolio not found")


# --- Holdings ---

@router.get("/{portfolio_id}/holdings", response_model=HoldingsResponse)
async def get_holdings(portfolio_id: int, db: Session = Depends(get_db)):
    portfolio = get_portfolio(portfolio_id, db)
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    enriched = await enrich_holdings(portfolio.holdings)
    return HoldingsResponse(holdings=enriched)


@router.post("/{portfolio_id}/holdings", response_model=HoldingDetail, status_code=201)
async def create_holding(
    portfolio_id: int, data: HoldingCreate, db: Session = Depends(get_db)
):
    holding = add_holding(portfolio_id, data, db)
    if not holding:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    enriched = await enrich_holdings([holding])
    return enriched[0]


@router.put("/holdings/{holding_id}", response_model=HoldingDetail)
async def modify_holding(
    holding_id: int, data: HoldingUpdate, db: Session = Depends(get_db)
):
    holding = update_holding(holding_id, data, db)
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")
    enriched = await enrich_holdings([holding])
    return enriched[0]


@router.delete("/holdings/{holding_id}", status_code=204)
async def remove_holding(holding_id: int, db: Session = Depends(get_db)):
    if not delete_holding(holding_id, db):
        raise HTTPException(status_code=404, detail="Holding not found")


# --- CSV Import/Export ---

@router.post("/{portfolio_id}/import", response_model=CsvImportResult)
async def csv_import(portfolio_id: int, file: UploadFile, db: Session = Depends(get_db)):
    content = (await file.read()).decode("utf-8")
    return import_csv(portfolio_id, content, db)


@router.get("/{portfolio_id}/export")
async def csv_export(portfolio_id: int, db: Session = Depends(get_db)):
    csv_content = export_csv(portfolio_id, db)
    if csv_content is None:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return PlainTextResponse(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=portfolio_{portfolio_id}.csv"},
    )

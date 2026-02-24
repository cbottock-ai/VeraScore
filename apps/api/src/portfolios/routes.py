from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from src.core.database import get_db
from src.portfolios.schemas import (
    CsvImportResult,
    HoldingCreate,
    HoldingDetail,
    HoldingsResponse,
    HoldingUpdate,
    PortfolioCreate,
    PortfolioDetailResponse,
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
    export_csv,
    get_portfolio,
    import_csv,
    list_portfolios,
    update_holding,
    update_portfolio,
)

router = APIRouter(prefix="/portfolios", tags=["portfolios"])


# --- Portfolio CRUD ---

@router.get("", response_model=PortfolioListResponse)
async def list_all(db: Session = Depends(get_db)):
    return PortfolioListResponse(portfolios=list_portfolios(db))


@router.post("", response_model=PortfolioSummary, status_code=201)
async def create(data: PortfolioCreate, db: Session = Depends(get_db)):
    return create_portfolio(data, db)


@router.get("/{portfolio_id}", response_model=PortfolioDetailResponse)
async def detail(portfolio_id: int, db: Session = Depends(get_db)):
    portfolio = get_portfolio(portfolio_id, db)
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")

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

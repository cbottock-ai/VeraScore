from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.chat.routes import router as chat_router
from src.earnings.routes import router as earnings_router
from src.market.routes import router as market_router
from src.screener.routes import router as screener_router
from src.core.config import settings
from src.core.database import Base, engine

# Import models to ensure tables are created
from src.auth import models as auth_models  # noqa: F401
from src.chat.tracing import AITrace  # noqa: F401
from src.earnings import models as earnings_models  # noqa: F401
from src.earnings.ir_sources import CompanyIRSource  # noqa: F401
from src.portfolios.routes import router as portfolios_router
from src.scoring.routes import router as scoring_router
from src.stocks.routes import router as stocks_router


def _run_migrations():
    """Add columns that may be missing from existing tables."""
    with engine.connect() as conn:
        from sqlalchemy import text
        existing = {
            row[1]
            for row in conn.execute(text("PRAGMA table_info(transcripts)")).fetchall()
        }
        if "sentiment_score" not in existing:
            conn.execute(text("ALTER TABLE transcripts ADD COLUMN sentiment_score REAL"))
        if "sentiment_label" not in existing:
            conn.execute(text("ALTER TABLE transcripts ADD COLUMN sentiment_label VARCHAR(20)"))
        conn.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _run_migrations()
    yield


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(stocks_router, prefix="/api")
app.include_router(scoring_router, prefix="/api")
app.include_router(portfolios_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
app.include_router(earnings_router, prefix="/api")
app.include_router(screener_router, prefix="/api")
app.include_router(market_router, prefix="/api")


@app.get("/health")
async def health_check():
    return {"status": "ok", "app": settings.app_name}

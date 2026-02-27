from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.chat.routes import router as chat_router
from src.core.config import settings
from src.core.database import Base, engine

# Import models to ensure tables are created
from src.earnings import models as earnings_models  # noqa: F401
from src.portfolios.routes import router as portfolios_router
from src.scoring.routes import router as scoring_router
from src.stocks.routes import router as stocks_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
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


@app.get("/health")
async def health_check():
    return {"status": "ok", "app": settings.app_name}

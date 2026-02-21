from pydantic import BaseModel


class ScoreComponent(BaseModel):
    metric_id: str
    label: str
    raw_value: float | None = None
    score: float | None = None
    weight: float


class FactorScore(BaseModel):
    factor: str
    label: str
    score: float | None = None
    weight: float
    components: list[ScoreComponent]
    explanation: str


class StockScoresResponse(BaseModel):
    ticker: str
    overall_score: float | None = None
    factors: dict[str, FactorScore]
    profile_used: str


class FactorScoreResponse(BaseModel):
    ticker: str
    factor: FactorScore

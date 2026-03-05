"""
AI Tracing module for VeraScore.

Tracks LLM calls including:
- Token usage (prompt/completion)
- Latency
- Tool calls
- Costs (estimated)
- Errors

Usage:
    with trace_context(conversation_id=123, user_id=456) as trace:
        # Make LLM calls
        trace.log_llm_call(provider="openai", model="gpt-4o", ...)
"""

import logging
import time
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, Session, mapped_column

from src.core.database import Base

logger = logging.getLogger(__name__)

# Pricing per 1M tokens (as of early 2025)
TOKEN_PRICES = {
    # OpenAI
    "gpt-4o": {"input": 2.50, "output": 10.00},
    "gpt-4o-mini": {"input": 0.15, "output": 0.60},
    "gpt-4-turbo": {"input": 10.00, "output": 30.00},
    # Anthropic
    "claude-3-5-sonnet": {"input": 3.00, "output": 15.00},
    "claude-sonnet-4-5-20250929": {"input": 3.00, "output": 15.00},
    "claude-3-opus": {"input": 15.00, "output": 75.00},
    "claude-3-haiku": {"input": 0.25, "output": 1.25},
}


def calculate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    """Calculate estimated cost in USD for a model call."""
    # Find matching model (partial match)
    prices = None
    for model_name, price in TOKEN_PRICES.items():
        if model_name in model.lower() or model.lower() in model_name:
            prices = price
            break

    if not prices:
        # Default to gpt-4o pricing as fallback
        prices = TOKEN_PRICES["gpt-4o"]

    input_cost = (input_tokens / 1_000_000) * prices["input"]
    output_cost = (output_tokens / 1_000_000) * prices["output"]
    return round(input_cost + output_cost, 6)


class AITrace(Base):
    """Database model for storing AI trace data."""

    __tablename__ = "ai_traces"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    conversation_id: Mapped[int | None] = mapped_column(Integer, index=True)
    user_id: Mapped[int | None] = mapped_column(Integer, index=True)

    # LLM info
    provider: Mapped[str] = mapped_column(String(50))
    model: Mapped[str] = mapped_column(String(100))

    # Token usage
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0)

    # Cost (USD)
    estimated_cost: Mapped[float] = mapped_column(Float, default=0.0)

    # Timing
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)

    # Tool calls
    tool_calls_count: Mapped[int] = mapped_column(Integer, default=0)
    tool_names: Mapped[str | None] = mapped_column(Text)  # JSON array of tool names

    # Error tracking
    error: Mapped[str | None] = mapped_column(Text)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


@dataclass
class TraceData:
    """Container for trace data during a request."""

    conversation_id: int | None = None
    user_id: int | None = None
    provider: str = ""
    model: str = ""
    input_tokens: int = 0
    output_tokens: int = 0
    latency_ms: int = 0
    tool_calls: list[str] = field(default_factory=list)
    error: str | None = None
    start_time: float = field(default_factory=time.time)

    def add_tokens(self, input_tokens: int = 0, output_tokens: int = 0) -> None:
        """Add token counts (can be called multiple times for multi-turn)."""
        self.input_tokens += input_tokens
        self.output_tokens += output_tokens

    def add_tool_call(self, tool_name: str) -> None:
        """Record a tool call."""
        self.tool_calls.append(tool_name)

    def set_error(self, error: str) -> None:
        """Record an error."""
        self.error = error

    def finalize(self) -> None:
        """Calculate final metrics."""
        self.latency_ms = int((time.time() - self.start_time) * 1000)

    def save(self, db: Session) -> AITrace:
        """Save trace to database."""
        self.finalize()

        trace = AITrace(
            conversation_id=self.conversation_id,
            user_id=self.user_id,
            provider=self.provider,
            model=self.model,
            input_tokens=self.input_tokens,
            output_tokens=self.output_tokens,
            total_tokens=self.input_tokens + self.output_tokens,
            estimated_cost=calculate_cost(self.model, self.input_tokens, self.output_tokens),
            latency_ms=self.latency_ms,
            tool_calls_count=len(self.tool_calls),
            tool_names=",".join(self.tool_calls) if self.tool_calls else None,
            error=self.error,
        )
        db.add(trace)
        db.commit()
        db.refresh(trace)

        # Log summary
        logger.info(
            f"AI Trace: provider={self.provider} model={self.model} "
            f"tokens={self.input_tokens}+{self.output_tokens} "
            f"cost=${trace.estimated_cost:.4f} latency={self.latency_ms}ms "
            f"tools={len(self.tool_calls)}"
        )

        return trace


# Thread-local storage for current trace
_current_trace: TraceData | None = None


def get_current_trace() -> TraceData | None:
    """Get the current trace context, if any."""
    return _current_trace


@contextmanager
def trace_context(
    conversation_id: int | None = None,
    user_id: int | None = None,
    provider: str = "",
    model: str = "",
):
    """
    Context manager for tracing an AI request.

    Usage:
        with trace_context(conversation_id=123) as trace:
            trace.provider = "openai"
            trace.model = "gpt-4o"
            # ... make LLM calls ...
            trace.add_tokens(input_tokens=100, output_tokens=50)
    """
    global _current_trace
    trace = TraceData(
        conversation_id=conversation_id,
        user_id=user_id,
        provider=provider,
        model=model,
    )
    _current_trace = trace
    try:
        yield trace
    finally:
        _current_trace = None


def log_tokens(input_tokens: int = 0, output_tokens: int = 0) -> None:
    """Log token usage to the current trace (if any)."""
    trace = get_current_trace()
    if trace:
        trace.add_tokens(input_tokens, output_tokens)


def log_tool_call(tool_name: str) -> None:
    """Log a tool call to the current trace (if any)."""
    trace = get_current_trace()
    if trace:
        trace.add_tool_call(tool_name)


# --- Trace query functions ---


def get_traces(
    db: Session,
    user_id: int | None = None,
    conversation_id: int | None = None,
    limit: int = 100,
) -> list[AITrace]:
    """Query traces with optional filters."""
    query = db.query(AITrace).order_by(AITrace.created_at.desc())

    if user_id is not None:
        query = query.filter(AITrace.user_id == user_id)
    if conversation_id is not None:
        query = query.filter(AITrace.conversation_id == conversation_id)

    return query.limit(limit).all()


def get_usage_summary(
    db: Session,
    user_id: int | None = None,
    days: int = 30,
) -> dict[str, Any]:
    """Get usage summary for a user or all users."""
    from datetime import timedelta

    from sqlalchemy import func

    cutoff = datetime.utcnow() - timedelta(days=days)
    query = db.query(
        func.count(AITrace.id).label("total_calls"),
        func.sum(AITrace.input_tokens).label("total_input_tokens"),
        func.sum(AITrace.output_tokens).label("total_output_tokens"),
        func.sum(AITrace.estimated_cost).label("total_cost"),
        func.avg(AITrace.latency_ms).label("avg_latency_ms"),
    ).filter(AITrace.created_at >= cutoff)

    if user_id is not None:
        query = query.filter(AITrace.user_id == user_id)

    result = query.first()

    return {
        "period_days": days,
        "total_calls": result.total_calls or 0,
        "total_input_tokens": result.total_input_tokens or 0,
        "total_output_tokens": result.total_output_tokens or 0,
        "total_tokens": (result.total_input_tokens or 0) + (result.total_output_tokens or 0),
        "total_cost_usd": round(result.total_cost or 0, 4),
        "avg_latency_ms": round(result.avg_latency_ms or 0, 1),
    }

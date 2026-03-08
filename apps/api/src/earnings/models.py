"""
SQLAlchemy models for earnings data.
"""

from datetime import date, datetime

from sqlalchemy import (
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.core.database import Base


class Earnings(Base):
    """Historical earnings data for a stock."""

    __tablename__ = "earnings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ticker: Mapped[str] = mapped_column(String(10), index=True)
    fiscal_date: Mapped[date] = mapped_column(Date)
    fiscal_quarter: Mapped[int] = mapped_column(Integer)  # 1-4
    fiscal_year: Mapped[int] = mapped_column(Integer)

    # EPS data
    eps_estimated: Mapped[float | None] = mapped_column(Float)
    eps_actual: Mapped[float | None] = mapped_column(Float)
    eps_surprise: Mapped[float | None] = mapped_column(Float)
    eps_surprise_pct: Mapped[float | None] = mapped_column(Float)

    # Revenue data
    revenue_estimated: Mapped[float | None] = mapped_column(Float)
    revenue_actual: Mapped[float | None] = mapped_column(Float)
    revenue_surprise_pct: Mapped[float | None] = mapped_column(Float)

    # Timing
    report_time: Mapped[str | None] = mapped_column(String(10))  # 'bmo' or 'amc'
    reported_at: Mapped[datetime | None] = mapped_column(DateTime)

    # Metadata
    fetched_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Transcript(Base):
    """Earnings call transcript metadata."""

    __tablename__ = "transcripts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ticker: Mapped[str] = mapped_column(String(10), index=True)
    fiscal_quarter: Mapped[int] = mapped_column(Integer)
    fiscal_year: Mapped[int] = mapped_column(Integer)
    call_date: Mapped[date] = mapped_column(Date)

    # Content
    full_text: Mapped[str] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(50), default="fmp")

    # Metadata
    fetched_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    chunks: Mapped[list["TranscriptChunk"]] = relationship(
        "TranscriptChunk", back_populates="transcript", cascade="all, delete-orphan"
    )


class TranscriptChunk(Base):
    """Chunked transcript text for embedding."""

    __tablename__ = "transcript_chunks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    transcript_id: Mapped[int] = mapped_column(Integer, ForeignKey("transcripts.id"))
    chunk_index: Mapped[int] = mapped_column(Integer)

    # Content
    content: Mapped[str] = mapped_column(Text)

    # Metadata for filtering
    speaker: Mapped[str | None] = mapped_column(String(100))  # CEO, CFO, Analyst name
    section: Mapped[str | None] = mapped_column(String(50))  # prepared_remarks, q_and_a

    # Relationships
    transcript: Mapped["Transcript"] = relationship("Transcript", back_populates="chunks")

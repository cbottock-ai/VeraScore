from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.core.database import Base


class Earnings(Base):
    """Historical earnings data per quarter."""

    __tablename__ = "earnings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ticker: Mapped[str] = mapped_column(String(10), index=True)
    fiscal_date: Mapped[str] = mapped_column(String(10))  # YYYY-MM-DD
    fiscal_quarter: Mapped[int] = mapped_column(Integer)  # 1-4
    fiscal_year: Mapped[int] = mapped_column(Integer)

    eps_estimated: Mapped[float | None] = mapped_column(Float)
    eps_actual: Mapped[float | None] = mapped_column(Float)
    eps_surprise: Mapped[float | None] = mapped_column(Float)
    eps_surprise_pct: Mapped[float | None] = mapped_column(Float)

    revenue_estimated: Mapped[float | None] = mapped_column(Float)
    revenue_actual: Mapped[float | None] = mapped_column(Float)
    revenue_surprise_pct: Mapped[float | None] = mapped_column(Float)

    report_time: Mapped[str | None] = mapped_column(String(10))  # bmo/amc

    fetched_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Transcript(Base):
    """Earnings call transcript metadata."""

    __tablename__ = "transcripts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ticker: Mapped[str] = mapped_column(String(10), index=True)
    fiscal_quarter: Mapped[int] = mapped_column(Integer)
    fiscal_year: Mapped[int] = mapped_column(Integer)
    call_date: Mapped[str | None] = mapped_column(String(10))  # YYYY-MM-DD

    full_text: Mapped[str | None] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(50), default="fmp")
    fetched_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    chunks: Mapped[list["TranscriptChunk"]] = relationship(
        back_populates="transcript", cascade="all, delete-orphan"
    )


class TranscriptChunk(Base):
    """Chunked transcript text for embedding."""

    __tablename__ = "transcript_chunks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    transcript_id: Mapped[int] = mapped_column(Integer, ForeignKey("transcripts.id"))
    chunk_index: Mapped[int] = mapped_column(Integer)
    content: Mapped[str] = mapped_column(Text)

    speaker: Mapped[str | None] = mapped_column(String(100))  # CEO, CFO, Analyst, etc.
    section: Mapped[str | None] = mapped_column(String(50))  # prepared_remarks, q_and_a

    transcript: Mapped["Transcript"] = relationship(back_populates="chunks")

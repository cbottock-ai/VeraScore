"""Company IR source mapping and fetching for earnings content."""

import logging
import re
from dataclasses import dataclass
from datetime import datetime
from enum import Enum

import httpx
from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, Session, mapped_column

from src.core.database import Base

logger = logging.getLogger(__name__)


class IRPlatform(str, Enum):
    """Common IR platform providers."""

    CUSTOM = "custom"
    Q4 = "q4"  # Q4 Inc - used by many tech companies
    SHAREHOLDER = "shareholder"  # Shareholder.com / Notified
    FACTSET = "factset"
    NASDAQ = "nasdaq"


class CompanyIRSource(Base):
    """Mapping of tickers to their investor relations sources."""

    __tablename__ = "company_ir_sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ticker: Mapped[str] = mapped_column(String(10), unique=True, index=True)
    company_name: Mapped[str] = mapped_column(String(200))

    # IR page URLs
    ir_home_url: Mapped[str] = mapped_column(Text)
    earnings_url: Mapped[str | None] = mapped_column(Text)
    transcripts_url: Mapped[str | None] = mapped_column(Text)
    sec_filings_url: Mapped[str | None] = mapped_column(Text)
    press_releases_url: Mapped[str | None] = mapped_column(Text)

    # Platform info for parsing
    ir_platform: Mapped[str] = mapped_column(String(50), default="custom")

    # Tracking
    last_verified: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


@dataclass
class EarningsDocument:
    """An earnings-related document from a company IR page."""

    title: str
    url: str
    doc_type: str  # transcript, press_release, presentation, 10q, 10k
    date: str | None = None
    quarter: int | None = None
    year: int | None = None


# Seed data for major companies
SEED_IR_SOURCES = [
    {
        "ticker": "AAPL",
        "company_name": "Apple Inc.",
        "ir_home_url": "https://investor.apple.com",
        "earnings_url": "https://investor.apple.com/investor-relations/default.aspx",
        "sec_filings_url": "https://investor.apple.com/sec-filings/default.aspx",
        "ir_platform": "shareholder",
    },
    {
        "ticker": "MSFT",
        "company_name": "Microsoft Corporation",
        "ir_home_url": "https://www.microsoft.com/en-us/investor",
        "earnings_url": "https://www.microsoft.com/en-us/investor/earnings/fy-2026-q2",
        "sec_filings_url": "https://www.microsoft.com/en-us/investor/sec-filings",
        "press_releases_url": "https://www.microsoft.com/en-us/investor/earnings/",
        "ir_platform": "custom",
    },
    {
        "ticker": "NVDA",
        "company_name": "NVIDIA Corporation",
        "ir_home_url": "https://investor.nvidia.com",
        "earnings_url": "https://investor.nvidia.com/financial-info/quarterly-results/default.aspx",
        "sec_filings_url": "https://investor.nvidia.com/financial-info/sec-filings/default.aspx",
        "ir_platform": "shareholder",
    },
    {
        "ticker": "GOOGL",
        "company_name": "Alphabet Inc.",
        "ir_home_url": "https://abc.xyz/investor/",
        "earnings_url": "https://abc.xyz/investor/",
        "sec_filings_url": "https://abc.xyz/investor/other/sec-filings/",
        "ir_platform": "custom",
    },
    {
        "ticker": "AMZN",
        "company_name": "Amazon.com Inc.",
        "ir_home_url": "https://ir.aboutamazon.com",
        "earnings_url": "https://ir.aboutamazon.com/quarterly-results/default.aspx",
        "sec_filings_url": "https://ir.aboutamazon.com/sec-filings/default.aspx",
        "ir_platform": "shareholder",
    },
    {
        "ticker": "META",
        "company_name": "Meta Platforms Inc.",
        "ir_home_url": "https://investor.fb.com",
        "earnings_url": "https://investor.fb.com/financials/default.aspx",
        "sec_filings_url": "https://investor.fb.com/financials/sec-filings/default.aspx",
        "ir_platform": "shareholder",
    },
    {
        "ticker": "TSLA",
        "company_name": "Tesla Inc.",
        "ir_home_url": "https://ir.tesla.com",
        "earnings_url": "https://ir.tesla.com/#quarterly-disclosure",
        "sec_filings_url": "https://ir.tesla.com/#sec-filings",
        "ir_platform": "custom",
    },
]


def seed_ir_sources(db: Session) -> int:
    """Seed the database with initial IR source mappings."""
    count = 0
    for source_data in SEED_IR_SOURCES:
        existing = (
            db.query(CompanyIRSource)
            .filter(CompanyIRSource.ticker == source_data["ticker"])
            .first()
        )
        if not existing:
            source = CompanyIRSource(**source_data, last_verified=datetime.utcnow())
            db.add(source)
            count += 1

    db.commit()
    return count


def get_ir_source(ticker: str, db: Session) -> CompanyIRSource | None:
    """Get IR source mapping for a ticker."""
    return (
        db.query(CompanyIRSource)
        .filter(CompanyIRSource.ticker == ticker.upper())
        .first()
    )


def add_ir_source(
    ticker: str,
    company_name: str,
    ir_home_url: str,
    db: Session,
    **kwargs,
) -> CompanyIRSource:
    """Add or update an IR source mapping."""
    ticker = ticker.upper()
    existing = get_ir_source(ticker, db)

    if existing:
        existing.company_name = company_name
        existing.ir_home_url = ir_home_url
        for key, value in kwargs.items():
            if hasattr(existing, key):
                setattr(existing, key, value)
        existing.last_verified = datetime.utcnow()
        db.commit()
        return existing

    source = CompanyIRSource(
        ticker=ticker,
        company_name=company_name,
        ir_home_url=ir_home_url,
        last_verified=datetime.utcnow(),
        **kwargs,
    )
    db.add(source)
    db.commit()
    db.refresh(source)
    return source


async def fetch_ir_page(url: str) -> str | None:
    """Fetch content from an IR page."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                url,
                headers={
                    "User-Agent": "Mozilla/5.0 (compatible; VeraScore/1.0)",
                },
                follow_redirects=True,
                timeout=15,
            )
            resp.raise_for_status()
            return resp.text
    except Exception as e:
        logger.error(f"Failed to fetch IR page {url}: {e}")
        return None


def parse_earnings_links(html: str, base_url: str) -> list[EarningsDocument]:
    """Parse earnings-related document links from HTML."""
    documents = []

    # Common patterns for earnings content
    patterns = [
        # Transcript patterns
        (r'href=["\']([^"\']*transcript[^"\']*)["\']', "transcript"),
        # Press release patterns
        (r'href=["\']([^"\']*press[-_]?release[^"\']*)["\']', "press_release"),
        (r'href=["\']([^"\']*earnings[-_]?release[^"\']*)["\']', "press_release"),
        # Presentation/slides
        (r'href=["\']([^"\']*presentation[^"\']*\.pdf)["\']', "presentation"),
        (r'href=["\']([^"\']*slides[^"\']*\.pdf)["\']', "presentation"),
        # SEC filings
        (r'href=["\']([^"\']*10-?[qk][^"\']*)["\']', "sec_filing"),
        # Webcast
        (r'href=["\']([^"\']*webcast[^"\']*)["\']', "webcast"),
    ]

    for pattern, doc_type in patterns:
        matches = re.findall(pattern, html, re.IGNORECASE)
        for match in matches[:5]:  # Limit to 5 per type
            url = match
            if not url.startswith("http"):
                # Make absolute URL
                if url.startswith("/"):
                    # Extract domain from base_url
                    domain_match = re.match(r"(https?://[^/]+)", base_url)
                    if domain_match:
                        url = domain_match.group(1) + url
                else:
                    url = base_url.rstrip("/") + "/" + url

            # Try to extract date/quarter info from URL
            quarter, year = _extract_quarter_year(url)

            documents.append(
                EarningsDocument(
                    title=f"{doc_type.replace('_', ' ').title()}",
                    url=url,
                    doc_type=doc_type,
                    quarter=quarter,
                    year=year,
                )
            )

    # Deduplicate by URL
    seen = set()
    unique_docs = []
    for doc in documents:
        if doc.url not in seen:
            seen.add(doc.url)
            unique_docs.append(doc)

    return unique_docs


def _extract_quarter_year(text: str) -> tuple[int | None, int | None]:
    """Extract quarter and year from text/URL."""
    quarter = None
    year = None

    # Look for Q1, Q2, Q3, Q4
    q_match = re.search(r"[qQ]([1-4])", text)
    if q_match:
        quarter = int(q_match.group(1))

    # Look for year (2020-2030)
    year_match = re.search(r"20(2[0-9]|30)", text)
    if year_match:
        year = int("20" + year_match.group(1))

    return quarter, year


async def discover_ir_url(company_name: str, ticker: str) -> str | None:
    """Try to auto-discover a company's IR page URL."""
    # Common IR URL patterns to try
    common_patterns = [
        f"https://investor.{ticker.lower()}.com",
        f"https://ir.{ticker.lower()}.com",
        f"https://investors.{ticker.lower()}.com",
    ]

    async with httpx.AsyncClient() as client:
        for url in common_patterns:
            try:
                resp = await client.head(url, follow_redirects=True, timeout=5)
                if resp.status_code == 200:
                    return str(resp.url)
            except Exception:
                continue

    return None

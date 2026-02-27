"""Fetch earnings content from company IR pages."""

import logging
import re
from dataclasses import dataclass

import httpx
from sqlalchemy.orm import Session

from src.earnings.ir_sources import (
    CompanyIRSource,
    EarningsDocument,
    fetch_ir_page,
    get_ir_source,
    parse_earnings_links,
)

logger = logging.getLogger(__name__)


@dataclass
class EarningsContent:
    """Fetched earnings content from an IR page."""

    ticker: str
    source_url: str
    documents: list[EarningsDocument]
    raw_text: str | None = None  # For transcript text


async def fetch_earnings_content(
    ticker: str,
    db: Session,
    include_transcripts: bool = True,
) -> EarningsContent | None:
    """Fetch earnings content for a ticker from its IR page."""
    ticker = ticker.upper()

    # Get IR source mapping
    source = get_ir_source(ticker, db)
    if not source:
        logger.warning(f"No IR source mapping for {ticker}")
        return None

    # Fetch earnings page
    url = source.earnings_url or source.ir_home_url
    html = await fetch_ir_page(url)
    if not html:
        return None

    # Parse document links
    documents = parse_earnings_links(html, url)

    return EarningsContent(
        ticker=ticker,
        source_url=url,
        documents=documents,
    )


async def fetch_transcript_text(doc: EarningsDocument) -> str | None:
    """Fetch the actual transcript text from a document URL."""
    if doc.doc_type != "transcript":
        return None

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                doc.url,
                headers={"User-Agent": "Mozilla/5.0 (compatible; VeraScore/1.0)"},
                follow_redirects=True,
                timeout=30,
            )
            resp.raise_for_status()

            content_type = resp.headers.get("content-type", "")

            if "pdf" in content_type:
                # Would need PDF parsing - skip for now
                logger.info(f"PDF transcript at {doc.url} - skipping")
                return None

            html = resp.text

            # Extract text content (basic HTML stripping)
            # Remove script and style elements
            html = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.DOTALL)
            html = re.sub(r"<style[^>]*>.*?</style>", "", html, flags=re.DOTALL)

            # Remove HTML tags
            text = re.sub(r"<[^>]+>", " ", html)

            # Clean up whitespace
            text = re.sub(r"\s+", " ", text).strip()

            return text if len(text) > 500 else None

    except Exception as e:
        logger.error(f"Failed to fetch transcript from {doc.url}: {e}")
        return None


async def search_company_ir(query: str, db: Session) -> list[CompanyIRSource]:
    """Search for companies with IR sources matching a query."""
    query_lower = query.lower()
    sources = db.query(CompanyIRSource).all()

    matches = []
    for source in sources:
        if (
            query_lower in source.ticker.lower()
            or query_lower in source.company_name.lower()
        ):
            matches.append(source)

    return matches


async def list_available_ir_sources(db: Session) -> list[dict]:
    """List all available IR source mappings."""
    sources = db.query(CompanyIRSource).all()
    return [
        {
            "ticker": s.ticker,
            "company_name": s.company_name,
            "ir_home_url": s.ir_home_url,
            "platform": s.ir_platform,
            "last_verified": s.last_verified.isoformat() if s.last_verified else None,
        }
        for s in sources
    ]

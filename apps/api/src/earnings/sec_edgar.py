"""SEC EDGAR fetcher for earnings filings (10-Q, 10-K, 8-K)."""

import logging
import re
from dataclasses import dataclass

import httpx

logger = logging.getLogger(__name__)

SEC_EDGAR_BASE = "https://data.sec.gov"
SEC_SEARCH_BASE = "https://efts.sec.gov/LATEST/search-index"


@dataclass
class SECFiling:
    """An SEC filing document."""

    form_type: str  # 10-Q, 10-K, 8-K
    filing_date: str
    accession_number: str
    primary_doc_url: str
    filing_url: str
    description: str | None = None


async def get_company_cik(ticker: str) -> str | None:
    """Get CIK number for a ticker from SEC."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{SEC_EDGAR_BASE}/submissions/CIK{ticker.upper()}.json",
                headers={"User-Agent": "VeraScore contact@example.com"},
                timeout=10,
            )
            if resp.status_code == 404:
                # Try company tickers lookup
                resp = await client.get(
                    "https://www.sec.gov/files/company_tickers.json",
                    headers={"User-Agent": "VeraScore contact@example.com"},
                    timeout=10,
                )
                resp.raise_for_status()
                tickers = resp.json()
                for entry in tickers.values():
                    if entry.get("ticker", "").upper() == ticker.upper():
                        return str(entry["cik_str"]).zfill(10)
                return None

            resp.raise_for_status()
            data = resp.json()
            return str(data.get("cik", "")).zfill(10)
    except Exception as e:
        logger.error(f"Failed to get CIK for {ticker}: {e}")
        return None


async def fetch_recent_filings(
    ticker: str,
    form_types: list[str] | None = None,
    limit: int = 10,
) -> list[SECFiling]:
    """Fetch recent SEC filings for a company."""
    if form_types is None:
        form_types = ["10-Q", "10-K", "8-K"]

    cik = await get_company_cik(ticker)
    if not cik:
        logger.warning(f"Could not find CIK for {ticker}")
        return []

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{SEC_EDGAR_BASE}/submissions/CIK{cik}.json",
                headers={"User-Agent": "VeraScore contact@example.com"},
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()

            filings = []
            recent = data.get("filings", {}).get("recent", {})

            forms = recent.get("form", [])
            dates = recent.get("filingDate", [])
            accessions = recent.get("accessionNumber", [])
            primary_docs = recent.get("primaryDocument", [])
            descriptions = recent.get("primaryDocDescription", [])

            for i, form in enumerate(forms):
                if form in form_types and len(filings) < limit:
                    accession = accessions[i].replace("-", "")
                    primary_doc = primary_docs[i] if i < len(primary_docs) else ""

                    filing_url = (
                        f"https://www.sec.gov/Archives/edgar/data/{cik}/{accession}"
                    )
                    doc_url = f"{filing_url}/{primary_doc}" if primary_doc else ""

                    filings.append(
                        SECFiling(
                            form_type=form,
                            filing_date=dates[i] if i < len(dates) else "",
                            accession_number=accessions[i],
                            primary_doc_url=doc_url,
                            filing_url=filing_url,
                            description=descriptions[i] if i < len(descriptions) else None,
                        )
                    )

            return filings

    except Exception as e:
        logger.error(f"Failed to fetch filings for {ticker}: {e}")
        return []


async def fetch_filing_text(filing: SECFiling) -> str | None:
    """Fetch the text content of a filing."""
    if not filing.primary_doc_url:
        return None

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                filing.primary_doc_url,
                headers={"User-Agent": "VeraScore contact@example.com"},
                follow_redirects=True,
                timeout=30,
            )
            resp.raise_for_status()

            content = resp.text

            # Basic HTML to text conversion
            content = re.sub(r"<script[^>]*>.*?</script>", "", content, flags=re.DOTALL)
            content = re.sub(r"<style[^>]*>.*?</style>", "", content, flags=re.DOTALL)
            content = re.sub(r"<[^>]+>", " ", content)
            content = re.sub(r"\s+", " ", content).strip()

            return content if len(content) > 1000 else None

    except Exception as e:
        logger.error(f"Failed to fetch filing text: {e}")
        return None


async def search_8k_earnings(ticker: str, limit: int = 4) -> list[SECFiling]:
    """Search for 8-K filings that contain earnings announcements."""
    filings = await fetch_recent_filings(ticker, form_types=["8-K"], limit=20)
    return filings[:limit]


async def fetch_earnings_8ks(ticker: str, limit: int = 4) -> list[SECFiling]:
    """
    Fetch 8-K filings that are earnings releases (Item 2.02).

    Uses the 'items' field from SEC submissions to filter to earnings 8-Ks only.
    """
    cik = await get_company_cik(ticker)
    if not cik:
        return []

    try:
        async with httpx.AsyncClient(follow_redirects=True) as client:
            headers = {"User-Agent": "VeraScore research@verascore.com"}
            resp = await client.get(
                f"{SEC_EDGAR_BASE}/submissions/CIK{cik}.json",
                headers=headers,
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()

            recent = data.get("filings", {}).get("recent", {})
            forms = recent.get("form", [])
            dates = recent.get("filingDate", [])
            accessions = recent.get("accessionNumber", [])
            primary_docs = recent.get("primaryDocument", [])
            items_list = recent.get("items", [])

            filings = []
            cik_int = str(int(cik))  # Strip leading zeros for archive URL

            for i, form in enumerate(forms):
                if form != "8-K":
                    continue
                # Item 2.02 = Results of Operations (earnings release)
                items_str = items_list[i] if i < len(items_list) else ""
                if "2.02" not in str(items_str):
                    continue

                accession = accessions[i]
                primary_doc = primary_docs[i] if i < len(primary_docs) else ""
                accession_clean = accession.replace("-", "")

                filing_url = (
                    f"https://www.sec.gov/Archives/edgar/data/{cik_int}/{accession_clean}"
                )
                doc_url = f"{filing_url}/{primary_doc}" if primary_doc else ""

                filings.append(
                    SECFiling(
                        form_type=form,
                        filing_date=dates[i] if i < len(dates) else "",
                        accession_number=accession,
                        primary_doc_url=doc_url,
                        filing_url=filing_url,
                        description=f"Earnings Release (Item 2.02)",
                    )
                )

                if len(filings) >= limit:
                    break

            return filings

    except Exception as e:
        logger.error(f"Failed to fetch earnings 8-Ks for {ticker}: {e}")
        return []


async def fetch_exhibit_99_1(filing: SECFiling) -> str | None:
    """
    Fetch the Exhibit 99.1 (press release) text from an earnings 8-K.

    Parses the primary 8-K document to find the exhibit link, then fetches it.
    """
    if not filing.primary_doc_url:
        return None

    try:
        async with httpx.AsyncClient(follow_redirects=True) as client:
            headers = {"User-Agent": "VeraScore research@verascore.com"}

            # Fetch the main 8-K document to find exhibit links
            resp = await client.get(filing.primary_doc_url, headers=headers, timeout=15)
            resp.raise_for_status()

            # Find relative .htm links — Exhibit 99.1 is typically the only one
            import re as _re

            links = _re.findall(r'href=["\']([^"\'> ]+\.htm[l]?)["\']', resp.text, _re.IGNORECASE)
            # Filter out the primary doc itself and pick the first exhibit
            primary_name = filing.primary_doc_url.rsplit("/", 1)[-1]
            base_url = filing.primary_doc_url.rsplit("/", 1)[0]

            exhibit_links = [l for l in links if l != primary_name and not l.startswith("http")]
            if not exhibit_links:
                return None

            # Deduplicate while preserving order
            seen: set[str] = set()
            unique_links = [l for l in exhibit_links if not (l in seen or seen.add(l))]  # type: ignore[func-returns-value]
            exhibit_url = f"{base_url}/{unique_links[0]}"

            # Fetch the exhibit
            resp2 = await client.get(exhibit_url, headers=headers, timeout=15)
            resp2.raise_for_status()

            # Strip HTML tags
            text = _re.sub(r"<script[^>]*>.*?</script>", "", resp2.text, flags=_re.DOTALL)
            text = _re.sub(r"<style[^>]*>.*?</style>", "", text, flags=_re.DOTALL)
            text = _re.sub(r"<[^>]+>", " ", text)
            text = _re.sub(r"&#\d+;", " ", text)
            text = _re.sub(r"&[a-z]+;", " ", text)
            text = _re.sub(r"\s+", " ", text).strip()

            return text if len(text) > 500 else None

    except Exception as e:
        logger.error(f"Failed to fetch Exhibit 99.1 for {filing.filing_date}: {e}")
        return None

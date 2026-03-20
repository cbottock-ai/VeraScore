import asyncio
import time
from datetime import datetime, timezone

from fastapi import APIRouter, Query
from src.core.data_providers.fmp import (
    fmp_batch_quote,
    fmp_historical_price_light,
    fmp_grades,
    fmp_grades_consensus,
    fmp_price_target_consensus,
    fmp_insider_trading,
)

router = APIRouter(prefix="/market", tags=["market"])

# Sector ETFs mapped to GICS sector names
SECTOR_ETFS: list[tuple[str, str]] = [
    ("XLK", "Technology"),
    ("XLV", "Healthcare"),
    ("XLF", "Financials"),
    ("XLY", "Consumer Discretionary"),
    ("XLP", "Consumer Staples"),
    ("XLI", "Industrials"),
    ("XLE", "Energy"),
    ("XLU", "Utilities"),
    ("XLRE", "Real Estate"),
    ("XLB", "Materials"),
    ("XLC", "Communication Services"),
]


@router.get("/sectors")
async def sector_performance():
    etf_symbols = [etf for etf, _ in SECTOR_ETFS]
    sector_map = {etf: sector for etf, sector in SECTOR_ETFS}
    try:
        quotes = await fmp_batch_quote(etf_symbols)
    except Exception:
        quotes = []
    quote_by_symbol = {q.get("symbol", "").upper(): q for q in quotes}
    return {
        "sectors": [
            {
                "sector": sector_map[etf],
                "etf": etf,
                "changes_pct": quote_by_symbol.get(etf, {}).get("changePercentage"),
                "price": quote_by_symbol.get(etf, {}).get("price"),
                "change": quote_by_symbol.get(etf, {}).get("change"),
            }
            for etf in etf_symbols
            if etf in sector_map
        ]
    }


@router.get("/sectors/history")
async def sector_history(
    from_date: str = Query(...),
    to_date: str = Query(...),
):
    """Fetch historical daily prices for all 11 sector ETFs, normalized to % return from period start."""
    etf_symbols = [etf for etf, _ in SECTOR_ETFS]
    sector_map = {etf: sector for etf, sector in SECTOR_ETFS}

    async def fetch(etf: str):
        try:
            rows = await fmp_historical_price_light(etf, from_date, to_date)
            # rows are newest-first; reverse to chronological
            rows = list(reversed(rows))
            return etf, rows
        except Exception:
            return etf, []

    results = await asyncio.gather(*[fetch(etf) for etf in etf_symbols])

    # Build a date-aligned structure: {date -> {etf: pct_return}}
    # First pass: collect all dates and base prices
    etf_data: dict[str, list[dict]] = {}
    for etf, rows in results:
        etf_data[etf] = rows

    all_dates: list[str] = sorted(
        {row["date"] for rows in etf_data.values() for row in rows}
    )

    series = []
    for d in all_dates:
        point: dict = {"date": d}
        for etf in etf_symbols:
            rows = etf_data.get(etf, [])
            if rows:
                base = rows[0]["price"]
                row = next((r for r in rows if r["date"] == d), None)
                if row and base:
                    point[etf] = round((row["price"] / base - 1) * 100, 4)
                else:
                    point[etf] = None
        series.append(point)

    return {
        "series": series,
        "etfs": [{"etf": etf, "sector": sector_map[etf]} for etf in etf_symbols],
    }


SP500_TICKERS = [
    "MMM", "AOS", "ABT", "ABBV", "ACN", "ADBE", "AMD", "AES", "AFL", "A",
    "APD", "ABNB", "AKAM", "ALB", "ARE", "ALGN", "ALLE", "LNT", "ALL", "GOOGL",
    "GOOG", "MO", "AMZN", "AMCR", "AEE", "AAL", "AEP", "AXP", "AIG", "AMT",
    "AWK", "AMP", "AME", "AMGN", "APH", "ADI", "ANSS", "AON", "APA", "AAPL",
    "AMAT", "APTV", "ACGL", "ADM", "ANET", "AJG", "AIZ", "T", "ATO", "ADSK",
    "ADP", "AZO", "AVB", "AVY", "AXON", "BKR", "BALL", "BAC", "BA", "BKNG",
    "BWA", "BSX", "BMY", "AVGO", "BR", "BRO", "BLDR", "BG", "CDNS",
    "CZR", "CPT", "CPB", "COF", "CAH", "KMX", "CCL", "CARR", "CAT",
    "CBOE", "CBRE", "CDW", "CE", "COR", "CNC", "CNX", "CDAY", "CF", "CRL",
    "SCHW", "CHTR", "CVX", "CMG", "CB", "CHD", "CI", "CINF", "CTAS", "CSCO",
    "C", "CFG", "CLX", "CME", "CMS", "KO", "CTSH", "CL", "CMCSA", "CAG",
    "COP", "ED", "STZ", "CEG", "COO", "CPRT", "GLW", "CPAY", "CTVA", "CSGP",
    "COST", "CTRA", "CCI", "CSX", "CMI", "CVS", "DHR", "DRI", "DVA", "DAY",
    "DE", "DAL", "DVN", "DXCM", "FANG", "DLR", "DFS", "DG", "DLTR", "D",
    "DPZ", "DOV", "DOW", "DHI", "DTE", "DUK", "DD", "EMN", "ETN", "EBAY",
    "ECL", "EIX", "EW", "EA", "ELV", "LLY", "EMR", "ENPH", "ETR", "EOG",
    "EPAM", "EQT", "EFX", "EQIX", "EQR", "ESS", "EL", "ETSY", "EG", "EVRG",
    "ES", "EXC", "EXPE", "EXPD", "EXR", "XOM", "FFIV", "FDS", "FICO", "FAST",
    "FRT", "FDX", "FIS", "FITB", "FSLR", "FE", "FI", "FMC", "F", "FTNT",
    "FTV", "FOXA", "FOX", "BEN", "FCX", "GRMN", "IT", "GE", "GEHC", "GEV",
    "GEN", "GNRC", "GD", "GIS", "GM", "GPC", "GILD", "GS", "HAL", "HIG",
    "HAS", "HCA", "DOC", "HSIC", "HSY", "HES", "HPE", "HLT", "HOLX", "HD",
    "HON", "HRL", "HST", "HWM", "HPQ", "HUBB", "HUM", "HBAN", "HII", "IBM",
    "IEX", "IDXX", "ITW", "INCY", "IR", "PODD", "INTC", "ICE", "IFF", "IP",
    "IPG", "INTU", "ISRG", "IVZ", "INVH", "IQV", "IRM", "JBHT", "JBL", "JKHY",
    "J", "JNJ", "JCI", "JPM", "JNPR", "K", "KVUE", "KDP", "KEY", "KEYS",
    "KMB", "KIM", "KMI", "KLAC", "KHC", "KR", "LHX", "LH", "LRCX", "LW",
    "LVS", "LDOS", "LEN", "LII", "LIN", "LYV", "LKQ", "LMT", "L", "LOW",
    "LULU", "LYB", "MTB", "MRO", "MPC", "MKTX", "MAR", "MMC", "MLM", "MAS",
    "MA", "MTCH", "MKC", "MCD", "MCK", "MDT", "MRK", "META", "MET", "MTD",
    "MGM", "MCHP", "MU", "MSFT", "MAA", "MRNA", "MHK", "MOH", "TAP", "MDLZ",
    "MPWR", "MNST", "MCO", "MS", "MOS", "MSI", "MSCI", "NDAQ", "NTAP", "NFLX",
    "NEM", "NWSA", "NWS", "NEE", "NKE", "NI", "NDSN", "NSC", "NTRS", "NOC",
    "NCLH", "NRG", "NUE", "NVDA", "NVR", "NXPI", "ORLY", "OXY", "ODFL", "OMC",
    "ON", "OKE", "ORCL", "OTIS", "PCAR", "PKG", "PLTR", "PANW", "PARA", "PH",
    "PAYX", "PAYC", "PYPL", "PNR", "PEP", "PFE", "PCG", "PM", "PSX", "PNW",
    "PNC", "POOL", "PPG", "PPL", "PFG", "PG", "PGR", "PRU", "PLD",
    "PEG", "PTC", "PSA", "PHM", "PWR", "QCOM", "DGX", "RL", "RJF",
    "RTX", "O", "REG", "REGN", "RF", "RSG", "RMD", "RVTY", "ROK", "ROL",
    "ROP", "ROST", "RCL", "SPGI", "CRM", "SBAC", "SLB", "STX", "SRE", "NOW",
    "SHW", "SPG", "SWKS", "SJM", "SW", "SNA", "SOLV", "SO", "LUV", "SWK",
    "SBUX", "STT", "STLD", "STE", "SYK", "SMCI", "SYF", "SNPS", "SYY", "TMUS",
    "TROW", "TTWO", "TPR", "TRGP", "TGT", "TEL", "TDY", "TFX", "TER", "TSLA",
    "TXN", "TXT", "TMO", "TJX", "TSCO", "TT", "TDG", "TRV", "TRMB", "TFC",
    "TYL", "TSN", "USB", "UBER", "UDR", "ULTA", "UNP", "UAL", "UPS", "URI",
    "UNH", "UHS", "VLO", "VTR", "VLTO", "VRSN", "VRSK", "VZ", "VRTX", "VTRS",
    "VICI", "V", "VST", "VMC", "WRB", "GWW", "WAB", "WBA", "WMT", "DIS",
    "WBD", "WM", "WAT", "WEC", "WFC", "WELL", "WST", "WDC", "WY", "WHR",
    "WMB", "WTW", "WYNN", "XEL", "XYL", "YUM", "ZBRA", "ZBH", "ZTS",
]

# In-memory caches
_grades_cache: tuple[float, list[dict]] | None = None
_consensus_cache: tuple[float, dict[str, dict]] | None = None  # symbol -> {consensus, price_target}
_cache_lock = asyncio.Lock()
GRADES_CACHE_TTL = 4 * 60 * 60  # 4 hours
GRADES_CONCURRENCY = 8  # conservative to avoid FMP 429s during S&P 500 fan-out

_insider_cache: tuple[float, list[dict]] | None = None
_insider_cache_lock = asyncio.Lock()
INSIDER_CACHE_TTL = 2 * 60 * 60  # 2 hours


GRADES_BATCH_SIZE = 50   # tickers per batch
GRADES_BATCH_DELAY = 2.0  # seconds between batches — keeps us well under FMP rate limits


async def _fetch_sp500_data() -> tuple[list[dict], dict[str, dict]]:
    """Fetch grades + consensus + price targets for all S&P 500 tickers."""
    from datetime import date, timedelta
    since = (date.today() - timedelta(days=60)).isoformat()

    async def fetch_one(symbol: str) -> tuple:
        try:
            grades = await fmp_grades(symbol, limit=5)
        except Exception:
            return symbol, None, None, None  # None grades = failed, eligible for retry
        try:
            consensus = await fmp_grades_consensus(symbol)
        except Exception:
            consensus = None
        try:
            pt = await fmp_price_target_consensus(symbol)
        except Exception:
            pt = None
        recent = [r for r in grades if (r.get("date") or "") >= since]
        return symbol, recent, consensus, pt

    # Process tickers in batches with a delay between each batch
    tickers = list(SP500_TICKERS)
    results: list = []
    for i in range(0, len(tickers), GRADES_BATCH_SIZE):
        batch = tickers[i:i + GRADES_BATCH_SIZE]
        batch_results = await asyncio.gather(*[fetch_one(s) for s in batch], return_exceptions=True)
        results.extend(batch_results)
        if i + GRADES_BATCH_SIZE < len(tickers):
            await asyncio.sleep(GRADES_BATCH_DELAY)

    # Retry any tickers that returned None (rate-limited during first pass)
    failed = [r[0] for r in results if not isinstance(r, Exception) and r[1] is None]
    if failed:
        await asyncio.sleep(10)
        retry_results = []
        for i in range(0, len(failed), GRADES_BATCH_SIZE):
            batch = failed[i:i + GRADES_BATCH_SIZE]
            batch_results = await asyncio.gather(*[fetch_one(s) for s in batch], return_exceptions=True)
            retry_results.extend(batch_results)
            if i + GRADES_BATCH_SIZE < len(failed):
                await asyncio.sleep(GRADES_BATCH_DELAY)
        failed_set = set(failed)
        results = [r for r in results if not isinstance(r, Exception) and r[0] not in failed_set]
        results += [r for r in retry_results if not isinstance(r, Exception)]

    merged_grades: list[dict] = []
    consensus_map: dict[str, dict] = {}

    for r in results:
        if isinstance(r, Exception):
            continue
        symbol, grades, consensus, pt = r
        if grades is None:
            continue  # still failed after retry — skip rather than overwrite good data
        merged_grades.extend(grades)
        entry: dict = {}
        if isinstance(consensus, dict):
            entry.update({
                "strong_buy": consensus.get("strongBuy"),
                "buy": consensus.get("buy"),
                "hold": consensus.get("hold"),
                "sell": consensus.get("sell"),
                "strong_sell": consensus.get("strongSell"),
                "consensus": consensus.get("consensus"),
            })
        if isinstance(pt, dict):
            entry.update({
                "pt_high": pt.get("targetHigh"),
                "pt_low": pt.get("targetLow"),
                "pt_consensus": pt.get("targetConsensus"),
                "pt_median": pt.get("targetMedian"),
            })
        if entry:
            consensus_map[symbol] = entry

    merged_grades.sort(key=lambda r: r.get("date") or "", reverse=True)
    return merged_grades, consensus_map


async def _get_cache() -> tuple[list[dict], dict[str, dict]]:
    global _grades_cache, _consensus_cache
    async with _cache_lock:
        now = time.time()
        if (_grades_cache and _consensus_cache and
                (now - _grades_cache[0]) < GRADES_CACHE_TTL):
            return _grades_cache[1], _consensus_cache[1]
        grades, consensus = await _fetch_sp500_data()
        _grades_cache = (now, grades)
        _consensus_cache = (now, consensus)
        return grades, consensus


@router.post("/analyst-ratings/refresh")
async def refresh_analyst_cache():
    """Force-invalidate the analyst ratings cache so it rebuilds on next request."""
    global _grades_cache, _consensus_cache
    async with _cache_lock:
        _grades_cache = None
        _consensus_cache = None
    return {"status": "cache cleared"}


@router.get("/analyst-ratings")
async def analyst_ratings(
    symbols: str | None = Query(None, description="Comma-separated watchlist tickers"),
):
    from datetime import date, timedelta
    grades, consensus = await _get_cache()
    since = (date.today() - timedelta(days=60)).isoformat()

    if symbols:
        symbol_set = {s.strip().upper() for s in symbols.split(",") if s.strip()}
        # Supplement cache with any watchlist tickers not in S&P 500
        sp500_set = set(SP500_TICKERS)
        extra_symbols = [s for s in symbol_set if s not in sp500_set]
        if extra_symbols:
            cached_symbols = {r.get("symbol") for r in grades}
            missing = [s for s in extra_symbols if s not in cached_symbols]
            if missing:
                extra_grades_results = await asyncio.gather(
                    *[fmp_grades(s, limit=3) for s in missing],
                    return_exceptions=True,
                )
                extra_consensus_results = await asyncio.gather(
                    *[asyncio.gather(fmp_grades_consensus(s), fmp_price_target_consensus(s), return_exceptions=True)
                      for s in missing],
                    return_exceptions=True,
                )
                for s, result in zip(missing, extra_grades_results):
                    if isinstance(result, list):
                        recent = [r for r in result if (r.get("date") or "") >= since]
                        grades = grades + recent
                for s, result in zip(missing, extra_consensus_results):
                    if isinstance(result, (list, tuple)) and len(result) == 2:
                        c, pt = result
                        entry: dict = {}
                        if isinstance(c, dict):
                            entry.update({"strong_buy": c.get("strongBuy"), "buy": c.get("buy"),
                                          "hold": c.get("hold"), "sell": c.get("sell"),
                                          "strong_sell": c.get("strongSell"), "consensus": c.get("consensus")})
                        if isinstance(pt, dict):
                            entry.update({"pt_high": pt.get("targetHigh"), "pt_low": pt.get("targetLow"),
                                          "pt_consensus": pt.get("targetConsensus"), "pt_median": pt.get("targetMedian")})
                        if entry:
                            consensus = {**consensus, s: entry}
        grades = [r for r in grades if r.get("symbol") in symbol_set]

    grades = sorted(grades, key=lambda r: r.get("date") or "", reverse=True)

    return {
        "ratings": [
            {
                "symbol": r.get("symbol"),
                "date": r.get("date"),
                "action": r.get("action"),
                "rating_from": r.get("previousGrade"),
                "rating_to": r.get("newGrade"),
                "firm": r.get("gradingCompany"),
            }
            for r in grades
            if r.get("symbol")
        ],
    }


@router.get("/analyst-consensus")
async def analyst_consensus(
    symbols: str | None = Query(None, description="Comma-separated tickers"),
):
    """Return buy/hold/sell consensus + price target for requested symbols."""
    _, consensus_map = await _get_cache()

    if symbols:
        symbol_set = {s.strip().upper() for s in symbols.split(",") if s.strip()}
        # Fetch consensus for any symbols not in the S&P 500 cache
        missing = [s for s in symbol_set if s not in consensus_map]
        if missing:
            extra = await asyncio.gather(
                *[asyncio.gather(fmp_grades_consensus(s), fmp_price_target_consensus(s), return_exceptions=True)
                  for s in missing],
                return_exceptions=True,
            )
            consensus_map = dict(consensus_map)  # copy before mutating
            for s, result in zip(missing, extra):
                if isinstance(result, (list, tuple)) and len(result) == 2:
                    c, pt = result
                    entry: dict = {}
                    if isinstance(c, dict):
                        entry.update({"strong_buy": c.get("strongBuy"), "buy": c.get("buy"),
                                      "hold": c.get("hold"), "sell": c.get("sell"),
                                      "strong_sell": c.get("strongSell"), "consensus": c.get("consensus")})
                    if isinstance(pt, dict):
                        entry.update({"pt_high": pt.get("targetHigh"), "pt_low": pt.get("targetLow"),
                                      "pt_consensus": pt.get("targetConsensus"), "pt_median": pt.get("targetMedian")})
                    if entry:
                        consensus_map[s] = entry
        result = {s: consensus_map[s] for s in symbol_set if s in consensus_map}
    else:
        result = consensus_map

    return {"consensus": result}


async def _get_insider_cache() -> list[dict]:
    global _insider_cache
    async with _insider_cache_lock:
        now = time.time()
        if _insider_cache and (now - _insider_cache[0]) < INSIDER_CACHE_TTL:
            return _insider_cache[1]
        # Paginate through FMP to build a rich dataset — done once per TTL
        raw = await fmp_insider_trading(limit=1000)
        # Routine/automatic transaction types that don't signal discretionary intent
        NOISE_TYPES = {"A-Award", "M-Exempt", "F-InKind", "C-Conversion", "G-Gift", "D-Return"}
        trades = [
            {
                "symbol": r.get("symbol"),
                "filing_date": r.get("filingDate"),
                "transaction_date": r.get("transactionDate"),
                "insider_name": r.get("reportingName"),
                "title": r.get("typeOfOwner"),
                "transaction_type": r.get("transactionType"),
                "shares": r.get("securitiesTransacted"),
                "price": r.get("price"),
                "value": _calc_value(r),
            }
            for r in raw
            if r.get("symbol")
            and r.get("formType", "").strip() not in ("3", "3/A")  # Form 3 = initial disclosure, no transaction
            and r.get("transactionType", "") not in NOISE_TYPES    # exclude routine grants/withholding
        ]
        trades.sort(key=lambda t: t["transaction_date"] or t["filing_date"] or "", reverse=True)
        _insider_cache = (now, trades)
        return trades


@router.get("/insider-trades")
async def insider_trades(
    limit: int = Query(200, ge=1, le=500),
):
    try:
        trades = await _get_insider_cache()
    except Exception:
        trades = []
    return {"trades": trades[:limit]}


def _parse_pct(val) -> float | None:
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    try:
        return float(str(val).replace("%", "").strip())
    except (ValueError, AttributeError):
        return None


def _calc_value(r: dict) -> float | None:
    shares = r.get("securitiesTransacted")
    price = r.get("price")
    if shares is not None and price is not None:
        try:
            return abs(float(shares) * float(price))
        except (TypeError, ValueError):
            pass
    return None

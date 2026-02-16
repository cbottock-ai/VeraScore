# VeraScore Change Guidelines

> **Purpose:** How to make common modifications to VeraScore without breaking things.

## Modifying the Scoring System

The scoring system is designed to be changed via configuration, not code. Here's how to make common changes:

### Adjust Metric Weights Within a Factor

**Scenario:** You want P/E ratio to count less in valuation scoring.

**Steps:**
1. Open `/configs/scoring/valuation_v1.yaml`
2. Find the metric entry:
   ```yaml
   - id: pe_ratio
     source: fundamentals.pe_ttm
     scoring_method: percentile_inverse
     weight: 0.25  # ← Change this
   ```
3. Adjust the weight (e.g., `0.15`)
4. Adjust other weights so they sum to `1.0`
5. No code changes needed — scoring engine reads config on each calculation

**Verification:**
```bash
# Recalculate a test stock and verify the factor breakdown
curl "http://localhost:8000/stocks/AAPL/scores?refresh=true"
```

---

### Add a New Metric to a Factor

**Scenario:** You want to add Price-to-Book ratio to valuation scoring.

**Steps:**

1. **Verify the metric exists in the database**
   
   Check `stock_fundamentals` table has the column:
   ```sql
   SELECT pb_ratio FROM stock_fundamentals WHERE ticker = 'AAPL';
   ```
   
   If missing, add it via migration and update the data fetcher.

2. **Add to the YAML config**
   
   Open `/configs/scoring/valuation_v1.yaml`:
   ```yaml
   metrics:
     # ... existing metrics ...
     
     - id: pb_ratio
       source: fundamentals.pb_ratio
       label: "Price to Book"
       description: "Stock price relative to book value per share"
       scoring_method: percentile_inverse  # Lower is better
       percentile_universe: sector
       weight: 0.10
   ```

3. **Rebalance weights**
   
   Ensure all weights sum to `1.0`:
   ```yaml
   - id: pe_ratio
     weight: 0.20  # Reduced from 0.25
   - id: ps_ratio
     weight: 0.20
   - id: peg_ratio
     weight: 0.20
   - id: fcf_yield
     weight: 0.15
   - id: ev_ebitda
     weight: 0.15
   - id: pb_ratio
     weight: 0.10  # New metric
   # Total: 1.0 ✓
   ```

4. **Update explanation template** (optional)
   
   If you want the new metric mentioned in explanations, update the template.

**No code changes required.**

---

### Change Factor Weights in Composite Score

**Scenario:** You want momentum to matter less in the overall score.

**Steps:**

1. **Option A: Edit the default profile** (affects all users)
   
   In database, update `scoring_profile_factors`:
   ```sql
   UPDATE scoring_profile_factors
   SET weight = 0.10
   WHERE profile_id = (SELECT id FROM scoring_profiles WHERE is_default = true)
     AND config_id = (SELECT id FROM scoring_configs WHERE factor = 'momentum' AND is_default = true);
   ```

2. **Option B: Edit YAML default weight** (for new calculations)
   
   In `/configs/scoring/momentum_v1.yaml`:
   ```yaml
   default_weight: 0.10  # Changed from 0.15
   ```

3. **Rebalance other factors** to sum to `1.0`

---

### Add a New Scoring Method

**Scenario:** You need a "z-score" scoring method not currently supported.

**Steps:**

1. **Implement the method**
   
   Create `/packages/scoring-engine/src/methods/zscore.py`:
   ```python
   def score_zscore(
       value: float,
       mean: float,
       std_dev: float,
       bounds: tuple[float, float] = (-3, 3)
   ) -> float:
       """
       Score based on standard deviations from mean.
       Maps z-score to 0-100 scale.
       """
       z = (value - mean) / std_dev if std_dev > 0 else 0
       z_clamped = max(bounds[0], min(bounds[1], z))
       
       # Map [-3, 3] to [0, 100]
       score = ((z_clamped - bounds[0]) / (bounds[1] - bounds[0])) * 100
       return round(score, 2)
   ```

2. **Register in calculator**
   
   In `/packages/scoring-engine/src/engine/calculator.py`:
   ```python
   from ..methods.zscore import score_zscore
   
   SCORING_METHODS = {
       'percentile': score_percentile,
       'percentile_inverse': score_percentile_inverse,
       'threshold': score_threshold,
       'linear': score_linear,
       'zscore': score_zscore,  # Add new method
   }
   ```

3. **Use in config**
   
   ```yaml
   - id: earnings_surprise
     source: fundamentals.earnings_surprise_pct
     scoring_method: zscore
     zscore_params:
       universe: market  # Calculate mean/std from market
     weight: 0.15
   ```

---

### Create a New Scoring Factor

**Scenario:** You want to add a "Dividend" factor for income-focused scoring.

**Steps:**

1. **Create config file**
   
   Create `/configs/scoring/dividend_v1.yaml`:
   ```yaml
   factor: dividend
   version: 1
   name: "Dividend Quality"
   description: "Evaluates dividend yield, growth, and sustainability"
   default_weight: 0.00  # Start at 0, let users opt-in
   
   metrics:
     - id: dividend_yield
       source: fundamentals.dividend_yield
       label: "Dividend Yield"
       scoring_method: percentile
       percentile_universe: market
       weight: 0.35
       
     - id: dividend_growth_5y
       source: fundamentals.dividend_growth_5y
       label: "5-Year Dividend Growth"
       scoring_method: percentile
       percentile_universe: market
       weight: 0.30
       
     - id: payout_ratio
       source: fundamentals.payout_ratio
       label: "Payout Ratio"
       scoring_method: threshold
       thresholds:
         - max: 0.30
           score: 100
         - max: 0.50
           score: 85
         - max: 0.70
           score: 70
         - max: 0.90
           score: 50
         - default: 30
       weight: 0.35
   
   explanation_template: |
     Dividend Score: {score}/100
     ...
   ```

2. **Add to database**
   
   Run migration to insert new config:
   ```sql
   INSERT INTO scoring_configs (factor, name, version, is_system, config)
   VALUES ('dividend', 'Dividend Quality', 1, true, '{ ... }');
   ```

3. **Optionally add to default profile**
   
   If you want it in composite scores by default:
   ```sql
   INSERT INTO scoring_profile_factors (profile_id, config_id, weight)
   SELECT 
     (SELECT id FROM scoring_profiles WHERE is_default = true),
     (SELECT id FROM scoring_configs WHERE factor = 'dividend' AND is_default = true),
     0.10;
   ```
   
   Remember to rebalance other weights!

4. **Update frontend**
   
   Add display for new factor in stock detail page.

---

## Adding New Features

### Add a New API Endpoint

**Example:** Add endpoint to get score history for a stock.

1. **Define the response model**
   
   In `/apps/api/src/scoring/models.py`:
   ```python
   class ScoreHistoryPoint(BaseModel):
       date: date
       overall_score: float
       growth_score: float | None
       profitability_score: float | None
       valuation_score: float | None
       momentum_score: float | None
       quality_score: float | None
   
   class ScoreHistoryResponse(BaseModel):
       ticker: str
       history: list[ScoreHistoryPoint]
   ```

2. **Implement the service function**
   
   In `/apps/api/src/scoring/service.py`:
   ```python
   async def get_score_history(
       ticker: str,
       days: int = 90
   ) -> list[ScoreHistoryPoint]:
       query = """
           SELECT recorded_at, overall_score, growth_score, 
                  profitability_score, valuation_score, 
                  momentum_score, quality_score
           FROM stock_score_history
           WHERE ticker = $1 
             AND recorded_at > NOW() - INTERVAL '%s days'
           ORDER BY recorded_at DESC
       """
       rows = await db.fetch_all(query, ticker, days)
       return [ScoreHistoryPoint(**row) for row in rows]
   ```

3. **Create the route**
   
   In `/apps/api/src/scoring/routes.py`:
   ```python
   @router.get(
       "/stocks/{ticker}/scores/history",
       response_model=ScoreHistoryResponse
   )
   async def get_stock_score_history(
       ticker: str,
       days: int = Query(default=90, le=365)
   ):
       history = await scoring_service.get_score_history(ticker, days)
       return ScoreHistoryResponse(ticker=ticker, history=history)
   ```

4. **Add frontend service function**
   
   In `/apps/web/src/services/stockService.ts`:
   ```typescript
   export async function fetchScoreHistory(
     ticker: string,
     days: number = 90
   ): Promise<ScoreHistoryResponse> {
     const response = await api.get(`/stocks/${ticker}/scores/history`, {
       params: { days },
     });
     return response.data;
   }
   ```

5. **Create React hook** (optional)
   
   In `/apps/web/src/hooks/useScoreHistory.ts`:
   ```typescript
   export function useScoreHistory(ticker: string, days = 90) {
     return useQuery({
       queryKey: ['scoreHistory', ticker, days],
       queryFn: () => fetchScoreHistory(ticker, days),
       staleTime: 60 * 60 * 1000, // 1 hour
     });
   }
   ```

---

### Add a New Chat Agent Capability

**Example:** Add ability for Portfolio Advisor to suggest tax-loss harvesting.

1. **Add tool function**
   
   In `/apps/api/src/chat/agents/portfolio.py`:
   ```python
   async def find_tax_loss_harvesting_opportunities(
       holdings: list[Holding],
       min_loss: float = 500
   ) -> list[TaxLossOpportunity]:
       """
       Find holdings with unrealized losses that could be harvested.
       """
       opportunities = []
       
       for holding in holdings:
           current_value = holding.shares * await get_current_price(holding.ticker)
           unrealized_gain = current_value - holding.cost_basis
           
           if unrealized_gain < -min_loss:
               holding_period = (date.today() - holding.purchase_date).days
               is_long_term = holding_period >= 365
               
               opportunities.append(TaxLossOpportunity(
                   ticker=holding.ticker,
                   shares=holding.shares,
                   cost_basis=holding.cost_basis,
                   current_value=current_value,
                   unrealized_loss=abs(unrealized_gain),
                   is_long_term=is_long_term,
                   holding_period_days=holding_period,
               ))
       
       return sorted(opportunities, key=lambda x: x.unrealized_loss, reverse=True)
   ```

2. **Update agent prompt**
   
   In `/configs/agents/portfolio_advisor.yaml`, add to tools section:
   ```yaml
   tools:
     - name: find_tax_loss_harvesting
       description: "Find holdings with losses that could be harvested for tax benefits"
       when_to_use: "User asks about tax optimization, loss harvesting, or reducing tax burden"
   ```

3. **Add routing pattern**
   
   In `/apps/api/src/chat/orchestrator.py`:
   ```python
   ROUTING_RULES["tax_optimization"] = {
       "patterns": [
           "tax loss",
           "harvest",
           "tax optimization",
           "reduce taxes",
           "offset gains",
       ],
       "agents": ["portfolio_advisor"],
   }
   ```

4. **Test the capability**
   
   ```
   User: "Are there any tax-loss harvesting opportunities in my portfolio?"
   
   Expected: Portfolio Advisor identifies holdings with losses, 
   considers short-term vs long-term, and provides specific recommendations.
   ```

---

### Add a New Data Source

**Example:** Add Financial Modeling Prep as a backup data source.

1. **Create provider client**
   
   In `/packages/data-provider/src/providers/fmp.py`:
   ```python
   class FMPClient:
       BASE_URL = "https://financialmodelingprep.com/api/v3"
       
       def __init__(self, api_key: str):
           self.api_key = api_key
           self.client = httpx.AsyncClient()
       
       async def get_company_profile(self, ticker: str) -> CompanyProfile:
           url = f"{self.BASE_URL}/profile/{ticker}"
           response = await self.client.get(url, params={"apikey": self.api_key})
           response.raise_for_status()
           data = response.json()[0]
           return CompanyProfile(
               ticker=data["symbol"],
               name=data["companyName"],
               sector=data["sector"],
               industry=data["industry"],
               market_cap=data["mktCap"],
           )
       
       async def get_key_metrics(self, ticker: str) -> KeyMetrics:
           # ... implementation
   ```

2. **Add to data fetcher with fallback**
   
   In `/packages/data-provider/src/fetcher.py`:
   ```python
   class DataFetcher:
       def __init__(self):
           self.primary = AlphaVantageClient(settings.ALPHA_VANTAGE_API_KEY)
           self.backup = FMPClient(settings.FMP_API_KEY) if settings.FMP_API_KEY else None
       
       async def get_fundamentals(self, ticker: str) -> Fundamentals:
           try:
               return await self.primary.get_fundamentals(ticker)
           except RateLimitError:
               if self.backup:
                   logger.warning(f"Primary rate limited, using backup for {ticker}")
                   return await self.backup.get_fundamentals(ticker)
               raise
   ```

3. **Add environment variable**
   
   In `.env.example`:
   ```bash
   FMP_API_KEY=your_key_here  # Optional backup data source
   ```

---

## Database Changes

### Add a New Column

1. **Create migration**
   
   Create `/apps/api/migrations/009_add_dividend_yield.sql`:
   ```sql
   -- Add dividend yield to fundamentals
   ALTER TABLE stock_fundamentals 
   ADD COLUMN dividend_yield DECIMAL(8, 4);
   
   -- Add index if frequently queried
   CREATE INDEX idx_fundamentals_dividend_yield 
   ON stock_fundamentals(dividend_yield);
   ```

2. **Update models**
   
   In `/apps/api/src/stocks/schemas.py`:
   ```python
   class StockFundamentals(Base):
       # ... existing columns
       dividend_yield: Mapped[Decimal | None]
   ```

3. **Update data fetcher**
   
   Ensure the new field is populated when fetching data.

4. **Run migration**
   
   ```bash
   alembic upgrade head
   ```

### Add a New Table

Follow the pattern in `docs/DATA_MODEL.md` and create a numbered migration file.

---

## Checklist for Changes

Before submitting any change:

- [ ] Does it follow the coding standards in `CODING_STANDARDS.md`?
- [ ] Are there tests for new functionality?
- [ ] Is documentation updated if needed?
- [ ] For scoring changes: Do weights sum to 1.0?
- [ ] For API changes: Are Pydantic models defined?
- [ ] For frontend changes: Are TypeScript types updated?
- [ ] For database changes: Is there a migration file?

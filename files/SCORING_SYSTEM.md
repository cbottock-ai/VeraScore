# VeraScore Scoring System

## Overview

The scoring system is **configuration-driven** — all factor calculations are defined in YAML configuration files, not hardcoded logic. This enables:

1. Easy adjustment of weights and metrics without code changes
2. A/B testing different scoring methodologies
3. Future user-customizable scoring profiles
4. Clear audit trail of scoring logic changes

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      SCORING ENGINE                              │
│                                                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │   Config    │───▶│   Metric    │───▶│     Calculator      │  │
│  │   Loader    │    │   Fetcher   │    │  (percentile/etc)   │  │
│  └─────────────┘    └─────────────┘    └─────────────────────┘  │
│         │                                        │               │
│         ▼                                        ▼               │
│  ┌─────────────┐                        ┌─────────────────────┐  │
│  │    YAML     │                        │     Composite       │  │
│  │   Configs   │                        │    Calculator       │  │
│  └─────────────┘                        └─────────────────────┘  │
│                                                  │               │
│                                                  ▼               │
│                                         ┌─────────────────────┐  │
│                                         │     Explainer       │  │
│                                         │  (Score → Text)     │  │
│                                         └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Scoring Factors

The system calculates six factor scores, each weighted to produce a composite overall score:

| Factor | Default Weight | What It Measures |
|--------|---------------|------------------|
| **Growth** | 18% | Revenue and earnings growth trends |
| **Profitability** | 18% | Margins, returns on capital |
| **Valuation** | 22% | Price relative to fundamentals |
| **Momentum** | 12% | Price trends and relative strength |
| **Quality** | 18% | Balance sheet health, earnings quality |
| **Sentiment** | 12% | Analyst targets and institutional flows |

## Scoring Methods

Each metric within a factor is scored using one of these methods:

### 1. Percentile (Higher is Better)
Ranks the stock against a comparison universe (sector or market).
- Score = percentile rank (0-100)
- Example: If revenue growth is higher than 75% of sector peers, score = 75

### 2. Percentile Inverse (Lower is Better)
Same as percentile, but inverted for metrics where lower values are better.
- Score = 100 - percentile rank
- Example: If P/E is lower than 80% of sector peers (good), score = 80

### 3. Threshold
Step-function scoring based on defined ranges.
- Useful for metrics with established "good" and "bad" ranges
- Example: PEG < 1.0 = 100, PEG 1.0-1.5 = 80, PEG 1.5-2.0 = 60, etc.

### 4. Linear
Linear interpolation between defined bounds.
- Useful for continuous metrics with clear min/max
- Example: Gross margin 0% = 0, 50%+ = 100, linearly scaled between

## Configuration Schema

Each factor has a YAML configuration file:

```yaml
# /configs/scoring/growth_v1.yaml

factor: growth
version: 1
name: "Default Growth Scoring"
description: "Evaluates revenue and earnings growth trends"

# Weight in composite score (can be overridden by profile)
default_weight: 0.20

metrics:
  - id: revenue_growth_3y
    source: fundamentals.revenue_growth_3y_cagr
    label: "3-Year Revenue CAGR"
    description: "Compound annual revenue growth over 3 years"
    scoring_method: percentile
    percentile_universe: sector  # 'sector', 'industry', or 'market'
    weight: 0.30
    bounds:
      min: -0.50  # Cap extreme negatives
      max: 1.00   # Cap extreme positives
    
  - id: eps_growth_3y
    source: fundamentals.eps_growth_3y_cagr
    label: "3-Year EPS CAGR"
    description: "Compound annual EPS growth over 3 years"
    scoring_method: percentile
    percentile_universe: sector
    weight: 0.25
    
  - id: revenue_growth_yoy
    source: fundamentals.revenue_growth_yoy
    label: "YoY Revenue Growth"
    description: "Most recent year-over-year revenue growth"
    scoring_method: percentile
    percentile_universe: sector
    weight: 0.25
    
  - id: eps_growth_yoy
    source: fundamentals.eps_growth_yoy
    label: "YoY EPS Growth"
    description: "Most recent year-over-year EPS growth"
    scoring_method: percentile
    percentile_universe: sector
    weight: 0.20

# Template for generating explanations
explanation_template: |
  Growth Score: {score}/100
  
  {if score >= 80}Strong growth profile. {endif}
  {if score >= 60 and score < 80}Solid growth metrics. {endif}
  {if score < 60}Growth metrics lag peers. {endif}
  
  Key drivers:
  - {top_contributor.label}: {top_contributor.raw_value_formatted} ({top_contributor.percentile}th percentile in {top_contributor.universe})
  - {second_contributor.label}: {second_contributor.raw_value_formatted} ({second_contributor.percentile}th percentile)
  
  {if bottom_contributor.score < 50}
  Area of concern: {bottom_contributor.label} at {bottom_contributor.raw_value_formatted} trails {100 - bottom_contributor.percentile}% of {bottom_contributor.universe} peers.
  {endif}
```

## Complete Factor Configurations

### Growth Factor

```yaml
# /configs/scoring/growth_v1.yaml
factor: growth
version: 1
default_weight: 0.20

metrics:
  - id: revenue_growth_3y
    source: fundamentals.revenue_growth_3y_cagr
    label: "3-Year Revenue CAGR"
    scoring_method: percentile
    percentile_universe: sector
    weight: 0.30
    
  - id: eps_growth_3y
    source: fundamentals.eps_growth_3y_cagr
    label: "3-Year EPS CAGR"
    scoring_method: percentile
    percentile_universe: sector
    weight: 0.25
    
  - id: revenue_growth_yoy
    source: fundamentals.revenue_growth_yoy
    label: "YoY Revenue Growth"
    scoring_method: percentile
    percentile_universe: sector
    weight: 0.25
    
  - id: eps_growth_yoy
    source: fundamentals.eps_growth_yoy
    label: "YoY EPS Growth"
    scoring_method: percentile
    percentile_universe: sector
    weight: 0.20
```

### Profitability Factor

```yaml
# /configs/scoring/profitability_v1.yaml
factor: profitability
version: 1
default_weight: 0.20

metrics:
  - id: gross_margin
    source: fundamentals.gross_margin
    label: "Gross Margin"
    scoring_method: percentile
    percentile_universe: industry
    weight: 0.20
    
  - id: operating_margin
    source: fundamentals.operating_margin
    label: "Operating Margin"
    scoring_method: percentile
    percentile_universe: industry
    weight: 0.20
    
  - id: net_margin
    source: fundamentals.net_margin
    label: "Net Margin"
    scoring_method: percentile
    percentile_universe: industry
    weight: 0.15
    
  - id: roe
    source: fundamentals.roe
    label: "Return on Equity"
    scoring_method: percentile
    percentile_universe: sector
    weight: 0.20
    bounds:
      min: -0.50
      max: 1.00
    
  - id: roic
    source: fundamentals.roic
    label: "Return on Invested Capital"
    scoring_method: percentile
    percentile_universe: sector
    weight: 0.25
    bounds:
      min: -0.30
      max: 0.50
```

### Valuation Factor

```yaml
# /configs/scoring/valuation_v1.yaml
factor: valuation
version: 1
default_weight: 0.25

metrics:
  - id: pe_ratio
    source: fundamentals.pe_ttm
    label: "P/E Ratio (TTM)"
    scoring_method: percentile_inverse  # Lower is better
    percentile_universe: sector
    weight: 0.25
    bounds:
      min: 0
      max: 100  # Cap extreme P/Es
    
  - id: ps_ratio
    source: fundamentals.ps_ttm
    label: "P/S Ratio (TTM)"
    scoring_method: percentile_inverse
    percentile_universe: sector
    weight: 0.20
    
  - id: peg_ratio
    source: fundamentals.peg_ratio
    label: "PEG Ratio"
    scoring_method: threshold
    thresholds:
      - max: 1.0
        score: 100
      - max: 1.5
        score: 80
      - max: 2.0
        score: 60
      - max: 3.0
        score: 40
      - default: 20
    weight: 0.20
    
  - id: fcf_yield
    source: fundamentals.fcf_yield
    label: "FCF Yield"
    scoring_method: percentile  # Higher is better
    percentile_universe: market
    weight: 0.20
    
  - id: ev_ebitda
    source: fundamentals.ev_to_ebitda
    label: "EV/EBITDA"
    scoring_method: percentile_inverse
    percentile_universe: sector
    weight: 0.15
```

### Momentum Factor

```yaml
# /configs/scoring/momentum_v1.yaml
factor: momentum
version: 1
default_weight: 0.15

metrics:
  - id: price_change_6m
    source: fundamentals.price_change_6m
    label: "6-Month Price Change"
    scoring_method: percentile
    percentile_universe: market
    weight: 0.30
    
  - id: price_change_1y
    source: fundamentals.price_change_1y
    label: "12-Month Price Change"
    scoring_method: percentile
    percentile_universe: market
    weight: 0.30
    
  - id: relative_strength
    source: fundamentals.relative_strength
    label: "Relative Strength (vs S&P 500)"
    scoring_method: percentile
    percentile_universe: market
    weight: 0.25
    
  - id: price_vs_52w_high
    source: calculated.price_vs_52w_high
    label: "Price vs 52-Week High"
    scoring_method: linear
    linear_bounds:
      input_min: 0.50   # 50% of 52w high
      input_max: 1.00   # At 52w high
      output_min: 0
      output_max: 100
    weight: 0.15
```

### Quality Factor

```yaml
# /configs/scoring/quality_v1.yaml
factor: quality
version: 1
default_weight: 0.18

metrics:
  - id: current_ratio
    source: fundamentals.current_ratio
    label: "Current Ratio"
    scoring_method: threshold
    thresholds:
      - min: 2.0
        score: 100
      - min: 1.5
        score: 80
      - min: 1.0
        score: 60
      - min: 0.5
        score: 30
      - default: 10
    weight: 0.20
    
  - id: debt_to_equity
    source: fundamentals.debt_to_equity
    label: "Debt to Equity"
    scoring_method: threshold
    thresholds:
      - max: 0.3
        score: 100
      - max: 0.5
        score: 85
      - max: 1.0
        score: 70
      - max: 2.0
        score: 50
      - default: 25
    weight: 0.25
    
  - id: interest_coverage
    source: fundamentals.interest_coverage
    label: "Interest Coverage"
    scoring_method: threshold
    thresholds:
      - min: 10.0
        score: 100
      - min: 5.0
        score: 80
      - min: 3.0
        score: 60
      - min: 1.5
        score: 40
      - default: 20
    weight: 0.25
    
  - id: earnings_quality
    source: calculated.accruals_ratio
    label: "Earnings Quality (Accruals)"
    scoring_method: percentile_inverse  # Lower accruals = higher quality
    percentile_universe: market
    weight: 0.30
```

### Sentiment Factor (Analyst & Institutional)

```yaml
# /configs/scoring/sentiment_v1.yaml
factor: sentiment
version: 1
name: "Analyst & Institutional Sentiment"
description: "Evaluates Wall Street analyst targets and institutional money flows"
default_weight: 0.12

metrics:
  # Analyst Target Metrics
  - id: analyst_upside
    source: analyst_targets.upside_potential
    label: "Analyst Upside Potential"
    description: "% difference between mean analyst target and current price"
    scoring_method: linear
    linear_bounds:
      input_min: -0.20   # 20% downside
      input_max: 0.40    # 40% upside
      output_min: 0
      output_max: 100
    weight: 0.25
    
  - id: analyst_consensus
    source: analyst_targets.consensus_rating
    label: "Analyst Consensus Rating"
    description: "Weighted average of analyst ratings"
    scoring_method: threshold
    thresholds:
      - value: "Strong Buy"
        score: 100
      - value: "Buy"
        score: 80
      - value: "Hold"
        score: 50
      - value: "Sell"
        score: 25
      - value: "Strong Sell"
        score: 0
    weight: 0.15
    
  - id: analyst_coverage
    source: analyst_targets.total_analysts
    label: "Analyst Coverage"
    description: "Number of analysts covering the stock"
    scoring_method: threshold
    thresholds:
      - min: 25
        score: 100
      - min: 15
        score: 85
      - min: 10
        score: 70
      - min: 5
        score: 50
      - default: 30
    weight: 0.10
    
  # Institutional Flow Metrics
  - id: institutional_ownership
    source: institutional_ownership.institutional_ownership_pct
    label: "Institutional Ownership %"
    description: "Percentage of shares held by institutions"
    scoring_method: linear
    linear_bounds:
      input_min: 0.10   # 10% ownership
      input_max: 0.80   # 80% ownership
      output_min: 30
      output_max: 100
    weight: 0.15
    
  - id: institutional_flow
    source: institutional_ownership.net_institutional_flow
    label: "Institutional Flow Signal"
    description: "Net buying/selling by institutions"
    scoring_method: threshold
    thresholds:
      - value: "Strong Buying"
        score: 100
      - value: "Buying"
        score: 75
      - value: "Neutral"
        score: 50
      - value: "Selling"
        score: 25
      - value: "Strong Selling"
        score: 0
    weight: 0.20
    
  - id: institutional_holders_change
    source: institutional_ownership.holders_change_qoq
    label: "Net New Institutional Holders"
    description: "Change in number of institutional holders quarter-over-quarter"
    scoring_method: percentile
    percentile_universe: market
    weight: 0.15

explanation_template: |
  Sentiment Score: {score}/100
  
  **Analyst View:**
  {if analyst_upside.raw_value > 0}
  Analysts see {analyst_upside.raw_value_pct}% upside with a mean target of ${analyst_targets.target_mean}.
  {else}
  Analysts see {analyst_upside.raw_value_pct}% downside risk.
  {endif}
  Consensus rating: {analyst_consensus.raw_value} from {analyst_coverage.raw_value} analysts.
  
  **Institutional Activity:**
  {institutional_ownership.raw_value_pct}% institutional ownership.
  {if institutional_flow.raw_value == "Strong Buying" or institutional_flow.raw_value == "Buying"}
  Institutions are net buyers this quarter.
  {endif}
  {if institutional_flow.raw_value == "Selling" or institutional_flow.raw_value == "Strong Selling"}
  Institutions are reducing positions this quarter.
  {endif}
```

## Composite Score Calculation

```python
def calculate_composite_score(ticker: str, profile_id: str = None) -> CompositeScore:
    """
    Calculate overall score from weighted factor scores.
    """
    profile = load_profile(profile_id) or get_default_profile()
    
    factor_scores = {}
    factor_explanations = {}
    
    for factor_config in profile.factors:
        result = calculate_factor_score(ticker, factor_config)
        factor_scores[factor_config.factor] = result.score
        factor_explanations[factor_config.factor] = result.explanation
    
    # Weighted average
    overall_score = sum(
        factor_scores[f.factor] * f.weight 
        for f in profile.factors
    )
    
    return CompositeScore(
        overall_score=round(overall_score, 1),
        factor_scores=factor_scores,
        explanations=factor_explanations,
        profile_used=profile.name
    )
```

## Modifying Scoring Logic

### To adjust metric weights:
1. Open the relevant YAML config (e.g., `/configs/scoring/valuation_v1.yaml`)
2. Change the `weight` value for the metric
3. Ensure weights still sum to 1.0 within the factor
4. No code changes required

### To add a new metric:
1. Ensure the metric is available in `stock_fundamentals` table
2. Add a new entry to the `metrics` array in the YAML config
3. Specify: id, source, label, scoring_method, weight
4. Adjust other weights to maintain sum of 1.0

### To change factor weights in composite:
1. Modify the scoring profile in the database
2. Or create a new profile with different weights
3. Weights should sum to 1.0

### To add a new scoring method:
1. Implement the method in `/packages/scoring-engine/src/methods/`
2. Register it in the calculator's method registry
3. Reference it by name in YAML configs

## Explanation Generation

Each factor config includes an `explanation_template` that generates human-readable explanations:

```python
def generate_explanation(config: FactorConfig, result: FactorResult) -> str:
    """
    Generate human-readable explanation from score components.
    """
    # Sort components by contribution
    sorted_components = sorted(
        result.components, 
        key=lambda c: c.contribution, 
        reverse=True
    )
    
    context = {
        'score': result.score,
        'top_contributor': sorted_components[0],
        'second_contributor': sorted_components[1],
        'bottom_contributor': sorted_components[-1],
        'components': sorted_components,
    }
    
    return render_template(config.explanation_template, context)
```

Example output:
```
Growth Score: 78/100

Strong growth profile.

Key drivers:
- 3-Year Revenue CAGR: 24.3% (82nd percentile in Technology sector)
- YoY Revenue Growth: 18.7% (75th percentile)

Area of concern: YoY EPS Growth at 8.2% trails 45% of Technology peers.
```

## Score Caching Strategy

- **Factor scores**: Cached for 4 hours
- **Composite scores**: Cached for 4 hours
- **Invalidation**: On fundamental data refresh
- **Cache key**: `score:{ticker}:{profile_id}:{factor}`

## Testing Scoring Changes

Before deploying scoring changes:

1. **Backtest**: Compare new scores vs old for a sample of stocks
2. **Distribution check**: Ensure scores remain well-distributed (not all clustered)
3. **Sanity check**: Verify known "good" and "bad" stocks score appropriately
4. **Explanation review**: Ensure explanations make sense with new logic

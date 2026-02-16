# VeraScore Data Model

## Overview

The database schema is designed around these core domains:
1. **Users & Preferences** — Account data and personalization settings
2. **Portfolios & Holdings** — User positions with tax lot tracking
3. **Scoring & Configuration** — Stock scores and configurable scoring rules
4. **Analyst & Institutional Data** — Wall Street targets and smart money flows
5. **Guardrails** — User-defined portfolio rules and constraints
6. **Macro Factors** — Sensitivity data for macro analysis
7. **Conversations** — Chat history with citations

All tables use UUIDs for primary keys and include standard audit columns.

## Entity Relationship Diagram

```
┌─────────────┐       ┌──────────────────┐       ┌─────────────────┐
│    users    │───┐   │    portfolios    │───┐   │    holdings     │
├─────────────┤   │   ├──────────────────┤   │   ├─────────────────┤
│ id (PK)     │   └──▶│ id (PK)          │   └──▶│ id (PK)         │
│ email       │       │ user_id (FK)     │       │ portfolio_id(FK)│
│ created_at  │       │ name             │       │ ticker          │
└─────────────┘       │ created_at       │       │ shares          │
      │               └──────────────────┘       │ cost_basis      │
      │                                          │ purchase_date   │
      ├──────────────────┐                       └─────────────────┘
      ▼                  ▼                               │
┌──────────────────┐ ┌──────────────────┐               │
│ user_preferences │ │  user_guardrails │               ▼
├──────────────────┤ ├──────────────────┤       ┌─────────────────┐
│ user_id (FK)     │ │ user_id (FK)     │       │     stocks      │
│ risk_tolerance   │ │ rule_type        │       ├─────────────────┤
│ investment_horiz │ │ operator         │       │ ticker (PK)     │
│ tax_bracket      │ │ threshold        │       │ name            │
│ default_persona  │ │ enabled          │       │ sector          │
└──────────────────┘ └──────────────────┘       │ industry        │
                                                └─────────────────┘
┌──────────────────┐       ┌─────────────────┐          │
│ scoring_configs  │──────▶│ scoring_profiles│          │
├──────────────────┤       │ (personas)      │          ▼
│ id (PK)          │       ├─────────────────┤  ┌─────────────────┐
│ factor           │       │ id (PK)         │  │  stock_scores   │
│ name             │       │ name            │  ├─────────────────┤
│ config (JSONB)   │       │ is_default      │  │ ticker (FK)     │
└──────────────────┘       └─────────────────┘  │ overall_score   │
                                                │ growth_score    │
┌──────────────────┐       ┌─────────────────┐  │ valuation_score │
│  conversations   │──────▶│    messages     │  │ sentiment_score │
├──────────────────┤       ├─────────────────┤  │ explanations    │
│ id (PK)          │       │ id (PK)         │  └─────────────────┘
│ user_id (FK)     │       │ conversation_id │          │
│ created_at       │       │ role            │          ▼
└──────────────────┘       │ content         │  ┌─────────────────┐
                           │ citations (JSON)│  │stock_macro_factors│
                           └─────────────────┘  ├─────────────────┤
                                                │ ticker (FK)     │
┌──────────────────┐       ┌─────────────────┐  │ beta            │
│ analyst_targets  │       │ institutional_  │  │ rate_sensitivity│
├──────────────────┤       │ ownership       │  │ inflation_corr  │
│ ticker (FK)      │       ├─────────────────┤  └─────────────────┘
│ target_mean      │       │ ticker (FK)     │
│ consensus_rating │       │ ownership_pct   │
│ total_analysts   │       │ net_flow        │
└──────────────────┘       └─────────────────┘
```

## Complete Schema

### Users & Authentication

```sql
-- Core user table (managed by Supabase Auth, extended here)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User preferences for personalization
CREATE TABLE user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Investment profile
    risk_tolerance VARCHAR(20) DEFAULT 'moderate' 
        CHECK (risk_tolerance IN ('conservative', 'moderate', 'aggressive')),
    investment_horizon VARCHAR(20) DEFAULT 'medium_term'
        CHECK (investment_horizon IN ('short_term', 'medium_term', 'long_term')),
    
    -- Tax information
    tax_bracket VARCHAR(10),  -- e.g., '24%', '32%'
    tax_filing_status VARCHAR(30),  -- 'single', 'married_joint', etc.
    state_of_residence VARCHAR(2),  -- For state tax considerations
    
    -- Display preferences
    -- Default scoring persona
    default_persona_id UUID,  -- References scoring_profiles (personas)
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id)
);

CREATE INDEX idx_user_preferences_user ON user_preferences(user_id);

-- User-defined portfolio guardrails/rules
CREATE TABLE user_guardrails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Rule definition
    rule_type VARCHAR(50) NOT NULL,
    /* Supported rule types:
       - 'max_sector_concentration'   : No sector > X%
       - 'max_single_position'        : No single stock > X%
       - 'min_holdings_count'         : At least X positions
       - 'min_factor_score'           : Factor score must stay > X
       - 'max_factor_score'           : Factor score must stay < X
       - 'max_macro_exposure'         : Macro sensitivity must stay < X
    */
    
    -- Rule parameters
    factor VARCHAR(50),           -- For factor score rules: 'growth', 'valuation', etc.
    macro_factor VARCHAR(50),     -- For macro rules: 'interest_rate', 'inflation', etc.
    operator VARCHAR(10) NOT NULL DEFAULT 'max',  -- 'min', 'max', 'equals'
    threshold DECIMAL(10, 4) NOT NULL,
    
    -- Status
    enabled BOOLEAN DEFAULT TRUE,
    
    -- Metadata
    name VARCHAR(100),            -- User-friendly name: "Tech concentration limit"
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_guardrails_user ON user_guardrails(user_id);
CREATE INDEX idx_guardrails_enabled ON user_guardrails(user_id, enabled);
```

### Portfolios & Holdings

```sql
-- User portfolios (a user can have multiple)
CREATE TABLE portfolios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL DEFAULT 'My Portfolio',
    description TEXT,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_portfolios_user ON portfolios(user_id);

-- Individual holdings with tax lot tracking
CREATE TABLE holdings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    
    -- Position details
    ticker VARCHAR(10) NOT NULL,
    shares DECIMAL(15, 6) NOT NULL CHECK (shares > 0),
    
    -- Tax lot information
    cost_basis DECIMAL(15, 2) NOT NULL,  -- Total cost basis for this lot
    purchase_date DATE NOT NULL,
    
    -- Computed fields (can be derived but cached for performance)
    cost_per_share DECIMAL(15, 4) GENERATED ALWAYS AS (cost_basis / shares) STORED,
    
    -- Metadata
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_holdings_portfolio ON holdings(portfolio_id);
CREATE INDEX idx_holdings_ticker ON holdings(ticker);

-- Portfolio-level cached metrics (updated on holding changes)
CREATE TABLE portfolio_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    
    -- Aggregate scores (weighted by position size)
    overall_score DECIMAL(5, 2),
    growth_score DECIMAL(5, 2),
    profitability_score DECIMAL(5, 2),
    valuation_score DECIMAL(5, 2),
    momentum_score DECIMAL(5, 2),
    quality_score DECIMAL(5, 2),
    
    -- Portfolio stats
    total_value DECIMAL(15, 2),
    total_cost_basis DECIMAL(15, 2),
    total_gain_loss DECIMAL(15, 2),
    total_gain_loss_pct DECIMAL(8, 4),
    
    -- Concentration metrics
    top_holding_pct DECIMAL(5, 2),
    top_5_holdings_pct DECIMAL(5, 2),
    sector_concentration JSONB,  -- { "Technology": 0.45, "Healthcare": 0.20, ... }
    
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(portfolio_id)
);
```

### Stock Data & Scores

```sql
-- Stock master data (cached from API)
CREATE TABLE stocks (
    ticker VARCHAR(10) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    sector VARCHAR(100),
    industry VARCHAR(100),
    market_cap BIGINT,
    exchange VARCHAR(20),
    
    -- Metadata
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Fundamental data cache
CREATE TABLE stock_fundamentals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticker VARCHAR(10) NOT NULL REFERENCES stocks(ticker) ON DELETE CASCADE,
    
    -- Valuation metrics
    pe_ttm DECIMAL(10, 2),
    pe_forward DECIMAL(10, 2),
    ps_ttm DECIMAL(10, 2),
    pb_ratio DECIMAL(10, 2),
    peg_ratio DECIMAL(10, 2),
    ev_to_ebitda DECIMAL(10, 2),
    ev_to_revenue DECIMAL(10, 2),
    fcf_yield DECIMAL(8, 4),
    
    -- Growth metrics
    revenue_growth_yoy DECIMAL(8, 4),
    revenue_growth_3y_cagr DECIMAL(8, 4),
    eps_growth_yoy DECIMAL(8, 4),
    eps_growth_3y_cagr DECIMAL(8, 4),
    
    -- Profitability metrics
    gross_margin DECIMAL(8, 4),
    operating_margin DECIMAL(8, 4),
    net_margin DECIMAL(8, 4),
    roe DECIMAL(8, 4),
    roic DECIMAL(8, 4),
    roa DECIMAL(8, 4),
    
    -- Quality metrics
    current_ratio DECIMAL(8, 2),
    quick_ratio DECIMAL(8, 2),
    debt_to_equity DECIMAL(10, 2),
    interest_coverage DECIMAL(10, 2),
    
    -- Momentum metrics (stored separately but included for reference)
    price_change_1m DECIMAL(8, 4),
    price_change_3m DECIMAL(8, 4),
    price_change_6m DECIMAL(8, 4),
    price_change_1y DECIMAL(8, 4),
    relative_strength DECIMAL(8, 2),
    
    -- Current price data
    current_price DECIMAL(15, 4),
    price_updated_at TIMESTAMP WITH TIME ZONE,
    
    -- Data freshness
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    source VARCHAR(50),  -- 'alpha_vantage', 'fmp', etc.
    
    UNIQUE(ticker)
);

CREATE INDEX idx_fundamentals_ticker ON stock_fundamentals(ticker);
CREATE INDEX idx_fundamentals_sector ON stock_fundamentals(ticker);

-- Macro factor sensitivities for each stock
CREATE TABLE stock_macro_factors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticker VARCHAR(10) NOT NULL REFERENCES stocks(ticker) ON DELETE CASCADE,
    
    -- Market sensitivity
    beta DECIMAL(6, 3),                      -- Market beta (1.0 = moves with market)
    
    -- Interest rate sensitivity
    interest_rate_sensitivity DECIMAL(6, 3), -- Negative = hurt by rate hikes
    duration_proxy DECIMAL(6, 2),            -- For rate-sensitive sectors
    
    -- Inflation sensitivity  
    inflation_correlation DECIMAL(6, 3),     -- Positive = benefits from inflation
    pricing_power_score DECIMAL(5, 2),       -- Ability to pass through costs
    
    -- Commodity exposure
    oil_sensitivity DECIMAL(6, 3),           -- Correlation with oil prices
    commodity_exposure VARCHAR(20),          -- 'high', 'medium', 'low', 'inverse'
    
    -- Currency exposure
    usd_sensitivity DECIMAL(6, 3),           -- Impact of USD strength
    international_revenue_pct DECIMAL(5, 2), -- % revenue from outside US
    
    -- Economic cycle
    cyclicality VARCHAR(20),                 -- 'cyclical', 'defensive', 'mixed'
    recession_sensitivity DECIMAL(6, 3),     -- Performance in recessions
    
    -- Sector-specific factors
    sector_factor_1 VARCHAR(50),             -- e.g., 'semiconductor_cycle'
    sector_factor_1_value DECIMAL(6, 3),
    
    -- Data freshness
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    source VARCHAR(50),
    
    UNIQUE(ticker)
);

CREATE INDEX idx_macro_factors_ticker ON stock_macro_factors(ticker);

-- Historical fundamental data for charting
CREATE TABLE stock_fundamentals_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticker VARCHAR(10) NOT NULL REFERENCES stocks(ticker) ON DELETE CASCADE,
    
    -- Period identification
    period_type VARCHAR(10) NOT NULL CHECK (period_type IN ('quarterly', 'annual')),
    fiscal_year INT NOT NULL,
    fiscal_quarter INT CHECK (fiscal_quarter BETWEEN 1 AND 4),  -- NULL for annual
    period_end_date DATE NOT NULL,
    
    -- Income statement
    revenue BIGINT,
    cost_of_revenue BIGINT,
    gross_profit BIGINT,
    operating_expenses BIGINT,
    operating_income BIGINT,
    net_income BIGINT,
    ebitda BIGINT,
    
    -- Per share
    eps_basic DECIMAL(10, 4),
    eps_diluted DECIMAL(10, 4),
    shares_outstanding BIGINT,
    
    -- Margins (stored for convenience, derived from above)
    gross_margin DECIMAL(8, 4),
    operating_margin DECIMAL(8, 4),
    net_margin DECIMAL(8, 4),
    
    -- Growth rates (vs same period prior year)
    revenue_growth_yoy DECIMAL(8, 4),
    eps_growth_yoy DECIMAL(8, 4),
    
    -- Balance sheet highlights
    total_assets BIGINT,
    total_liabilities BIGINT,
    total_equity BIGINT,
    total_debt BIGINT,
    cash_and_equivalents BIGINT,
    
    -- Cash flow highlights
    operating_cash_flow BIGINT,
    free_cash_flow BIGINT,
    capex BIGINT,
    
    -- Data freshness
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    source VARCHAR(50),
    
    UNIQUE(ticker, period_type, fiscal_year, fiscal_quarter)
);

CREATE INDEX idx_fundamentals_history_ticker ON stock_fundamentals_history(ticker, period_end_date DESC);
CREATE INDEX idx_fundamentals_history_period ON stock_fundamentals_history(ticker, period_type, fiscal_year);

-- Calculated stock scores
CREATE TABLE stock_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticker VARCHAR(10) NOT NULL,
    scoring_profile_id UUID,  -- Which profile was used (NULL = default)
    
    -- Composite score
    overall_score DECIMAL(5, 2) NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
    
    -- Factor scores
    growth_score DECIMAL(5, 2) CHECK (growth_score >= 0 AND growth_score <= 100),
    profitability_score DECIMAL(5, 2) CHECK (profitability_score >= 0 AND profitability_score <= 100),
    valuation_score DECIMAL(5, 2) CHECK (valuation_score >= 0 AND valuation_score <= 100),
    momentum_score DECIMAL(5, 2) CHECK (momentum_score >= 0 AND momentum_score <= 100),
    quality_score DECIMAL(5, 2) CHECK (quality_score >= 0 AND quality_score <= 100),
    
    -- Detailed breakdown for explainability
    score_components JSONB NOT NULL,
    /* Example structure:
    {
      "growth": {
        "score": 75,
        "components": [
          {"metric": "revenue_growth_3y_cagr", "raw_value": 0.24, "score": 85, "percentile": 82, "weight": 0.3},
          {"metric": "eps_growth_3y_cagr", "raw_value": 0.18, "score": 70, "percentile": 68, "weight": 0.3},
          ...
        ]
      },
      ...
    }
    */
    
    -- Pre-generated explanations
    explanations JSONB,
    /* Example structure:
    {
      "overall": "Strong overall score driven by excellent growth metrics...",
      "growth": "Revenue growing 24% annually, outpacing 82% of sector peers...",
      "valuation": "Trading at premium to sector with P/E of 35x vs median 22x...",
      ...
    }
    */
    
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    valid_until TIMESTAMP WITH TIME ZONE,  -- Cache expiry
    
    UNIQUE(ticker, scoring_profile_id)
);

CREATE INDEX idx_scores_ticker ON stock_scores(ticker);
CREATE INDEX idx_scores_calculated ON stock_scores(calculated_at DESC);

-- Historical scores for tracking changes
CREATE TABLE stock_score_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticker VARCHAR(10) NOT NULL,
    overall_score DECIMAL(5, 2) NOT NULL,
    growth_score DECIMAL(5, 2),
    profitability_score DECIMAL(5, 2),
    valuation_score DECIMAL(5, 2),
    momentum_score DECIMAL(5, 2),
    quality_score DECIMAL(5, 2),
    recorded_at DATE NOT NULL,
    
    UNIQUE(ticker, recorded_at)
);

CREATE INDEX idx_score_history_ticker ON stock_score_history(ticker, recorded_at DESC);

-- Analyst price targets
CREATE TABLE analyst_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticker VARCHAR(10) NOT NULL,
    
    -- Consensus data
    target_high DECIMAL(15, 2),
    target_low DECIMAL(15, 2),
    target_mean DECIMAL(15, 2),
    target_median DECIMAL(15, 2),
    
    -- Analyst counts by rating
    strong_buy_count INT DEFAULT 0,
    buy_count INT DEFAULT 0,
    hold_count INT DEFAULT 0,
    sell_count INT DEFAULT 0,
    strong_sell_count INT DEFAULT 0,
    total_analysts INT DEFAULT 0,
    
    -- Derived metrics (can be calculated but cached for convenience)
    consensus_rating VARCHAR(20),  -- 'Strong Buy', 'Buy', 'Hold', 'Sell', 'Strong Sell'
    upside_potential DECIMAL(8, 4),  -- (target_mean - current_price) / current_price
    
    -- Data freshness
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    source VARCHAR(50),  -- 'alpha_vantage', 'fmp', etc.
    
    UNIQUE(ticker)
);

CREATE INDEX idx_analyst_targets_ticker ON analyst_targets(ticker);

-- Individual analyst ratings (optional, for detailed view)
CREATE TABLE analyst_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticker VARCHAR(10) NOT NULL,
    
    analyst_name VARCHAR(255),
    firm_name VARCHAR(255),
    rating VARCHAR(50),  -- 'Buy', 'Hold', 'Sell', etc.
    price_target DECIMAL(15, 2),
    
    -- Rating changes
    previous_rating VARCHAR(50),
    previous_target DECIMAL(15, 2),
    
    rating_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_analyst_ratings_ticker ON analyst_ratings(ticker, rating_date DESC);

-- Institutional ownership summary
CREATE TABLE institutional_ownership (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticker VARCHAR(10) NOT NULL,
    
    -- Ownership totals
    institutional_ownership_pct DECIMAL(8, 4),  -- % of shares held by institutions
    institutional_holders_count INT,
    shares_held_by_institutions BIGINT,
    
    -- Change metrics
    shares_change_qoq BIGINT,  -- Quarter-over-quarter change
    shares_change_pct_qoq DECIMAL(8, 4),
    holders_change_qoq INT,  -- Net new holders vs exited
    
    -- Derived signals
    net_institutional_flow VARCHAR(20),  -- 'Strong Buying', 'Buying', 'Neutral', 'Selling', 'Strong Selling'
    
    -- Data freshness
    reporting_period DATE,  -- Quarter end date (from 13F filings)
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    source VARCHAR(50),
    
    UNIQUE(ticker)
);

CREATE INDEX idx_institutional_ownership_ticker ON institutional_ownership(ticker);

-- Individual institutional holder positions (top holders)
CREATE TABLE institutional_holders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticker VARCHAR(10) NOT NULL,
    
    holder_name VARCHAR(255) NOT NULL,
    holder_type VARCHAR(50),  -- 'Hedge Fund', 'Mutual Fund', 'ETF', 'Pension', 'Insurance', etc.
    
    -- Current position
    shares_held BIGINT NOT NULL,
    market_value DECIMAL(18, 2),
    portfolio_weight DECIMAL(8, 4),  -- % of holder's portfolio
    ownership_pct DECIMAL(8, 6),  -- % of company they own
    
    -- Changes
    shares_change BIGINT,  -- vs previous quarter
    shares_change_pct DECIMAL(8, 4),
    change_type VARCHAR(20),  -- 'New Position', 'Added', 'Reduced', 'Sold Out', 'No Change'
    
    -- Filing info
    reporting_period DATE,
    filing_date DATE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_institutional_holders_ticker ON institutional_holders(ticker);
CREATE INDEX idx_institutional_holders_holder ON institutional_holders(holder_name);

-- Institutional transaction history (buys/sells over time)
CREATE TABLE institutional_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticker VARCHAR(10) NOT NULL,
    
    holder_name VARCHAR(255) NOT NULL,
    holder_type VARCHAR(50),
    
    transaction_type VARCHAR(20) NOT NULL,  -- 'Buy', 'Sell', 'New Position', 'Sold Out'
    shares_transacted BIGINT NOT NULL,
    transaction_value DECIMAL(18, 2),
    
    -- Position after transaction
    shares_after BIGINT,
    
    reporting_period DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_institutional_transactions_ticker ON institutional_transactions(ticker, reporting_period DESC);
CREATE INDEX idx_institutional_transactions_type ON institutional_transactions(transaction_type);
```

### Earnings Data (for RAG)

```sql
-- Earnings reports summary
CREATE TABLE earnings_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticker VARCHAR(10) NOT NULL,
    fiscal_year INT NOT NULL,
    fiscal_quarter INT NOT NULL CHECK (fiscal_quarter BETWEEN 1 AND 4),
    
    -- Key metrics
    revenue BIGINT,
    revenue_estimate BIGINT,
    revenue_surprise_pct DECIMAL(8, 4),
    
    eps_actual DECIMAL(10, 4),
    eps_estimate DECIMAL(10, 4),
    eps_surprise_pct DECIMAL(8, 4),
    
    -- Guidance
    guidance_revenue_low BIGINT,
    guidance_revenue_high BIGINT,
    guidance_eps_low DECIMAL(10, 4),
    guidance_eps_high DECIMAL(10, 4),
    
    report_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(ticker, fiscal_year, fiscal_quarter)
);

CREATE INDEX idx_earnings_ticker ON earnings_reports(ticker, report_date DESC);

-- Earnings call transcripts (for RAG)
CREATE TABLE earnings_transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticker VARCHAR(10) NOT NULL,
    fiscal_year INT NOT NULL,
    fiscal_quarter INT NOT NULL,
    
    -- Content
    title VARCHAR(255),
    transcript_text TEXT NOT NULL,
    
    -- For chunking/embedding
    chunk_index INT,  -- If storing chunked
    
    transcript_date DATE NOT NULL,
    source VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_transcripts_ticker ON earnings_transcripts(ticker, transcript_date DESC);

-- Vector embeddings for transcript chunks (using pgvector)
CREATE TABLE transcript_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transcript_id UUID NOT NULL REFERENCES earnings_transcripts(id) ON DELETE CASCADE,
    
    chunk_text TEXT NOT NULL,
    chunk_index INT NOT NULL,
    embedding vector(1536),  -- OpenAI ada-002 dimension
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_embeddings_transcript ON transcript_embeddings(transcript_id);
CREATE INDEX idx_embeddings_vector ON transcript_embeddings USING ivfflat (embedding vector_cosine_ops);
```

### Scoring Configuration

```sql
-- Metric definitions (what data is available for scoring)
CREATE TABLE metric_definitions (
    id VARCHAR(100) PRIMARY KEY,  -- e.g., 'fundamentals.pe_ttm'
    label VARCHAR(100) NOT NULL,
    description TEXT,
    data_source VARCHAR(50),  -- 'alpha_vantage', 'calculated', etc.
    value_type VARCHAR(20),  -- 'ratio', 'percentage', 'currency', 'integer'
    higher_is_better BOOLEAN NOT NULL,
    category VARCHAR(50),  -- 'valuation', 'growth', 'profitability', etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Scoring factor configurations (the YAML configs stored in DB)
CREATE TABLE scoring_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    factor VARCHAR(50) NOT NULL,  -- 'growth', 'valuation', 'profitability', etc.
    name VARCHAR(100) NOT NULL,
    version INT NOT NULL DEFAULT 1,
    
    -- Whether this is a system default or user-created
    is_system BOOLEAN DEFAULT FALSE,
    is_default BOOLEAN DEFAULT FALSE,
    
    -- Weight when used in composite score
    default_weight DECIMAL(3, 2) DEFAULT 0.20,
    
    -- The full configuration
    config JSONB NOT NULL,
    /* Example structure - mirrors YAML config:
    {
      "metrics": [
        {
          "id": "pe_ratio",
          "source": "fundamentals.pe_ttm",
          "scoring_method": "percentile_inverse",
          "percentile_universe": "sector",
          "weight": 0.25,
          "bounds": {"min": 0, "max": 100}
        },
        ...
      ],
      "explanation_template": "Valuation scored {score}/100..."
    }
    */
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(factor, name, version)
);

CREATE INDEX idx_scoring_configs_factor ON scoring_configs(factor);

-- Scoring profiles / personas (combines multiple factor configs with weights)
-- Examples: 'default', 'value_investor', 'growth_investor', 'buffett_style'
CREATE TABLE scoring_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,           -- 'Value Investor', 'Growth Focus', etc.
    slug VARCHAR(50) NOT NULL UNIQUE,     -- 'value_investor', 'growth_focus'
    description TEXT,
    
    -- Persona metadata
    philosophy TEXT,                       -- "Focuses on undervalued, high-quality companies..."
    icon VARCHAR(50),                      -- Emoji or icon identifier
    
    is_system BOOLEAN DEFAULT FALSE,
    is_default BOOLEAN DEFAULT FALSE,
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Junction table: which configs are in which profile, with weights
CREATE TABLE scoring_profile_factors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES scoring_profiles(id) ON DELETE CASCADE,
    config_id UUID NOT NULL REFERENCES scoring_configs(id) ON DELETE CASCADE,
    weight DECIMAL(3, 2) NOT NULL,  -- Weight in composite (should sum to 1.0)
    
    UNIQUE(profile_id, config_id)
);

CREATE INDEX idx_profile_factors_profile ON scoring_profile_factors(profile_id);
```

### Conversations & Chat

```sql
-- Conversation threads
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255),  -- Auto-generated or user-set
    
    -- Context snapshot (for long conversations)
    context_snapshot JSONB,  -- Cached user preferences, portfolio summary
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_conversations_user ON conversations(user_id, created_at DESC);

-- Individual messages
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    
    -- Structured citations for "Mechanical Trust" (assistant messages only)
    citations JSONB,
    /* Example structure:
    [
      {
        "id": "c1",
        "text_span": "P/E ratio of 65.2",
        "type": "metric",
        "metric": "pe_ttm",
        "value": 65.2,
        "ticker": "NVDA",
        "source": "Alpha Vantage",
        "as_of": "2025-01-15T08:00:00Z"
      },
      {
        "id": "c2",
        "text_span": "Jensen mentioned demand exceeding expectations",
        "type": "transcript",
        "excerpt": "We're seeing unprecedented demand across all our data center products...",
        "source": "NVDA Q3 2024 Earnings Call",
        "timestamp": "00:14:32",
        "transcript_id": "uuid"
      },
      {
        "id": "c3",
        "text_span": "mean analyst target of $152",
        "type": "analyst_target",
        "value": 152.00,
        "ticker": "NVDA",
        "source": "Financial Modeling Prep",
        "analyst_count": 42,
        "as_of": "2025-01-10"
      }
    ]
    */
    
    -- Charts embedded in response
    charts JSONB,
    /* Example structure:
    [
      {
        "id": "chart_1",
        "chart_type": "tradingview_embed",
        "ticker": "NVDA",
        "config": {
          "interval": "D",
          "studies": ["RSI", "MACD"],
          "theme": "light"
        }
      },
      {
        "id": "chart_2",
        "chart_type": "fundamental_line",
        "title": "NVDA Quarterly Revenue",
        "ticker": "NVDA",
        "metric": "revenue",
        "y_format": "currency_billions",
        "data": [
          {"x": "Q1 2023", "y": 7192000000},
          {"x": "Q2 2023", "y": 13507000000},
          ...
        ],
        "source": "Alpha Vantage",
        "as_of": "2025-01-15"
      }
    ]
    */
    
    -- What context was used to generate this response
    context_used JSONB,
    /* Example:
    {
      "holdings_referenced": ["AAPL", "NVDA"],
      "scores_fetched": ["AAPL"],
      "agents_used": ["fundamentals_analyst", "portfolio_advisor"],
      "guardrails_checked": true,
      "simulation_run": false
    }
    */
    
    -- Token usage for cost tracking
    tokens_input INT,
    tokens_output INT,
    model_used VARCHAR(50),  -- 'claude-haiku-4-5', 'claude-sonnet-4-5'
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
```

## Row-Level Security (Supabase)

```sql
-- Enable RLS on all user-data tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can view own preferences" ON user_preferences
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own portfolios" ON portfolios
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage holdings in own portfolios" ON holdings
    FOR ALL USING (
        portfolio_id IN (
            SELECT id FROM portfolios WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage own conversations" ON conversations
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view messages in own conversations" ON messages
    FOR ALL USING (
        conversation_id IN (
            SELECT id FROM conversations WHERE user_id = auth.uid()
        )
    );

-- Stock data and scoring configs are public read
CREATE POLICY "Anyone can view stocks" ON stocks FOR SELECT USING (true);
CREATE POLICY "Anyone can view fundamentals" ON stock_fundamentals FOR SELECT USING (true);
CREATE POLICY "Anyone can view scores" ON stock_scores FOR SELECT USING (true);
CREATE POLICY "Anyone can view system configs" ON scoring_configs 
    FOR SELECT USING (is_system = true OR created_by = auth.uid());
```

## Migration Strategy

Migrations should be created in order:

1. `001_create_users.sql` — Users and preferences
2. `002_create_portfolios.sql` — Portfolios and holdings
3. `003_create_stocks.sql` — Stock data and fundamentals
4. `004_create_scoring.sql` — Scoring configs and scores
5. `005_create_earnings.sql` — Earnings data and transcripts
6. `006_create_conversations.sql` — Chat history
7. `007_enable_rls.sql` — Row-level security policies
8. `008_seed_configs.sql` — Default scoring configurations

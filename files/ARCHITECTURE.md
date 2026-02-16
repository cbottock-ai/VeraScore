# VeraScore System Architecture

## Overview

VeraScore follows a modular architecture with clear separation between the frontend, backend API, scoring engine, multi-agent layer, and data providers. This design enables independent scaling and easy modification of individual components.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (React + TypeScript)                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐ │
│  │   Dashboard     │  │   Portfolio     │  │      Chat Interface         │ │
│  │   - Scores      │  │   - Holdings    │  │      - Conversation         │ │
│  │   - Charts      │  │   - Tax lots    │  │      - Context sidebar      │ │
│  │   - Watchlist   │  │   - Import/CSV  │  │      - Score references     │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ REST API
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BACKEND API (Python FastAPI)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │    Auth      │  │  Portfolio   │  │   Scoring    │  │     Chat       │  │
│  │   Service    │  │   Service    │  │   Service    │  │  Orchestrator  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
┌──────────────────────┐ ┌──────────────────┐ ┌──────────────────────────────┐
│   SCORING ENGINE     │ │  MULTI-AGENT     │ │      DATA PROVIDERS          │
│  ┌────────────────┐  │ │     LAYER        │ │  ┌────────────────────────┐  │
│  │ Config Loader  │  │ │  ┌────────────┐  │ │  │   Financial APIs       │  │
│  │ (YAML → Logic) │  │ │  │Orchestrator│  │ │  │   - Alpha Vantage      │  │
│  └────────────────┘  │ │  └────────────┘  │ │  │   - FMP (backup)       │  │
│  ┌────────────────┐  │ │  ┌────────────┐  │ │  └────────────────────────┘  │
│  │  Calculators   │  │ │  │Fundamentals│  │ │  ┌────────────────────────┐  │
│  │  - Percentile  │  │ │  │  Analyst   │  │ │  │   Earnings Data        │  │
│  │  - Threshold   │  │ │  └────────────┘  │ │  │   - Transcripts API    │  │
│  │  - Linear      │  │ │  ┌────────────┐  │ │  │   - SEC EDGAR          │  │
│  └────────────────┘  │ │  │  Earnings  │  │ │  └────────────────────────┘  │
│  ┌────────────────┐  │ │  │  Analyst   │  │ │  ┌────────────────────────┐  │
│  │   Explainer    │  │ │  └────────────┘  │ │  │   Market Data          │  │
│  │ (Score → Text) │  │ │  ┌────────────┐  │ │  │   - Price history      │  │
│  └────────────────┘  │ │  │ Portfolio  │  │ │  │   - Sector benchmarks  │  │
│  ┌────────────────┐  │ │  │  Advisor   │  │ │  └────────────────────────┘  │
│  │  Guardrails    │  │ │  └────────────┘  │ │  ┌────────────────────────┐  │
│  │   Checker      │  │ │  ┌────────────┐  │ │  │   Macro Data           │  │
│  └────────────────┘  │ │  │ Sentiment  │  │ │  │   - Factor mappings    │  │
│                      │ │  │  Analyst   │  │ │  │   - Sensitivity data   │  │
│                      │ │  └────────────┘  │ │  └────────────────────────┘  │
│                      │ │  ┌────────────┐  │ │                              │
│                      │ │  │ Simulation │  │ │                              │
│                      │ │  │   Agent    │  │ │                              │
│                      │ │  └────────────┘  │ │                              │
│                      │ │  ┌────────────┐  │ │                              │
│                      │ │  │   Macro    │  │ │                              │
│                      │ │  │  Analyst   │  │ │                              │
│                      │ │  └────────────┘  │ │                              │
└──────────────────────┘ └──────────────────┘ └──────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA LAYER                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐ │
│  │   PostgreSQL    │  │    pgvector     │  │         Redis               │ │
│  │   (Supabase)    │  │  (Embeddings)   │  │        (Cache)              │ │
│  │                 │  │                 │  │                             │ │
│  │  - Users        │  │  - Transcripts  │  │  - Score cache              │ │
│  │  - Portfolios   │  │  - Earnings     │  │  - API rate limiting        │ │
│  │  - Holdings     │  │    summaries    │  │  - Session data             │ │
│  │  - Scores       │  │                 │  │                             │ │
│  │  - Configs      │  │                 │  │                             │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Component Details

### Frontend (React + TypeScript + Tailwind)

**Technology Choices:**
- React 18 with TypeScript for type safety
- Tailwind CSS for styling (rapid iteration, consistent design)
- shadcn/ui component library (flexible, professional)
- Tremor or Recharts for financial visualizations
- TanStack Query for server state management
- Zustand for client state (lightweight, simple)

**Design Philosophy:**
- Friendly fintech aesthetic (approachable, not intimidating)
- Minimal and clean (generous whitespace, one focus per page)
- Progressive disclosure (summary first, details on demand)

**Key Pages (Top Navigation):**
1. **Portfolio** — Holdings overview, aggregate scores, guardrail status
2. **Research** — Individual stock analysis with scores, fundamentals, analyst targets
3. **Screener** — Filter and discover stocks by score criteria
4. **News** — Market news and updates relevant to holdings
5. **Chat** — Dedicated full-page conversational interface
6. **Settings** — User preferences, risk tolerance, guardrails, scoring persona

**Chat Integration:**
- Dedicated `/chat` page for full conversational experience
- Slide-out chat panel on Stock and Portfolio pages (contextual)
- Panel pre-loads context ("Discussing AAPL" or "Your portfolio")
- Floating chat button (bottom-right) to open panel from any page

### Backend API (Python FastAPI)

**Why Python over Node:**
- Superior ecosystem for financial data (pandas, numpy)
- Better library support for ML/embeddings
- Easier integration with data science workflows

**Service Structure:**
```
/api
  /auth           # Supabase auth integration
  /portfolios     # CRUD for portfolios and holdings
  /stocks         # Stock lookup, scores, fundamentals
  /scoring        # Score calculation and explanation
  /chat           # Conversation management, agent routing
  /admin          # Config management (scoring configs)
```

**Key Endpoints:**
```
# Auth
POST   /auth/register
POST   /auth/login
GET    /auth/me

# Portfolios
GET    /portfolios
POST   /portfolios
GET    /portfolios/{id}
PUT    /portfolios/{id}
DELETE /portfolios/{id}
POST   /portfolios/{id}/import    # CSV import
GET    /portfolios/{id}/export    # CSV export

# Holdings
GET    /portfolios/{id}/holdings
POST   /portfolios/{id}/holdings
PUT    /holdings/{id}
DELETE /holdings/{id}

# Stocks
GET    /stocks/search?q={query}
GET    /stocks/{ticker}
GET    /stocks/{ticker}/scores
GET    /stocks/{ticker}/fundamentals
GET    /stocks/{ticker}/earnings

# Scoring
GET    /scoring/configs                    # List available configs
GET    /scoring/configs/{id}               # Get specific config
POST   /scoring/calculate/{ticker}         # Calculate score with config
GET    /scoring/explain/{ticker}/{factor}  # Get explanation for factor

# Chat
GET    /conversations
POST   /conversations
GET    /conversations/{id}/messages
POST   /conversations/{id}/messages        # Send message, get response
```

### Scoring Engine

**Design Principle:** Configuration-driven scoring — all factor calculations are defined in YAML configs, not hardcoded logic.

**Components:**
1. **Config Loader** — Reads YAML configs from filesystem or database
2. **Metric Fetcher** — Retrieves raw financial data from providers
3. **Calculators** — Implements scoring methods (percentile, threshold, linear)
4. **Composite Calculator** — Combines factor scores into overall score
5. **Explainer** — Generates human-readable explanations from score components

See `SCORING_SYSTEM.md` for detailed scoring architecture.

### Multi-Agent Layer

**Purpose:** Route user queries to specialized agents and synthesize responses.

**Agents:**
| Agent | Role | Tools |
|-------|------|-------|
| Orchestrator | Route queries, synthesize responses | All agents, user context |
| Fundamentals Analyst | Growth, profitability, valuation | Financial APIs, scoring engine |
| Earnings Analyst | Earnings, guidance, transcripts | RAG over transcripts, earnings data |
| Portfolio Advisor | Tax-aware recommendations | User holdings, tax lots, preferences |

See `AGENT_DESIGN.md` for detailed agent architecture.

### Data Providers

**Financial Data (Free Tier Strategy):**
- **Primary:** Alpha Vantage (5 calls/min, good fundamentals)
- **Backup:** Financial Modeling Prep (250 calls/day)
- **Price History:** Yahoo Finance (via yfinance library, no limit)

**Analyst Data:**
- **Price Targets:** Financial Modeling Prep or Alpha Vantage
- **Rating Changes:** Financial Modeling Prep (analyst upgrades/downgrades)
- **Backup:** Finnhub (free tier available)

**Institutional Data:**
- **13F Filings:** SEC EDGAR (free, official source)
- **Aggregated Data:** Financial Modeling Prep or WhaleWisdom API
- **Update Frequency:** Quarterly (13F filings due 45 days after quarter end)

**Earnings Data:**
- **Transcripts:** Earnings Call Transcripts API or scraping (for MVP, manual seeding)
- **Reports:** SEC EDGAR (free, unlimited)

**Caching Strategy:**
- Cache fundamentals for 24 hours (refresh daily)
- Cache scores for 4 hours (or until underlying data changes)
- Cache price data for 15 minutes
- Cache analyst targets for 24 hours
- Cache institutional data for 7 days (only changes quarterly)

### Data Layer

**PostgreSQL (Supabase):**
- User accounts and authentication
- Portfolios, holdings, tax lots
- Scoring configurations
- Conversation history
- Cached scores and fundamentals

**pgvector Extension:**
- Earnings transcript embeddings for RAG
- Enables semantic search over earnings content

**Redis (Upstash for serverless):**
- API response caching
- Rate limiting for external APIs
- Session data for chat context

## Deployment Architecture

### Development Environment
```
┌─────────────────┐     ┌─────────────────┐
│  Local React    │────▶│  Local FastAPI  │
│  (Vite dev)     │     │  (uvicorn)      │
└─────────────────┘     └────────┬────────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
           ┌─────────────────┐      ┌─────────────────┐
           │ Supabase Cloud  │      │  Redis (local   │
           │ (free tier)     │      │  or Upstash)    │
           └─────────────────┘      └─────────────────┘
```

### Production Environment (AWS)
```
┌─────────────────┐     ┌─────────────────┐
│   CloudFront    │────▶│   S3 (Static    │
│   (CDN)         │     │   React build)  │
└─────────────────┘     └─────────────────┘

┌─────────────────────────────────────────┐
│            AWS App Runner               │
│            (FastAPI container)          │
│                                         │
│  • Auto-scaling (0 to N instances)      │
│  • No cold starts (min 1 instance)      │
│  • Pay for compute time                 │
│  • Simple container deployment          │
└──────────────────┬──────────────────────┘
                   │
    ┌──────────────┼──────────────┐
    ▼              ▼              ▼
┌────────────┐ ┌────────────┐ ┌────────────┐
│ Supabase   │ │  Upstash   │ │  Secrets   │
│ (Postgres  │ │  (Redis)   │ │  Manager   │
│ +pgvector) │ │            │ │            │
└────────────┘ └────────────┘ └────────────┘
```

**Why App Runner over ECS Fargate:**
- Simpler deployment (just point to container)
- Auto-scales to zero when idle (cost savings)
- No load balancer configuration needed
- ~$5-25/mo at prototype scale vs $30-50/mo for Fargate

## Data Flow Examples

### Flow 1: User Views Stock Score
```
1. User navigates to /stocks/AAPL
2. Frontend calls GET /stocks/AAPL/scores
3. Backend checks Redis cache
   - If cached and fresh → return cached score
   - If stale or missing → continue
4. Scoring Service loads scoring config (YAML or DB)
5. Data Provider fetches fundamentals from Alpha Vantage (or cache)
6. Scoring Engine calculates each factor:
   - For each metric in config
   - Apply scoring method (percentile, threshold, etc.)
   - Weight and combine into factor score
7. Explainer generates explanation text
8. Score cached in Redis
9. Response returned to frontend
```

### Flow 2: User Asks Chat Question
```
User: "Why did my portfolio's profitability score drop this week?"

1. Frontend POSTs to /conversations/{id}/messages
2. Chat Orchestrator receives message
3. Orchestrator identifies query type: score explanation + portfolio context
4. Orchestrator loads user context:
   - Current holdings from database
   - User preferences (risk tolerance, etc.)
   - Recent conversation history
5. Orchestrator routes to:
   - Portfolio Advisor: "Identify which holdings changed scores"
   - Fundamentals Analyst: "Explain profitability score changes for [tickers]"
6. Portfolio Advisor queries score history, identifies NVDA dropped
7. Fundamentals Analyst explains: margin compression, cites earnings
8. Orchestrator synthesizes response with specific holdings mentioned
9. Response returned, stored in conversation history
```

### Flow 3: CSV Portfolio Import
```
1. User uploads CSV file
2. Frontend POSTs to /portfolios/{id}/import with file
3. Backend parses CSV (expected columns: ticker, shares, cost_basis, purchase_date)
4. For each row:
   - Validate ticker exists (stock lookup)
   - Create holding record with tax lot
5. Trigger score calculation for portfolio
6. Return success with any validation warnings
```

## Security Considerations

- **Authentication:** Supabase Auth (JWT-based)
- **Authorization:** Row-level security in Supabase for portfolio data
- **API Keys:** Stored in environment variables / Secrets Manager
- **Rate Limiting:** Redis-based limiting on external API calls
- **Input Validation:** Pydantic models for all API inputs
- **SQL Injection:** Prevented via SQLAlchemy ORM / Supabase client

## Performance Targets

- **Stock score load:** < 500ms (with cache hit)
- **Portfolio load:** < 1s for 50 holdings
- **Chat response:** < 3s for typical query
- **CSV import:** < 10s for 100 holdings

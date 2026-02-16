# VeraScore Build Plan

## Overview

This document outlines the phased implementation plan for VeraScore. Each phase builds on the previous, with clear milestones and deliverables.

**Total estimated timeline:** 10-12 weeks for MVP

## Phase 0: Project Setup (Week 1)

### Goals
- Repository structure established
- Development environment configured
- Core dependencies installed
- Database schema deployed

### Tasks

#### 0.1 Repository Setup
```bash
# Create monorepo structure
mkdir -p apps/web apps/api
mkdir -p packages/scoring-engine packages/data-provider packages/shared
mkdir -p configs/scoring configs/agents
mkdir -p docs scripts
```

#### 0.2 Frontend Scaffolding
- Initialize React + TypeScript + Vite
- Configure Tailwind CSS
- Set up routing (React Router)
- Install core dependencies:
  - `@tanstack/react-query` (server state)
  - `zustand` (client state)
  - `recharts` or `tremor` (charts)
  - `axios` (API client)

#### 0.3 Backend Scaffolding
- Initialize FastAPI project
- Configure project structure:
  ```
  /apps/api
    /src
      /auth
      /portfolios
      /stocks
      /scoring
      /chat
      /core (config, dependencies)
    /tests
    main.py
    requirements.txt
  ```
- Install core dependencies:
  - `fastapi`, `uvicorn`
  - `sqlalchemy`, `alembic`
  - `pydantic`
  - `httpx` (async HTTP client)
  - `redis`

#### 0.4 Database Setup
- Create Supabase project
- Enable pgvector extension
- Run initial migrations (users, portfolios, holdings)
- Configure Row-Level Security policies
- Set up local development connection

#### 0.5 Environment Configuration
- Create `.env.example` with required variables
- Set up environment variable management
- Configure secrets for API keys (Alpha Vantage, etc.)

### Deliverables
- [ ] Monorepo with apps/web, apps/api, packages/*
- [ ] React app running at localhost:5173
- [ ] FastAPI app running at localhost:8000
- [ ] Database migrations applied
- [ ] README with setup instructions

---

## Phase 1: Core Data & Stock Lookup (Week 2)

### Goals
- Users can search for and view stock information
- Fundamental data is fetched and cached
- Basic UI for stock display

### Tasks

#### 1.1 Data Provider Package
```
/packages/data-provider
  /src
    /providers
      alpha_vantage.py
      fmp.py (backup)
      yahoo_finance.py (price data)
    /cache
      redis_cache.py
    types.py
    fetcher.py
```
- Implement Alpha Vantage client (fundamentals, company overview)
- Implement Yahoo Finance client (price history, current price)
- Add Redis caching layer (24h for fundamentals, 15min for prices)
- Handle rate limiting gracefully

#### 1.2 Stock API Endpoints
```
GET /stocks/search?q={query}    # Search stocks by name/ticker
GET /stocks/{ticker}            # Get stock details
GET /stocks/{ticker}/fundamentals  # Get fundamental data
GET /stocks/{ticker}/price      # Get current price
```

#### 1.3 Stock Database Tables
- Create `stocks` table (master data)
- Create `stock_fundamentals` table (cached metrics)
- Add indexes for efficient lookup

#### 1.4 Frontend: Stock Search & Display
- Search bar with autocomplete
- Stock detail page layout
- Display company info, key metrics
- Price chart (simple line chart)

### Deliverables
- [ ] Stock search returns results
- [ ] Stock detail page shows fundamentals
- [ ] Data caches properly (verify with Redis CLI)
- [ ] Rate limiting works (no API errors)

---

## Phase 2: Scoring Engine (Weeks 3-4)

### Goals
- Configuration-driven scoring system operational
- All five factors calculating correctly
- Scores display on stock pages

### Tasks

#### 2.1 Scoring Engine Package
```
/packages/scoring-engine
  /src
    /configs
      loader.py           # Load YAML configs
    /methods
      percentile.py       # Percentile scoring
      threshold.py        # Threshold scoring
      linear.py           # Linear interpolation
    /engine
      calculator.py       # Main scoring logic
      composite.py        # Combine factor scores
      explainer.py        # Generate explanations
    types.py
```

#### 2.2 Create Factor Configs
- `/configs/scoring/growth_v1.yaml`
- `/configs/scoring/profitability_v1.yaml`
- `/configs/scoring/valuation_v1.yaml`
- `/configs/scoring/momentum_v1.yaml`
- `/configs/scoring/quality_v1.yaml`
- `/configs/scoring/default_profile.yaml`

#### 2.3 Percentile Calculation
- Build sector/industry percentile tables
- Implement efficient percentile lookup
- Handle missing data gracefully

#### 2.4 Scoring API Endpoints
```
GET /stocks/{ticker}/scores           # Get all scores
GET /stocks/{ticker}/scores/{factor}  # Get specific factor
POST /scoring/calculate/{ticker}      # Force recalculate
```

#### 2.5 Score Storage
- Create `stock_scores` table
- Create `stock_score_history` table
- Implement cache invalidation logic

#### 2.6 Frontend: Score Display
- Score badges (0-100 with color coding)
- Factor breakdown cards
- Explanation text display
- Score history chart (optional for MVP)

### Deliverables
- [ ] All five factor scores calculating
- [ ] Scores match expected values for test stocks
- [ ] Explanations generate correctly
- [ ] Stock page displays scores
- [ ] Config changes update scores (no code changes)

---

## Phase 3: Portfolio Management (Weeks 5-6)

### Goals
- Users can create portfolios and add holdings
- Tax lot tracking operational
- CSV import/export working
- Portfolio-level metrics displayed

### Tasks

#### 3.1 Portfolio API Endpoints
```
# Portfolios
GET    /portfolios
POST   /portfolios
GET    /portfolios/{id}
PUT    /portfolios/{id}
DELETE /portfolios/{id}

# Holdings
GET    /portfolios/{id}/holdings
POST   /portfolios/{id}/holdings
PUT    /holdings/{id}
DELETE /holdings/{id}

# Import/Export
POST   /portfolios/{id}/import   # CSV upload
GET    /portfolios/{id}/export   # CSV download
```

#### 3.2 Portfolio Database
- Create `portfolios` table
- Create `holdings` table with tax lot fields
- Create `portfolio_metrics` table (cached aggregates)
- Implement cascade deletes

#### 3.3 CSV Import Logic
```python
# Expected CSV format:
# ticker,shares,cost_basis,purchase_date,notes
# AAPL,100,15000,2023-01-15,
# NVDA,50,12500,2023-06-01,bought after split

def import_csv(portfolio_id: str, file: UploadFile) -> ImportResult:
    # Parse CSV
    # Validate tickers exist
    # Create holdings with tax lots
    # Calculate initial portfolio metrics
    # Return success/errors
```

#### 3.4 Portfolio Metrics Calculator
- Total value (current prices × shares)
- Total cost basis
- Total gain/loss ($ and %)
- Sector allocation breakdown
- Portfolio-weighted scores
- Concentration metrics (top holding %, top 5 %)

#### 3.5 Frontend: Portfolio Manager
- Portfolio list view
- Create/edit portfolio modal
- Holdings table with:
  - Ticker, shares, cost basis, current value
  - Gain/loss ($ and %)
  - Individual stock scores
- Add holding form
- CSV import button with drag-drop
- CSV export button

#### 3.6 Frontend: Portfolio Dashboard
- Portfolio value card
- Gain/loss summary
- Sector allocation pie chart
- Portfolio score summary (weighted average)
- Top/bottom performers

### Deliverables
- [ ] Create portfolio works
- [ ] Add holdings manually works
- [ ] CSV import processes correctly
- [ ] CSV export downloads valid file
- [ ] Portfolio metrics calculate correctly
- [ ] Holdings display with current values
- [ ] Tax lot data stored properly

---

## Phase 4: Conversational Interface (Weeks 7-8)

### Goals
- Chat interface operational
- Orchestrator routes queries correctly
- Agents provide relevant responses
- Conversation memory persists

### Tasks

#### 4.1 Chat Backend Infrastructure
```
/apps/api/src/chat
  orchestrator.py       # Main routing logic
  agents/
    fundamentals.py     # Fundamentals analyst
    earnings.py         # Earnings analyst
    portfolio.py        # Portfolio advisor
  context.py            # Context assembly
  memory.py             # Conversation memory
```

#### 4.2 Chat API Endpoints
```
GET  /conversations                    # List conversations
POST /conversations                    # Create new conversation
GET  /conversations/{id}/messages      # Get messages
POST /conversations/{id}/messages      # Send message, get response
DELETE /conversations/{id}             # Delete conversation
```

#### 4.3 Orchestrator Implementation
- Intent classification (regex patterns + optional LLM)
- Context assembly (user profile, holdings, mentioned tickers)
- Agent routing
- Response synthesis

#### 4.4 Agent Implementation
- Fundamentals Analyst:
  - Score lookup and explanation
  - Metric comparison
  - Sector context
- Portfolio Advisor:
  - Holdings analysis
  - Tax lot awareness
  - Personalized recommendations

#### 4.5 Conversation Storage
- Create `conversations` table
- Create `messages` table
- Store context used for each response

#### 4.6 Frontend: Chat Interface
- Chat panel (sidebar or dedicated page)
- Message input with send button
- Message history display
- "Thinking" indicator
- Referenced stocks as clickable chips
- Conversation list/history

### Deliverables
- [ ] Chat sends messages and receives responses
- [ ] Responses reference user's holdings correctly
- [ ] Score questions get accurate explanations
- [ ] Portfolio questions include specific holdings
- [ ] Conversation history persists
- [ ] Context is visible in responses

---

## Phase 5: Earnings & RAG (Week 9)

### Goals
- Earnings data available
- Transcript search operational
- Earnings Analyst agent functional

### Tasks

#### 5.1 Earnings Data Pipeline
- Fetch earnings reports (Alpha Vantage or FMP)
- Store in `earnings_reports` table
- Schedule regular updates

#### 5.2 Transcript Ingestion (MVP: Manual)
For MVP, manually seed a few transcripts:
- Download sample transcripts
- Chunk into ~500 token segments
- Generate embeddings (OpenAI ada-002)
- Store in `transcript_embeddings` table

#### 5.3 RAG Implementation
```python
async def search_transcripts(ticker: str, query: str) -> List[Chunk]:
    # Generate query embedding
    # Vector similarity search in pgvector
    # Return top K relevant chunks
```

#### 5.4 Earnings Analyst Agent
- Integrate earnings data lookup
- Integrate transcript RAG search
- Format responses with citations

#### 5.5 Frontend: Earnings Display (Optional)
- Earnings history table on stock page
- Earnings surprise indicators

### Deliverables
- [ ] Earnings data displays for stocks
- [ ] Transcript search returns relevant chunks
- [ ] Earnings Analyst provides transcript-backed answers
- [ ] Citations include quarter/year reference

---

## Phase 6: Polish & Production Prep (Weeks 10-11)

### Goals
- User experience refined
- Authentication complete
- Production deployment ready

### Tasks

#### 6.1 Authentication Flow
- Supabase Auth integration
- Sign up / sign in pages
- Protected routes
- Session management

#### 6.2 User Preferences
- Settings page
- Risk tolerance selector
- Tax bracket input
- Investment horizon selection

#### 6.3 UI/UX Polish
- Loading states everywhere
- Error handling and messages
- Empty states (no holdings, no conversations)
- Mobile responsive design
- Consistent styling

#### 6.4 Onboarding Flow
- Welcome modal for new users
- Portfolio creation prompt
- Quick tutorial or tips

#### 6.5 Production Infrastructure (AWS)
- Set up ECS Fargate for API
- Set up RDS PostgreSQL with pgvector
- Set up ElastiCache Redis
- Set up S3 + CloudFront for frontend
- Configure environment variables in Secrets Manager
- Set up CI/CD pipeline

#### 6.6 Monitoring & Logging
- API request logging
- Error tracking (Sentry or similar)
- Performance monitoring
- Usage metrics

### Deliverables
- [ ] Users can sign up and log in
- [ ] User preferences save correctly
- [ ] All pages have loading/error states
- [ ] Mobile experience is functional
- [ ] Production deployment works
- [ ] Monitoring dashboards available

---

## Phase 7: Testing & Launch (Week 12)

### Goals
- Comprehensive testing complete
- Documentation finished
- Ready for beta users

### Tasks

#### 7.1 Testing
- Unit tests for scoring engine
- Integration tests for API endpoints
- End-to-end tests for critical flows:
  - Sign up → Create portfolio → Add holdings → View scores
  - Ask chat question → Get personalized response
  - Import CSV → Verify holdings

#### 7.2 Documentation
- API documentation (auto-generated from FastAPI)
- User guide / FAQ
- Architecture documentation (these docs!)

#### 7.3 Performance Testing
- Load test API endpoints
- Verify score calculation speed
- Test chat response latency

#### 7.4 Security Review
- Verify RLS policies
- Check for SQL injection
- Validate input sanitization
- Review API authentication

#### 7.5 Beta Launch
- Deploy to production
- Invite initial test users
- Set up feedback collection
- Monitor for issues

### Deliverables
- [ ] Test suite passes
- [ ] Documentation complete
- [ ] Performance meets targets
- [ ] Security review passed
- [ ] Beta users onboarded

---

## Quick Reference: Build Order

```
Week 1:    Setup (repo, frontend, backend, database)
Week 2:    Stock data & lookup
Week 3-4:  Scoring engine (config-driven) + Personas
Week 5-6:  Portfolio management (holdings, CSV, metrics, guardrails)
Week 7-8:  Chat interface (orchestrator, core agents)
Week 9:    Simulation Agent + Macro Analyst
Week 10:   Earnings & RAG + Sentiment (analyst/institutional)
Week 11-12: Citations UI, polish & production prep
Week 13:   Testing & launch
```

## Dependencies Between Phases

```
Phase 0 (Setup)
    │
    ▼
Phase 1 (Stock Data) ─────────────────┐
    │                                  │
    ▼                                  │
Phase 2 (Scoring + Personas) ─────┐   │
    │                              │   │
    ▼                              │   │
Phase 3 (Portfolio + Guardrails) ◀┘   │
    │                                  │
    ▼                                  │
Phase 4 (Chat - Core Agents) ◀────────┘
    │
    ├──────────────┐
    ▼              ▼
Phase 5a       Phase 5b
(Simulation)   (Macro Analyst)
    │              │
    └──────┬───────┘
           ▼
Phase 6 (Earnings/RAG + Sentiment)
    │
    ▼
Phase 7 (Citations UI + Polish)
    │
    ▼
Phase 8 (Launch)
```

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| API rate limits hit | Aggressive caching, backup providers |
| Scoring too slow | Pre-calculate and cache, async updates |
| Chat responses slow | Streaming responses, background processing |
| Transcript data unavailable | Start with manual seeding, defer to post-MVP |
| Scope creep | Strict MVP boundaries, future features documented |
| AI gives financial advice | Strict prompt guidelines, compliance review |
| AI calculates wrong | Tool-use pattern: AI never does math |
| Citations missing | Structured citation schema enforced by tools |

---

## Future Features (Post-MVP)

### TradingView Webhook Integration
If you have TradingView Pro/Pro+/Premium, webhook alerts can push to VeraScore:

```
TradingView Alert (e.g., "RSI crossed 70")
    ↓
POST webhook to VeraScore API
    ↓
Store alert in database
    ↓
Notify user in chat: "Your NVDA RSI alert triggered"
```

**Implementation:**
1. Add `/webhooks/tradingview` endpoint
2. Create `user_alerts` table
3. Add notification system to chat
4. User configures alerts in TradingView, points webhook to VeraScore

### Proactive Notifications
- Guardrail violations (holdings drift)
- Score changes (significant drops)
- Macro events affecting portfolio (CPI release, Fed decisions)
- Earnings coming up for holdings

### Custom Scoring Personas
Let users create their own scoring personas via UI (not just predefined YAML).

### Brokerage Integration
Plaid integration to sync holdings automatically instead of CSV import.

### Backtesting
"How would my portfolio have performed in 2022?" — historical simulation.

### Mobile App
React Native app with full feature parity.

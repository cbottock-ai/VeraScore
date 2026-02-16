# VeraScore Codebase Context for Claude Code

> **Purpose:** This file provides essential context about the project. Read this first before making any changes.

## What This Project Is

**VeraScore** is a Conversational Portfolio Manager — a web application that combines:
1. AI-generated stock scores (like Ziggma)
2. Analyst price targets and institutional flow data
3. Portfolio tracking with tax lot awareness
4. A chat interface where users can ask questions about their holdings
5. "What-if" simulation for hypothetical trades
6. Macro sensitivity analysis
7. User-defined guardrails and alerts

The key differentiator is the conversational interface that has memory of the user's specific portfolio, tax situation, and preferences.

## ⚠️ Critical: Compliance Rules

**VeraScore is an educational tool, NOT a financial advisor.**

All AI responses must:
- Provide **analysis**, not recommendations
- Use "the data suggests" NOT "you should"
- Always cite data sources with dates
- Never perform calculations (use tool calls instead)

See `PROJECT_OVERVIEW.md` for full compliance guidelines.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui |
| Backend | Python FastAPI |
| Database | PostgreSQL (Supabase) + pgvector |
| Cache | Redis (Upstash) |
| LLM | Claude API (Anthropic) |
| Financial Data | Alpha Vantage (primary), FMP (backup), Yahoo Finance (prices) |
| Deployment | AWS App Runner (production), Vercel + Railway (prototype) |

## Project Structure

```
/
├── apps/
│   ├── web/                    # React frontend
│   │   ├── src/
│   │   │   ├── components/     # Reusable UI components
│   │   │   ├── pages/          # Route pages
│   │   │   ├── hooks/          # Custom React hooks
│   │   │   ├── services/       # API client functions
│   │   │   ├── stores/         # Zustand stores
│   │   │   └── types/          # TypeScript types
│   │   └── ...
│   │
│   └── api/                    # FastAPI backend
│       ├── src/
│       │   ├── auth/           # Authentication
│       │   ├── portfolios/     # Portfolio CRUD
│       │   ├── stocks/         # Stock data & lookup
│       │   ├── scoring/        # Score calculation
│       │   ├── chat/           # Conversational agents
│       │   └── core/           # Config, dependencies
│       └── ...
│
├── packages/
│   ├── scoring-engine/         # Config-driven scoring logic
│   ├── data-provider/          # Financial API clients
│   └── shared/                 # Shared types & utilities
│
├── configs/
│   ├── scoring/                # YAML scoring configurations
│   │   ├── growth_v1.yaml
│   │   ├── profitability_v1.yaml
│   │   ├── valuation_v1.yaml
│   │   ├── momentum_v1.yaml
│   │   ├── quality_v1.yaml
│   │   └── sentiment_v1.yaml
│   ├── personas/               # Scoring persona profiles
│   │   ├── default.yaml
│   │   ├── value_investor.yaml
│   │   ├── growth_investor.yaml
│   │   └── buffett_style.yaml
│   └── agents/                 # Agent prompt templates
│
└── docs/                       # Documentation (you're here)
```

## Critical Design Decisions

### 1. AI Never Performs Calculations (Tool-Use Pattern)

**All math is done by Python services.** AI only summarizes results.

```python
# ❌ WRONG: AI calculates
"100 shares × ($178 - $142) = $3,600 gain"

# ✅ RIGHT: AI calls tool, summarizes result
result = calculate_gains(holding_id)  # Returns {gain: 3600.00}
"Your position shows a $3,600 gain"
```

### 2. Scoring is Configuration-Driven

**DO NOT hardcode scoring logic.** All factor calculations are defined in YAML configs.

```yaml
# Example: configs/scoring/valuation_v1.yaml
metrics:
  - id: pe_ratio
    source: fundamentals.pe_ttm
    scoring_method: percentile_inverse
    weight: 0.25
```

To change scoring:
1. Edit the YAML config
2. Scoring engine picks up changes automatically
3. No code changes required

### 3. Tax Lot Tracking

Holdings are stored with full tax lot information:
- Purchase date (for short-term vs long-term gains)
- Cost basis (for gain/loss calculation)
- Each lot is a separate row (user may have multiple lots of same stock)

### 4. Multi-Agent Chat Architecture

Chat queries are routed to specialized agents:
- **Orchestrator** — Routes queries and synthesizes responses
- **Fundamentals Analyst** — Handles score/metric questions
- **Earnings Analyst** — Handles earnings/transcript questions
- **Sentiment Analyst** — Handles analyst targets and institutional flow
- **Portfolio Advisor** — Handles portfolio-specific questions
- **Simulation Agent** — Handles "what-if" queries
- **Macro Analyst** — Handles macro sensitivity questions

### 5. Guardrails System

Users define rules that are checked on every portfolio change:
- Runs on actual portfolio updates
- Runs on simulated trades (before user acts)
- Violations surfaced in chat responses

### 6. Citations for Mechanical Trust

Every factual claim in AI responses includes:
- Structured citation metadata
- Data source and as-of date
- Frontend renders as hoverable/clickable references

### 7. User Context in Every Response

Chat responses must reference:
- User's actual holdings (by ticker and position size)
- User's cost basis and gain/loss
- User's risk tolerance and preferences
- Specific scores and metrics

## Key Files to Know

| File | Purpose |
|------|---------|
| `configs/scoring/*.yaml` | Scoring factor definitions |
| `packages/scoring-engine/src/engine/calculator.py` | Main scoring logic |
| `apps/api/src/chat/orchestrator.py` | Chat query routing |
| `apps/api/src/chat/agents/*.py` | Specialist agents |
| `docs/DATA_MODEL.md` | Database schema |
| `docs/SCORING_SYSTEM.md` | Scoring methodology |

## Common Tasks

### Adding a new metric to scoring

1. Ensure metric exists in `stock_fundamentals` table
2. Add entry to relevant YAML config:
   ```yaml
   - id: new_metric_id
     source: fundamentals.new_metric_column
     scoring_method: percentile
     weight: 0.15
   ```
3. Adjust other weights to sum to 1.0
4. Test with a sample stock

### Adding a new API endpoint

1. Create route file in appropriate module (`apps/api/src/{module}/routes.py`)
2. Define Pydantic models for request/response
3. Add to router in `apps/api/src/main.py`
4. Add corresponding frontend service function

### Adding a new chat agent capability

1. Identify which agent should handle it
2. Add tool function in `apps/api/src/chat/agents/{agent}.py`
3. Update agent prompt template in `configs/agents/`
4. Add routing pattern in orchestrator if new intent type

## Environment Variables

```bash
# Required
DATABASE_URL=postgresql://...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=...
REDIS_URL=redis://...
ALPHA_VANTAGE_API_KEY=...
ANTHROPIC_API_KEY=...

# Optional
FMP_API_KEY=...  # Backup financial data
OPENAI_API_KEY=...  # For embeddings (if using OpenAI)
```

## Testing

```bash
# Backend tests
cd apps/api
pytest

# Frontend tests
cd apps/web
npm test

# Specific scoring test
pytest tests/scoring/test_valuation.py -v
```

## Common Gotchas

1. **Alpha Vantage rate limits** — 5 calls/minute on free tier. Always check cache first.

2. **Percentile calculation** — Requires sector/industry peer data. Handle missing data gracefully.

3. **Tax lot calculations** — Purchase date determines short-term (<1 year) vs long-term.

4. **Chat context size** — Don't send entire portfolio in every message. Summarize and only include relevant holdings.

5. **Score caching** — Scores are cached for 4 hours. Invalidate on fundamental data refresh.

## When You're Stuck

1. Check `docs/` for architecture decisions
2. Check `configs/` for configuration examples
3. Look at existing similar code before creating new patterns
4. Ask for clarification rather than guessing at requirements

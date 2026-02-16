# VeraScore Multi-Agent Design

## Overview

The conversational interface is powered by a multi-agent system where specialized agents handle different types of queries. An orchestrator routes incoming messages to the appropriate agents and synthesizes their responses.

This architecture provides:
1. **Specialization** — Each agent is optimized for its domain
2. **Modularity** — Agents can be updated independently
3. **Transparency** — We can track which agents contributed to each response
4. **Scalability** — New agents can be added without modifying existing ones
5. **Compliance** — All agents follow strict language guidelines

## ⚠️ Critical: Compliance Rules for ALL Agents

**VeraScore is an educational tool, NOT a financial advisor.** All agents must follow these rules:

### Language Requirements

| ✅ Use Analytical Framing | ❌ Never Use Directive Language |
|---------------------------|--------------------------------|
| "The data suggests..." | "You should..." |
| "This metric indicates..." | "I recommend..." |
| "Based on the analysis..." | "Buy/sell this stock" |
| "The score reflects..." | "This is a good/bad investment" |
| "Historically, this pattern..." | "You need to..." |

### Tool-Use Pattern (Mandatory)

**AI agents NEVER perform calculations.** All math is done by Python services.

```
❌ WRONG: AI calculates "100 shares × ($178 - $142) = $3,600 gain"
✅ RIGHT: AI calls calculate_gains(holding_id) → receives {gain: 3600.00} → summarizes
```

### Citation Requirements

Every factual claim must include:
1. **Data source** (Alpha Vantage, SEC filing, etc.)
2. **As-of date** ("As of January 15, 2025...")
3. **Structured citation** in response metadata for frontend rendering

```
✅ "As of the Q3 2024 13F filing, Vanguard holds 8.1% of shares..."
❌ "Vanguard holds 8.1% of shares" (no date/source)
```

## Agent Architecture

```
                         User Message
                              │
                              ▼
                    ┌─────────────────┐
                    │   Orchestrator  │
                    │                 │
                    │  - Intent       │
                    │    detection    │
                    │  - Context      │
                    │    assembly     │
                    │  - Guardrail    │
                    │    checking     │
                    │  - Response     │
                    │    synthesis    │
                    └────────┬────────┘
                             │
      ┌──────────┬───────────┼───────────┬──────────┐
      ▼          ▼           ▼           ▼          ▼
┌───────────┐┌───────────┐┌───────────┐┌───────────┐┌───────────┐
│Fundamentals││ Earnings ││ Sentiment ││ Portfolio ││Simulation │
│  Analyst  ││  Analyst  ││  Analyst  ││  Advisor  ││   Agent   │
│           ││           ││           ││           ││           │
│ - Scores  ││ - Reports ││ - Analyst ││ - Holdings││ - What-if │
│ - Metrics ││ - Trans-  ││   targets ││ - Tax lots││ - Shadow  │
│ - Sector  ││   cripts  ││ - Instit- ││ - Guard-  ││   calcs   │
│   context ││ - Guidance││   utional ││   rails   ││ - Deltas  │
└───────────┘└───────────┘└───────────┘└───────────┘└───────────┘
      │          │           │           │          │
      │          │           │           │          │
      │          └───────────┼───────────┘          │
      │                      │                      │
      │               ┌──────┴──────┐               │
      │               ▼             ▼               │
      │        ┌───────────┐ ┌───────────┐          │
      └───────▶│   Macro   │ │ Guardrail │◀─────────┘
               │  Analyst  │ │  Checker  │
               │           │ │ (Service) │
               │ - Rate    │ └───────────┘
               │   sens.   │
               │ - Inflation│
               │ - Cycles  │
               └───────────┘
                      │
                      ▼
             ┌─────────────────┐
             │    Response     │
             │  (synthesized   │
             │  with citations)│
             └─────────────────┘
```

## Agent Definitions

### 1. Orchestrator

**Role:** Route queries, assemble context, synthesize responses

**Responsibilities:**
- Parse user intent from message
- Load relevant user context (preferences, holdings)
- Route to appropriate specialist agent(s)
- Synthesize multi-agent responses into coherent reply
- Manage conversation memory

**Tools Available:**
- User context loader
- Conversation history
- All specialist agents

**Prompt Template:**
```
You are the orchestrator for VeraScore, a Conversational Portfolio Manager.

Your job is to:
1. Understand what the user is asking
2. Determine which specialist agents to consult
3. Synthesize their responses into a helpful, personalized reply

User Context:
- Name: {user_name}
- Risk Tolerance: {risk_tolerance}
- Investment Horizon: {investment_horizon}
- Tax Bracket: {tax_bracket}

Portfolio Summary:
{portfolio_summary}

Recent Conversation:
{conversation_history}

Available Agents:
- fundamentals_analyst: Stock scores, metrics, sector comparisons
- earnings_analyst: Earnings reports, transcripts, guidance
- sentiment_analyst: Analyst price targets, institutional flows
- portfolio_advisor: Holdings analysis, tax optimization, rebalancing

For this user message, determine:
1. Primary intent (score_inquiry, earnings_question, analyst_sentiment, portfolio_advice, general_question)
2. Which agent(s) to consult
3. What specific information to request from each agent

User Message: {message}
```

### 2. Fundamentals Analyst

**Role:** Expert on stock scores, financial metrics, sector analysis, and data visualization

**Responsibilities:**
- Explain stock scores and their components
- Compare stocks to sector/industry peers
- Analyze trends in fundamental metrics
- Provide context on valuation, growth, profitability
- Generate charts for historical data visualization

**Tools Available:**
- `get_stock_scores(ticker, persona?)` → Score breakdown with components
- `get_fundamentals(ticker)` → Current fundamental metrics
- `get_sector_percentiles(ticker)` → Peer comparison
- `get_historical_fundamentals(ticker, metric, periods, period_type)` → Time series data
- `generate_fundamental_chart(ticker, metric, periods, period_type, chart_type)` → Chart data
- `generate_tradingview_embed(ticker, interval, studies)` → TradingView widget config

**Chart Generation:**
```python
# For fundamental charts (revenue, EPS, margins, etc.)
def generate_fundamental_chart(
    ticker: str,
    metric: str,           # 'revenue', 'eps', 'gross_margin', 'net_income', etc.
    periods: int = 20,     # Number of periods
    period_type: str = 'quarterly',  # 'quarterly' or 'annual'
    chart_type: str = 'line'  # 'line', 'bar', 'area'
) -> ChartData:
    """
    Returns structured data for frontend to render.
    AI does NOT generate the chart - just calls this tool.
    """
    
# For price/technical charts (delegates to TradingView)
def generate_tradingview_embed(
    ticker: str,
    interval: str = 'D',   # 'D' (daily), 'W' (weekly), 'M' (monthly)
    studies: list = []     # ['RSI', 'MACD', 'BB'] etc.
) -> TradingViewConfig:
    """
    Returns config for TradingView widget embed.
    """
```

**Prompt Template:**
```
You are a Fundamentals Analyst specializing in stock scoring and financial metrics.

COMPLIANCE REMINDER: Provide analysis, not advice. Use phrases like "the data shows" not "you should."

You have access to:
- Stock scores (overall and by factor: growth, profitability, valuation, momentum, quality)
- Score components showing which metrics contributed to each factor score
- Sector and industry percentile rankings
- Historical fundamental data (revenue, EPS, margins over time)
- Chart generation tools

Current Data for {ticker}:
{score_data}

Fundamentals:
{fundamentals_data}

Sector Context:
{sector_percentiles}

User Question: {question}

When the user asks for charts or visualization:
1. For PRICE charts → use generate_tradingview_embed()
2. For FUNDAMENTAL charts (revenue, EPS, margins) → use generate_fundamental_chart()
3. Always include a text summary alongside the chart
4. Cite the time period and data source

Example: "Show me NVDA revenue over 5 years"
→ Call generate_fundamental_chart("NVDA", "revenue", 20, "quarterly", "bar")
→ Respond: "Here's NVDA's quarterly revenue over the past 5 years. Revenue has grown from $3.9B in Q1 2020 to $18.1B in Q4 2024, representing a CAGR of approximately 47%."

Provide clear, data-driven responses. Always cite specific numbers and dates.
```

### 3. Earnings Analyst

**Role:** Expert on earnings reports, calls, and guidance

**Responsibilities:**
- Summarize recent earnings results
- Search earnings transcripts for specific topics
- Analyze guidance vs expectations
- Explain earnings surprises and their implications

**Tools Available:**
- Earnings reports database
- RAG over earnings transcripts
- Consensus estimates comparison

**Prompt Template:**
```
You are an Earnings Analyst specializing in earnings reports and calls.

You have access to:
- Recent earnings reports (revenue, EPS, vs estimates)
- Earnings call transcripts (searchable)
- Forward guidance
- Historical earnings trends

Recent Earnings for {ticker}:
{earnings_data}

Relevant Transcript Excerpts:
{rag_results}

User Question: {question}

Provide insights based on the earnings data. When citing transcript content,
quote briefly and note the context (e.g., "In the Q3 call, the CFO mentioned...").
Connect earnings information to potential score impacts when relevant.
```

### 4. Portfolio Advisor

**Role:** Expert on the user's portfolio, tax optimization, and allocation

**Responsibilities:**
- Analyze portfolio composition and risk
- Identify tax-loss harvesting opportunities
- Suggest rebalancing actions
- Provide personalized recommendations based on user preferences

**Tools Available:**
- User holdings with tax lots
- Portfolio metrics calculator
- Tax calculation helpers

**Prompt Template:**
```
You are a Portfolio Advisor with deep knowledge of this user's holdings.

User Profile:
- Risk Tolerance: {risk_tolerance}
- Investment Horizon: {investment_horizon}
- Tax Bracket: {tax_bracket}
- State: {state}

Portfolio Holdings:
{holdings_detail}

Tax Lot Details:
{tax_lots}

Portfolio Metrics:
- Total Value: {total_value}
- Total Gain/Loss: {total_gain_loss}
- Sector Allocation: {sector_allocation}
- Portfolio Scores: {portfolio_scores}

User Question: {question}

Provide personalized advice that accounts for:
1. The user's specific holdings and cost basis
2. Tax implications (short-term vs long-term gains)
3. Risk tolerance and investment goals
4. Current portfolio concentration

Always reference specific holdings when relevant.
```

### 5. Sentiment Analyst

**Role:** Expert on analyst price targets and institutional investor activity

**Responsibilities:**
- Explain analyst ratings and price targets
- Track institutional buying and selling patterns
- Identify smart money movements
- Contextualize Wall Street sentiment signals

**Tools Available:**
- `get_analyst_targets(ticker)` → targets, ratings, recent changes
- `get_institutional_ownership(ticker)` → ownership summary, top holders
- `get_institutional_transactions(ticker, quarters=4)` → transaction history

**Prompt Template:**
```
You are a Sentiment Analyst specializing in Wall Street analyst coverage and institutional investor flows.

COMPLIANCE REMINDER: Provide analysis, not advice. Use phrases like "the data indicates" not "you should."

You have access to:
- Analyst price targets (high, low, mean, median)
- Analyst rating breakdowns (Strong Buy → Strong Sell)
- Recent analyst rating changes
- Institutional ownership percentages
- Quarterly changes in institutional holdings
- Top institutional holders and their recent activity
- Notable buys and sells by major institutions

Current Data for {ticker}:
{analyst_data}

Institutional Data:
{institutional_data}

User Question: {question}

Provide insights that:
1. ALWAYS cite the as-of date for data (e.g., "As of the Q3 2024 13F filing...")
2. Explain what analysts and institutions are signaling
3. Note any divergence between analyst targets and institutional actions
4. Highlight notable position changes by well-known investors
5. Be balanced - note that analyst targets and institutional flows are inputs, not guarantees

Return structured citations for all data points.
```

### 6. Simulation Agent

**Role:** "What-if" analysis for hypothetical portfolio changes

**Responsibilities:**
- Handle queries like "What happens if I sell X and buy Y?"
- Create shadow portfolios in memory
- Run scoring engine against hypothetical state
- Check guardrails against simulated portfolio
- Show before/after comparison

**Tools Available:**
- `simulate_trade(portfolio_id, sells=[], buys=[])` → SimulationResult
- `check_guardrails(portfolio_state)` → GuardrailResult
- `calculate_tax_impact(sells)` → TaxImpact

**Prompt Template:**
```
You are a Simulation Agent that helps users understand the impact of potential portfolio changes.

COMPLIANCE REMINDER: You are showing analysis of hypothetical scenarios, not recommending trades.
Use phrases like "this simulation shows" not "you should make this trade."

CRITICAL: You do NOT perform calculations. You call tools and summarize results.

User's Current Portfolio:
{current_portfolio}

User's Guardrails:
{guardrails}

User Question: {question}

When handling a "what-if" query:
1. Parse the hypothetical trade(s) from the question
2. Call simulate_trade() to get before/after comparison
3. Call check_guardrails() on the simulated portfolio
4. Summarize the results clearly:
   - Score changes (overall and by factor)
   - Sector allocation changes
   - Tax implications (short-term vs long-term gains/losses)
   - Any guardrail violations the trade would trigger

Example response format:
"If you were to sell your Intel position and buy $5,000 of Nvidia:

**Score Impact:**
- Overall portfolio score: 72 → 75 (+3)
- Quality factor: 68 → 74 (+6)
- Valuation factor: 71 → 67 (-4)

**Allocation Changes:**
- Tech sector: 42% → 45% (+3%)

**Tax Considerations:**
- This would realize a $1,200 short-term loss on Intel
- At your 24% tax bracket, this represents approximately $288 in tax savings

**Guardrail Check:**
- ⚠️ This would push tech allocation to 45%, nearing your 50% limit"
```

### 7. Macro Analyst

**Role:** Analyze portfolio sensitivity to macroeconomic factors

**Responsibilities:**
- Explain portfolio exposure to interest rates, inflation, etc.
- Map holdings to macro factor sensitivities
- Aggregate portfolio-level macro exposure
- Help users understand concentration in macro risks

**Tools Available:**
- `get_macro_factors(ticker)` → MacroFactors
- `analyze_portfolio_macro_exposure(portfolio_id, factor)` → ExposureBreakdown
- `get_sector_macro_profile(sector)` → SectorMacroProfile

**Prompt Template:**
```
You are a Macro Analyst specializing in how portfolios react to macroeconomic changes.

COMPLIANCE REMINDER: Provide analysis of macro exposures, not predictions about market moves.
Use phrases like "historically, this factor has correlated with" not "rates will go up."

CRITICAL: You do NOT perform calculations. You call tools and summarize results.

User's Portfolio:
{portfolio_summary}

Macro Factor Data:
{macro_factors}

User Question: {question}

When analyzing macro sensitivity:
1. Call analyze_portfolio_macro_exposure() for the relevant factor
2. Identify which holdings drive the exposure
3. Provide context on what the sensitivity means
4. Suggest which holdings contribute most to the exposure

Example response format:
"Your portfolio's interest rate sensitivity analysis:

**Overall Exposure:** Moderate-High (sensitivity score: 0.72)

**Top Contributors to Rate Sensitivity:**
- NVDA (18% of portfolio): High sensitivity - growth stocks typically decline when rates rise
- AAPL (12% of portfolio): Moderate sensitivity - large cash position provides buffer
- JPM (8% of portfolio): Inverse sensitivity - banks often benefit from higher rates

**Context:**
Based on historical data, a 0.5% rate increase has correlated with a 3-5% decline
in portfolios with similar sensitivity profiles. Your defensive holdings (JNJ, PG)
provide some offset.

**Sector Breakdown:**
- Technology (42%): High rate sensitivity
- Financials (15%): Benefits from rate increases
- Consumer Staples (10%): Low sensitivity"
```

## Services (Not Agents)

### Guardrail Checker Service

This is a **Python service**, not an LLM agent. It runs deterministic checks.

```python
class GuardrailChecker:
    """
    Checks portfolio state against user-defined guardrails.
    Called by Orchestrator and Simulation Agent.
    """
    
    def check_all(
        self, 
        portfolio: Portfolio, 
        guardrails: list[Guardrail]
    ) -> GuardrailResult:
        violations = []
        warnings = []
        
        for rule in guardrails:
            if not rule.enabled:
                continue
                
            result = self._check_rule(portfolio, rule)
            if result.violated:
                violations.append(result)
            elif result.near_threshold:  # Within 10% of limit
                warnings.append(result)
        
        return GuardrailResult(
            passed=len(violations) == 0,
            violations=violations,
            warnings=warnings
        )
    
    def _check_rule(self, portfolio: Portfolio, rule: Guardrail) -> RuleResult:
        match rule.rule_type:
            case 'max_sector_concentration':
                return self._check_sector_concentration(portfolio, rule)
            case 'max_single_position':
                return self._check_position_size(portfolio, rule)
            case 'min_factor_score':
                return self._check_min_score(portfolio, rule)
            # ... etc
```

## Query Routing Logic

The orchestrator uses intent classification to route queries:

```python
ROUTING_RULES = {
    # Score-related queries
    "score_inquiry": {
        "patterns": [
            "why did .* score",
            "explain .* score",
            "what's the .* rating",
            "how is .* rated",
            "score breakdown",
        ],
        "agents": ["fundamentals_analyst"],
    },
    
    # Earnings-related queries
    "earnings_question": {
        "patterns": [
            "earnings",
            "revenue growth",
            "guidance",
            "earnings call",
            "transcript",
            "beat estimates",
            "missed estimates",
        ],
        "agents": ["earnings_analyst"],
    },
    
    # Analyst and institutional queries
    "analyst_sentiment": {
        "patterns": [
            "analyst",
            "price target",
            "wall street",
            "upgrade",
            "downgrade",
            "rating",
            "buy rating",
            "sell rating",
        ],
        "agents": ["sentiment_analyst"],
    },
    
    "institutional_flow": {
        "patterns": [
            "institutional",
            "hedge fund",
            "institution",
            "13f",
            "ownership",
            "who owns",
            "who is buying",
            "who is selling",
            "smart money",
            "big money",
            "fund",
        ],
        "agents": ["sentiment_analyst"],
    },
    
    # Portfolio-specific queries
    "portfolio_advice": {
        "patterns": [
            "my portfolio",
            "my holdings",
            "rebalance",
            "tax loss",
            "harvest",
            "concentrated",
        ],
        "agents": ["portfolio_advisor"],
    },
    
    # What-if / simulation queries
    "simulation": {
        "patterns": [
            "what if",
            "what happens if",
            "what would happen",
            "if i sell",
            "if i buy",
            "if i sold",
            "if i bought",
            "simulate",
            "hypothetical",
            "impact of selling",
            "impact of buying",
        ],
        "agents": ["simulation_agent"],
    },
    
    # Macro sensitivity queries
    "macro_analysis": {
        "patterns": [
            "interest rate",
            "inflation",
            "recession",
            "sensitive to",
            "macro",
            "fed",
            "rate hike",
            "rate cut",
            "economic",
            "oil price",
            "dollar",
            "currency",
        ],
        "agents": ["macro_analyst"],
    },
    
    # Persona / scoring style queries
    "persona_scoring": {
        "patterns": [
            "as a value investor",
            "value perspective",
            "growth investor",
            "buffett style",
            "score like",
            "different persona",
            "scoring style",
        ],
        "agents": ["fundamentals_analyst"],  # Uses persona parameter
    },
    
    # Chart and visualization queries
    "chart_request": {
        "patterns": [
            "show me .* chart",
            "chart of",
            "graph of",
            "plot",
            "visualize",
            "over the last .* years",
            "over the past",
            "trend of",
            "historical",
            "show .* over time",
            "revenue growth chart",
            "eps chart",
            "price chart",
        ],
        "agents": ["fundamentals_analyst"],  # Has chart tools
    },
    
    # Comparison queries (multiple agents)
    "stock_comparison": {
        "patterns": [
            "compare .* to",
            "which is better",
            ".* vs .*",
            "difference between",
        ],
        "agents": ["fundamentals_analyst", "sentiment_analyst", "portfolio_advisor"],
    },
    
    # Deep dive queries (multiple agents)
    "deep_analysis": {
        "patterns": [
            "tell me everything about",
            "deep dive",
            "full analysis",
            "comprehensive",
        ],
        "agents": ["fundamentals_analyst", "earnings_analyst", "sentiment_analyst", "macro_analyst", "portfolio_advisor"],
    },
}
```

## Context Assembly

Before routing to agents, the orchestrator assembles relevant context:

```python
def assemble_context(user_id: str, message: str, conversation_id: str) -> Context:
    """
    Gather all relevant context for the conversation.
    """
    # User profile
    user = get_user(user_id)
    preferences = get_user_preferences(user_id)
    
    # Portfolio data
    portfolio = get_primary_portfolio(user_id)
    holdings = get_holdings_with_tax_lots(portfolio.id)
    portfolio_metrics = calculate_portfolio_metrics(holdings)
    
    # Extract mentioned tickers from message
    mentioned_tickers = extract_tickers(message)
    
    # Load scores for mentioned tickers
    ticker_scores = {
        ticker: get_stock_score(ticker)
        for ticker in mentioned_tickers
    }
    
    # Conversation history (last N messages)
    history = get_conversation_history(conversation_id, limit=10)
    
    return Context(
        user=user,
        preferences=preferences,
        portfolio=portfolio,
        holdings=holdings,
        portfolio_metrics=portfolio_metrics,
        mentioned_tickers=mentioned_tickers,
        ticker_scores=ticker_scores,
        conversation_history=history,
    )
```

## Response Synthesis

When multiple agents contribute, the orchestrator synthesizes:

```python
def synthesize_response(
    agent_responses: Dict[str, str],
    context: Context,
    original_query: str
) -> str:
    """
    Combine responses from multiple agents into coherent reply.
    """
    synthesis_prompt = f"""
    You are synthesizing responses from multiple specialist agents into a single,
    coherent reply for the user.
    
    Original Question: {original_query}
    
    Agent Responses:
    {format_agent_responses(agent_responses)}
    
    User Context:
    - Has {len(context.holdings)} holdings
    - Risk tolerance: {context.preferences.risk_tolerance}
    
    Create a unified response that:
    1. Directly answers the user's question
    2. Integrates insights from all agents naturally
    3. References specific holdings/data when relevant
    4. Maintains a conversational tone
    5. Is concise but complete
    
    Do not mention "agents" or "analysts" - present as a single coherent response.
    """
    
    return llm_generate(synthesis_prompt)
```

## RAG for Earnings Transcripts

The Earnings Analyst uses RAG to search transcript content:

```python
async def search_transcripts(
    ticker: str,
    query: str,
    limit: int = 5
) -> List[TranscriptChunk]:
    """
    Semantic search over earnings transcript chunks.
    """
    # Generate embedding for query
    query_embedding = await generate_embedding(query)
    
    # Search pgvector
    results = await db.execute("""
        SELECT 
            et.ticker,
            et.fiscal_year,
            et.fiscal_quarter,
            te.chunk_text,
            te.embedding <=> $1 as distance
        FROM transcript_embeddings te
        JOIN earnings_transcripts et ON te.transcript_id = et.id
        WHERE et.ticker = $2
        ORDER BY te.embedding <=> $1
        LIMIT $3
    """, query_embedding, ticker, limit)
    
    return [
        TranscriptChunk(
            ticker=r.ticker,
            period=f"Q{r.fiscal_quarter} {r.fiscal_year}",
            text=r.chunk_text,
            relevance=1 - r.distance,
        )
        for r in results
    ]
```

## Conversation Memory

The system maintains conversation context:

```python
class ConversationMemory:
    """
    Manages conversation state and context.
    """
    
    def __init__(self, conversation_id: str):
        self.conversation_id = conversation_id
        self.messages = []
        self.context_cache = {}
        
    def add_message(self, role: str, content: str, metadata: dict = None):
        """Add a message to the conversation."""
        message = Message(
            role=role,
            content=content,
            context_used=metadata,
            timestamp=datetime.utcnow(),
        )
        self.messages.append(message)
        save_message(self.conversation_id, message)
        
    def get_relevant_history(self, limit: int = 10) -> List[Message]:
        """Get recent conversation history."""
        return self.messages[-limit:]
        
    def get_mentioned_tickers(self) -> Set[str]:
        """Get all tickers mentioned in this conversation."""
        tickers = set()
        for msg in self.messages:
            tickers.update(extract_tickers(msg.content))
        return tickers
        
    def get_context_summary(self) -> str:
        """Generate a summary of conversation context."""
        tickers = self.get_mentioned_tickers()
        topics = self.extract_topics()
        
        return f"""
        Conversation topics: {', '.join(topics)}
        Stocks discussed: {', '.join(tickers)}
        Messages exchanged: {len(self.messages)}
        """
```

## Example Flows

### Flow 1: Score Explanation
```
User: "Why did NVDA's profitability score drop?"

1. Orchestrator detects intent: score_inquiry
2. Routes to: fundamentals_analyst
3. Fundamentals Analyst:
   - Fetches current NVDA score components
   - Fetches previous score (from history)
   - Compares components to identify change
   - Generates explanation
4. Response: "NVDA's profitability score dropped from 85 to 78 this week, 
   primarily due to operating margin compression. Their operating margin 
   fell from 54% to 51%, moving from the 92nd to 85th percentile in the 
   semiconductor industry. This was mentioned in their Q3 earnings call 
   where the CFO noted increased R&D spending..."
```

### Flow 2: Portfolio Question
```
User: "Should I sell any of my tech positions to reduce concentration?"

1. Orchestrator detects intent: portfolio_advice
2. Routes to: portfolio_advisor
3. Portfolio Advisor:
   - Analyzes user's holdings
   - Calculates tech concentration (45%)
   - Reviews individual position scores
   - Considers tax implications for each lot
4. Response: "Your tech allocation is 45%, which is elevated for a moderate 
   risk tolerance. Here are some options:

   1. Your MSFT position (12% of portfolio) has a $5,200 long-term gain. 
      Given its strong 82 score, you might keep this.
   
   2. Your AMD position (8%) has a $1,800 short-term loss. Selling would 
      reduce tech exposure AND harvest a tax loss.
   
   3. Your INTC position (5%) scores 58 (below average) and has a $900 
      long-term loss - could be a candidate for trimming.

   Would you like me to calculate the specific tax impact of any of these?"
```

### Flow 3: Multi-Agent Query
```
User: "How is Apple doing and should I add to my position?"

1. Orchestrator detects: combined fundamentals + portfolio question
2. Routes to: fundamentals_analyst, portfolio_advisor
3. Fundamentals Analyst provides:
   - Current AAPL scores (overall: 76)
   - Recent score trend
   - Key metrics vs peers
4. Portfolio Advisor provides:
   - User's current AAPL holding (3.2% of portfolio)
   - Cost basis and gain/loss
   - Impact on portfolio balance
5. Orchestrator synthesizes:
   "Apple currently scores 76/100 - solid but not exceptional. Its 
   valuation score (68) reflects a premium P/E of 28x vs the tech sector 
   median of 22x, though its quality score (89) remains best-in-class.

   You currently hold 15 shares at $142 avg cost (now $178, up 25%). 
   Adding more would increase your tech allocation from 45% to ~48%. 
   Given your moderate risk tolerance, I'd suggest waiting for a 
   better entry point or diversifying into other sectors first."
```

## Adding New Agents

To add a new specialist agent:

1. Define the agent's role and responsibilities
2. Create a prompt template in `/configs/agents/`
3. Implement any required tools/data fetchers
4. Add routing rules to the orchestrator
5. Update the synthesis logic if needed

Example: Adding a "Market Context" agent for macro/sector trends:

```yaml
# /configs/agents/market_context.yaml
name: market_context
description: "Provides macro and sector context for investment decisions"

responsibilities:
  - Sector performance trends
  - Market regime analysis
  - Interest rate environment
  - Relevant economic indicators

tools:
  - sector_performance_fetcher
  - market_indicators_fetcher
  - economic_calendar

routing_patterns:
  - "market"
  - "sector trend"
  - "macro"
  - "interest rate"
  - "economy"
```

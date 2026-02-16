# Project Overview: VeraScore

## Vision

Build **VeraScore** — a Conversational Portfolio Manager that combines quantitative stock scoring (similar to Ziggma) with an AI chat interface that has memory of the user's specific holdings, tax lots, and risk tolerance.

Unlike traditional stock screening dashboards that passively display scores, this product enables users to have intelligent conversations about their portfolio — asking "Why did my portfolio's score drop?" or "What would happen if I sold my Intel position?" and receiving personalized, context-aware analysis.

## ⚠️ Compliance: Educational Tool, NOT Financial Advisor

**VeraScore is an educational and analytical tool. It does NOT provide financial advice.**

All AI responses must:
- Provide **analysis**, not recommendations
- Use analytical framing, not directive language
- Include data citations with dates and sources
- Display standard disclaimers

| ✅ Acceptable Language | ❌ Never Say |
|------------------------|--------------|
| "This stock's valuation is high compared to peers" | "You should sell this stock" |
| "Your portfolio has 45% concentration in tech" | "I recommend reducing your tech exposure" |
| "Analysts have a mean target suggesting 11% upside" | "This is a good investment for you" |
| "Selling this position would result in a $2,000 short-term gain" | "You should sell to lock in profits" |
| "Based on your guardrails, this trade would exceed your sector limit" | "Don't make this trade" |

**Standard Disclaimer (displayed in UI):**
> VeraScore provides educational analysis and information only. It is not a registered investment advisor and does not provide personalized investment advice. All investment decisions are your own. Past performance does not guarantee future results. Consult a qualified financial advisor for personal advice.

## The Problem

Existing stock scoring/grading tools (Ziggma, Simply Wall St, Stock Rover) provide useful quantitative analysis but suffer from:

1. **Passive consumption** — Users see scores but can't interrogate the reasoning
2. **Generic advice** — No awareness of user's specific tax situation, cost basis, or risk tolerance
3. **No conversational interface** — Can't ask follow-up questions or explore "what if" scenarios
4. **Black box scoring** — Limited transparency into why a stock received a particular grade

## The Solution

A web application that provides:

1. **AI-Generated Stock Scores** — Comprehensive ratings across Growth, Profitability, Valuation, Momentum, and Quality factors
2. **Analyst & Institutional Signals** — Price targets from Wall Street analysts and institutional buying/selling activity
3. **Portfolio Health Dashboard** — Visual representation of portfolio-level scores and risk metrics
4. **Conversational Interface** — Chat with an AI that knows your holdings, tax lots, and preferences
5. **Transparent Reasoning** — Every score comes with explainable factors; users can drill down via conversation
6. **Tax-Aware Insights** — Suggestions that consider cost basis, holding periods, and tax implications

## Key Differentiators

### 1. Conversational Context
The AI maintains awareness of:
- Every holding in the user's portfolio with purchase dates and cost basis
- User's stated risk tolerance and investment horizon
- Previous conversations and expressed preferences
- Tax bracket and relevant tax considerations

### 2. Transparent, Configurable Scoring
- Every score is explainable down to individual metrics
- Users can ask "Why did NVDA score 72 on valuation?" and get specific answers
- Scoring methodology is configuration-driven, making it easy to adjust weights and add new metrics

### 3. Tax-Lot Intelligence
Unlike generic recommendations, the system understands:
- Which specific lots have gains vs losses
- Short-term vs long-term capital gains implications
- Tax-loss harvesting opportunities specific to the user's situation

### 4. Research-Backed Insights
- Earnings transcripts and reports are searchable via RAG
- AI can cite specific quotes from earnings calls when explaining scores
- Fundamental data is always current and sourced transparently

### 5. Analyst & Institutional Intelligence
- Aggregated analyst price targets with consensus, high, and low estimates
- Upside/downside potential relative to current price
- Institutional ownership tracking (hedge funds, mutual funds, etc.)
- Recent institutional buys and sells with position size changes
- Smart money flow signals to complement fundamental analysis

### 6. "What-If" Simulation
- Ask "What happens if I sell Intel and buy Nvidia?"
- System runs shadow portfolio calculations
- Shows before/after comparison: scores, allocation, tax impact
- No actual trades — pure decision support

### 7. Personal Guardrails
- Users set rules: "No sector > 15%", "Quality score must stay > 60"
- System checks guardrails on every portfolio change
- Simulations flag guardrail violations before you act
- Turns AI into a proactive compliance officer for your own rules

### 8. Scoring Personas
- Not everyone defines "good" the same way
- Switch between perspectives: Value Investor, Growth Investor, Buffett Style, etc.
- Ask "Score NVDA as a value investor" to see different weightings
- Each persona is a different YAML config with adjusted factor weights

### 9. Macro Sensitivity Analysis
- Understand how your portfolio reacts to external shocks
- Ask "How sensitive is my portfolio to interest rate hikes?"
- See which holdings drive exposure to specific macro factors

### 10. Mechanical Trust (Verifiable Citations)
- Every factual claim in AI responses is verifiable
- Hover over any number to see source, date, and raw data
- Click to see full context (transcript excerpt, data table)
- Users trust the data, not the AI's "opinion"

## Target Users (MVP)

**Primary: Self-directed retail investors** who:
- Manage their own portfolios (not using a financial advisor)
- Have intermediate investment knowledge
- Want data-driven insights but also want to understand the "why"
- Value tax efficiency in their investment decisions
- Prefer conversation over dashboard-clicking

## Product Principles

1. **Analysis over advice** — Provide information, never investment recommendations
2. **Transparency over black boxes** — Every score and claim must be explainable and verifiable
3. **Personalization over generic** — Analysis accounts for the user's specific holdings and situation
4. **Conversation over dashboards** — The chat is the primary interface, not an afterthought
5. **Configuration over code** — Scoring logic adjustable without engineering changes
6. **Progressive disclosure** — Summary first, details on demand
7. **Tool-use over AI math** — All calculations done by verified services, AI only summarizes
8. **Data freshness matters** — Always cite when data was last updated

## Success Metrics (MVP)

- Users can add their portfolio and see scores within 5 minutes
- Chat responses reference user's specific holdings accurately
- Score explanations cite specific metrics and data points
- Users return to chat multiple times (not just view dashboard once)

## Scope Boundaries (MVP)

### In Scope
- US stocks only
- Manual portfolio entry + CSV import/export
- Five scoring factors: Growth, Profitability, Valuation, Momentum, Quality
- Basic chat with portfolio context
- Score explanations via conversation

### Out of Scope (Future)
- Brokerage integration (Plaid)
- International stocks, ETFs, mutual funds, crypto
- Options analysis
- Real-time alerts/notifications
- Mobile native apps (web-responsive only for MVP)
- Multi-user/advisor features

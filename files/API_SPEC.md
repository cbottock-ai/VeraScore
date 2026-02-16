# VeraScore API Specification

## Overview

RESTful API built with FastAPI. All endpoints return JSON. Authentication via Supabase JWT tokens.

**Base URL:** `http://localhost:8000` (dev) / `https://api.verascore.com` (prod)

---

## Authentication

All endpoints except `/auth/*` and `/stocks/search` require authentication.

**Header:** `Authorization: Bearer <jwt_token>`

### Endpoints

#### POST /auth/register
Create a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "created_at": "2024-01-15T10:30:00Z"
}
```

#### POST /auth/login
Authenticate and receive JWT token.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response:** `200 OK`
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "expires_in": 3600,
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  }
}
```

#### GET /auth/me
Get current user profile.

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "display_name": "John Doe",
  "preferences": {
    "risk_tolerance": "moderate",
    "investment_horizon": "medium_term",
    "tax_bracket": "24%"
  },
  "created_at": "2024-01-15T10:30:00Z"
}
```

---

## Stocks

#### GET /stocks/search
Search stocks by name or ticker.

**Query Parameters:**
- `q` (required): Search query (min 1 character)
- `limit` (optional): Max results (default: 10, max: 50)

**Response:** `200 OK`
```json
{
  "results": [
    {
      "ticker": "AAPL",
      "name": "Apple Inc.",
      "sector": "Technology",
      "exchange": "NASDAQ"
    },
    {
      "ticker": "AAPD",
      "name": "Direxion Daily AAPL Bear 1X Shares",
      "sector": "Financial Services",
      "exchange": "NASDAQ"
    }
  ]
}
```

#### GET /stocks/{ticker}
Get stock details.

**Response:** `200 OK`
```json
{
  "ticker": "AAPL",
  "name": "Apple Inc.",
  "sector": "Technology",
  "industry": "Consumer Electronics",
  "exchange": "NASDAQ",
  "market_cap": 2850000000000,
  "current_price": 178.50,
  "price_change_1d": 0.0234,
  "price_change_1d_pct": 1.32
}
```

**Error:** `404 Not Found`
```json
{
  "detail": "Stock 'INVALID' not found"
}
```

#### GET /stocks/{ticker}/fundamentals
Get fundamental metrics for a stock.

**Response:** `200 OK`
```json
{
  "ticker": "AAPL",
  "valuation": {
    "pe_ttm": 28.5,
    "pe_forward": 26.2,
    "ps_ttm": 7.8,
    "pb_ratio": 45.2,
    "peg_ratio": 2.1,
    "ev_to_ebitda": 22.4,
    "fcf_yield": 0.038
  },
  "growth": {
    "revenue_growth_yoy": 0.082,
    "revenue_growth_3y_cagr": 0.112,
    "eps_growth_yoy": 0.095,
    "eps_growth_3y_cagr": 0.134
  },
  "profitability": {
    "gross_margin": 0.438,
    "operating_margin": 0.298,
    "net_margin": 0.253,
    "roe": 1.47,
    "roic": 0.562
  },
  "quality": {
    "current_ratio": 0.94,
    "debt_to_equity": 1.81,
    "interest_coverage": 29.4
  },
  "momentum": {
    "price_change_1m": 0.045,
    "price_change_3m": 0.082,
    "price_change_6m": 0.156,
    "price_change_1y": 0.234,
    "relative_strength": 62.5
  },
  "fetched_at": "2024-01-15T08:00:00Z"
}
```

#### GET /stocks/{ticker}/fundamentals/history
Get historical fundamental data for charting.

**Query Parameters:**
- `metric` (required): Metric to retrieve (`revenue`, `eps`, `gross_margin`, `net_income`, `operating_margin`, `free_cash_flow`)
- `periods` (optional): Number of periods (default: 20, max: 40)
- `period_type` (optional): `quarterly` or `annual` (default: quarterly)

**Response:** `200 OK`
```json
{
  "ticker": "NVDA",
  "metric": "revenue",
  "period_type": "quarterly",
  "data": [
    {
      "period": "Q1 2020",
      "fiscal_year": 2020,
      "fiscal_quarter": 1,
      "period_end_date": "2020-04-26",
      "value": 3080000000
    },
    {
      "period": "Q2 2020",
      "fiscal_year": 2020,
      "fiscal_quarter": 2,
      "period_end_date": "2020-07-26",
      "value": 3866000000
    }
  ],
  "metadata": {
    "currency": "USD",
    "scale": "absolute",
    "format_hint": "currency_billions"
  },
  "source": "Alpha Vantage",
  "fetched_at": "2024-01-15T08:00:00Z"
}
```

#### GET /stocks/{ticker}/chart/config
Get TradingView widget configuration for a stock.

**Query Parameters:**
- `interval` (optional): Chart interval - `1`, `5`, `15`, `30`, `60`, `D`, `W`, `M` (default: D)
- `studies` (optional): Comma-separated list of studies (e.g., `RSI,MACD,BB`)

**Response:** `200 OK`
```json
{
  "widget": "tradingview",
  "config": {
    "symbol": "NASDAQ:NVDA",
    "interval": "D",
    "timezone": "America/New_York",
    "theme": "light",
    "style": "1",
    "studies": ["RSI@tv-basicstudies", "MACD@tv-basicstudies"],
    "allow_symbol_change": false,
    "hide_side_toolbar": false,
    "withdateranges": true
  }
}
```

#### GET /stocks/{ticker}/scores
Get AI-generated scores for a stock.

**Query Parameters:**
- `profile_id` (optional): Scoring profile to use (default: system default)
- `refresh` (optional): Force recalculation (default: false)

**Response:** `200 OK`
```json
{
  "ticker": "AAPL",
  "overall_score": 76,
  "factors": {
    "growth": {
      "score": 72,
      "weight": 0.20,
      "components": [
        {
          "metric_id": "revenue_growth_3y",
          "label": "3-Year Revenue CAGR",
          "raw_value": 0.112,
          "score": 75,
          "percentile": 72,
          "weight": 0.30
        },
        {
          "metric_id": "eps_growth_3y",
          "label": "3-Year EPS CAGR",
          "raw_value": 0.134,
          "score": 78,
          "percentile": 76,
          "weight": 0.25
        }
      ],
      "explanation": "Growth Score: 72/100. Solid growth metrics. Revenue growing 11.2% annually, outpacing 72% of Technology sector peers."
    },
    "profitability": {
      "score": 89,
      "weight": 0.20,
      "components": [ /* ... */ ],
      "explanation": "..."
    },
    "valuation": {
      "score": 58,
      "weight": 0.25,
      "components": [ /* ... */ ],
      "explanation": "..."
    },
    "momentum": {
      "score": 74,
      "weight": 0.15,
      "components": [ /* ... */ ],
      "explanation": "..."
    },
    "quality": {
      "score": 82,
      "weight": 0.20,
      "components": [ /* ... */ ],
      "explanation": "..."
    }
  },
  "profile_used": "default",
  "calculated_at": "2024-01-15T10:30:00Z"
}
```

#### GET /stocks/{ticker}/analyst-targets
Get analyst price targets and ratings.

**Response:** `200 OK`
```json
{
  "ticker": "AAPL",
  "current_price": 178.50,
  "targets": {
    "high": 250.00,
    "low": 140.00,
    "mean": 198.75,
    "median": 195.00
  },
  "upside_potential": 0.1134,
  "ratings_breakdown": {
    "strong_buy": 12,
    "buy": 18,
    "hold": 8,
    "sell": 2,
    "strong_sell": 0,
    "total": 40
  },
  "consensus_rating": "Buy",
  "recent_changes": [
    {
      "analyst": "John Smith",
      "firm": "Morgan Stanley",
      "rating": "Overweight",
      "price_target": 210.00,
      "previous_target": 195.00,
      "date": "2024-01-10"
    },
    {
      "analyst": "Jane Doe",
      "firm": "Goldman Sachs",
      "rating": "Buy",
      "price_target": 205.00,
      "previous_target": 200.00,
      "date": "2024-01-08"
    }
  ],
  "fetched_at": "2024-01-15T08:00:00Z"
}
```

#### GET /stocks/{ticker}/institutional
Get institutional ownership and flows.

**Query Parameters:**
- `include_holders` (optional): Include top holders list (default: true)
- `limit` (optional): Number of top holders to return (default: 20)

**Response:** `200 OK`
```json
{
  "ticker": "AAPL",
  "ownership_summary": {
    "institutional_ownership_pct": 0.6142,
    "institutional_holders_count": 5842,
    "shares_held": 9876543210,
    "market_value": 1762345678900
  },
  "quarterly_change": {
    "shares_change": 125000000,
    "shares_change_pct": 0.0128,
    "holders_change": 42,
    "net_flow": "Buying",
    "reporting_period": "2023-12-31"
  },
  "flow_summary": {
    "new_positions": 156,
    "added_positions": 2341,
    "reduced_positions": 1876,
    "sold_out_positions": 98,
    "net_buyers": 523
  },
  "top_holders": [
    {
      "holder_name": "Vanguard Group Inc",
      "holder_type": "Mutual Fund",
      "shares_held": 1234567890,
      "market_value": 220345678900,
      "ownership_pct": 0.0812,
      "shares_change": 5678900,
      "shares_change_pct": 0.0046,
      "change_type": "Added"
    },
    {
      "holder_name": "Blackrock Inc",
      "holder_type": "ETF",
      "shares_held": 987654321,
      "market_value": 176234567800,
      "ownership_pct": 0.0651,
      "shares_change": -2345678,
      "shares_change_pct": -0.0024,
      "change_type": "Reduced"
    }
  ],
  "notable_transactions": [
    {
      "holder_name": "Berkshire Hathaway",
      "holder_type": "Hedge Fund",
      "transaction_type": "Added",
      "shares_transacted": 12345678,
      "transaction_value": 2203456780,
      "shares_after": 98765432,
      "reporting_period": "2023-12-31"
    }
  ],
  "fetched_at": "2024-01-15T08:00:00Z"
}
```

#### GET /stocks/{ticker}/institutional/history
Get institutional transaction history over time.

**Query Parameters:**
- `quarters` (optional): Number of quarters to include (default: 4)
- `holder` (optional): Filter by specific holder name

**Response:** `200 OK`
```json
{
  "ticker": "AAPL",
  "history": [
    {
      "period": "2023-Q4",
      "reporting_date": "2023-12-31",
      "total_institutional_shares": 9876543210,
      "shares_change": 125000000,
      "new_positions": 156,
      "sold_out_positions": 98,
      "net_flow": "Buying"
    },
    {
      "period": "2023-Q3",
      "reporting_date": "2023-09-30",
      "total_institutional_shares": 9751543210,
      "shares_change": -45000000,
      "new_positions": 134,
      "sold_out_positions": 167,
      "net_flow": "Selling"
    }
  ]
}
```

---

## Portfolios

#### GET /portfolios
List user's portfolios.

**Response:** `200 OK`
```json
{
  "portfolios": [
    {
      "id": "uuid",
      "name": "My Portfolio",
      "is_primary": true,
      "holdings_count": 12,
      "total_value": 125430.50,
      "total_gain_loss": 18250.00,
      "total_gain_loss_pct": 0.1702,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### POST /portfolios
Create a new portfolio.

**Request:**
```json
{
  "name": "Retirement Account",
  "description": "Long-term holdings"
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "name": "Retirement Account",
  "description": "Long-term holdings",
  "is_primary": false,
  "created_at": "2024-01-15T10:30:00Z"
}
```

#### GET /portfolios/{id}
Get portfolio details with metrics.

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "name": "My Portfolio",
  "description": null,
  "is_primary": true,
  "metrics": {
    "total_value": 125430.50,
    "total_cost_basis": 107180.50,
    "total_gain_loss": 18250.00,
    "total_gain_loss_pct": 0.1702,
    "scores": {
      "overall": 74,
      "growth": 71,
      "profitability": 78,
      "valuation": 65,
      "momentum": 72,
      "quality": 80
    },
    "sector_allocation": {
      "Technology": 0.45,
      "Healthcare": 0.20,
      "Financial Services": 0.15,
      "Consumer Cyclical": 0.12,
      "Other": 0.08
    },
    "top_holding_pct": 0.18,
    "top_5_holdings_pct": 0.62
  },
  "holdings_count": 12,
  "created_at": "2024-01-01T00:00:00Z"
}
```

#### PUT /portfolios/{id}
Update portfolio details.

**Request:**
```json
{
  "name": "Updated Name",
  "is_primary": true
}
```

**Response:** `200 OK`

#### DELETE /portfolios/{id}
Delete a portfolio and all holdings.

**Response:** `204 No Content`

---

## Holdings

#### GET /portfolios/{id}/holdings
List holdings in a portfolio.

**Response:** `200 OK`
```json
{
  "holdings": [
    {
      "id": "uuid",
      "ticker": "AAPL",
      "name": "Apple Inc.",
      "shares": 100,
      "cost_basis": 14200.00,
      "cost_per_share": 142.00,
      "purchase_date": "2023-06-15",
      "current_price": 178.50,
      "current_value": 17850.00,
      "gain_loss": 3650.00,
      "gain_loss_pct": 0.2570,
      "is_long_term": true,
      "holding_period_days": 214,
      "scores": {
        "overall": 76,
        "growth": 72,
        "profitability": 89,
        "valuation": 58,
        "momentum": 74,
        "quality": 82
      },
      "weight_in_portfolio": 0.142
    }
  ],
  "summary": {
    "total_holdings": 12,
    "total_value": 125430.50,
    "total_cost_basis": 107180.50
  }
}
```

#### POST /portfolios/{id}/holdings
Add a holding to a portfolio.

**Request:**
```json
{
  "ticker": "NVDA",
  "shares": 50,
  "cost_basis": 12500.00,
  "purchase_date": "2023-09-01",
  "notes": "Bought after earnings dip"
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "ticker": "NVDA",
  "shares": 50,
  "cost_basis": 12500.00,
  "cost_per_share": 250.00,
  "purchase_date": "2023-09-01",
  "notes": "Bought after earnings dip",
  "created_at": "2024-01-15T10:30:00Z"
}
```

#### PUT /holdings/{id}
Update a holding.

**Request:**
```json
{
  "shares": 75,
  "cost_basis": 18750.00,
  "notes": "Added 25 shares"
}
```

**Response:** `200 OK`

#### DELETE /holdings/{id}
Remove a holding.

**Response:** `204 No Content`

---

## Portfolio Import/Export

#### POST /portfolios/{id}/import
Import holdings from CSV.

**Request:** `multipart/form-data`
- `file`: CSV file

**Expected CSV format:**
```csv
ticker,shares,cost_basis,purchase_date,notes
AAPL,100,14200,2023-06-15,
NVDA,50,12500,2023-09-01,Post-earnings buy
MSFT,75,22500,2023-01-10,
```

**Response:** `200 OK`
```json
{
  "imported": 3,
  "skipped": 0,
  "errors": [],
  "holdings": [ /* created holdings */ ]
}
```

**With errors:**
```json
{
  "imported": 2,
  "skipped": 1,
  "errors": [
    {
      "row": 3,
      "ticker": "INVALID",
      "error": "Stock not found"
    }
  ],
  "holdings": [ /* successfully created holdings */ ]
}
```

#### GET /portfolios/{id}/export
Export holdings as CSV.

**Response:** `200 OK` with `Content-Type: text/csv`
```csv
ticker,shares,cost_basis,purchase_date,notes,current_value,gain_loss
AAPL,100,14200.00,2023-06-15,,17850.00,3650.00
NVDA,50,12500.00,2023-09-01,Post-earnings buy,24500.00,12000.00
```

---

## Conversations (Chat)

#### GET /conversations
List user's conversations.

**Query Parameters:**
- `limit` (optional): Max results (default: 20)
- `offset` (optional): Pagination offset

**Response:** `200 OK`
```json
{
  "conversations": [
    {
      "id": "uuid",
      "title": "NVDA Score Analysis",
      "message_count": 8,
      "last_message_at": "2024-01-15T10:30:00Z",
      "created_at": "2024-01-15T10:00:00Z"
    }
  ],
  "total": 15
}
```

#### POST /conversations
Create a new conversation.

**Request:**
```json
{
  "title": "Portfolio Review"  // optional
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "title": null,
  "created_at": "2024-01-15T10:30:00Z"
}
```

#### GET /conversations/{id}/messages
Get messages in a conversation.

**Response:** `200 OK`
```json
{
  "messages": [
    {
      "id": "uuid",
      "role": "user",
      "content": "Why did NVDA's profitability score drop?",
      "created_at": "2024-01-15T10:30:00Z"
    },
    {
      "id": "uuid",
      "role": "assistant",
      "content": "NVDA's profitability score dropped from 85 to 78...",
      "context_used": {
        "holdings_referenced": ["NVDA"],
        "scores_fetched": ["NVDA"],
        "agents_used": ["fundamentals_analyst"]
      },
      "created_at": "2024-01-15T10:30:05Z"
    }
  ]
}
```

#### POST /conversations/{id}/messages
Send a message and get response.

**Request:**
```json
{
  "content": "Show me NVDA revenue over the last 5 years"
}
```

**Response:** `200 OK`
```json
{
  "user_message": {
    "id": "uuid",
    "role": "user",
    "content": "Show me NVDA revenue over the last 5 years",
    "created_at": "2024-01-15T10:30:00Z"
  },
  "assistant_message": {
    "id": "uuid",
    "role": "assistant",
    "content": "Here's NVDA's quarterly revenue over the past 5 years. Revenue has grown from $3.9B in Q1 2020 to $18.1B in Q4 2024, representing a CAGR of approximately 47%.",
    "citations": [
      {
        "id": "c1",
        "text_span": "$3.9B in Q1 2020",
        "type": "metric",
        "metric": "revenue",
        "value": 3866000000,
        "ticker": "NVDA",
        "period": "Q1 2020",
        "source": "Alpha Vantage",
        "as_of": "2024-01-15"
      },
      {
        "id": "c2",
        "text_span": "$18.1B in Q4 2024",
        "type": "metric",
        "metric": "revenue",
        "value": 18120000000,
        "ticker": "NVDA",
        "period": "Q4 2024",
        "source": "Alpha Vantage",
        "as_of": "2024-01-15"
      }
    ],
    "charts": [
      {
        "id": "chart_1",
        "chart_type": "fundamental_bar",
        "title": "NVDA Quarterly Revenue",
        "ticker": "NVDA",
        "metric": "revenue",
        "y_format": "currency_billions",
        "data": [
          {"x": "Q1 2020", "y": 3866000000},
          {"x": "Q2 2020", "y": 3866000000},
          {"x": "Q4 2024", "y": 18120000000}
        ],
        "source": "Alpha Vantage",
        "as_of": "2024-01-15"
      }
    ],
    "context_used": {
      "holdings_referenced": [],
      "scores_fetched": ["NVDA"],
      "agents_used": ["fundamentals_analyst"],
      "tools_called": ["get_historical_fundamentals", "generate_fundamental_chart"]
    },
    "created_at": "2024-01-15T10:30:03Z"
  }
}
```

**Example with TradingView chart:**
```json
{
  "assistant_message": {
    "content": "Here's NVDA's price chart with RSI and MACD indicators...",
    "charts": [
      {
        "id": "chart_1",
        "chart_type": "tradingview_embed",
        "ticker": "NVDA",
        "config": {
          "symbol": "NASDAQ:NVDA",
          "interval": "D",
          "studies": ["RSI@tv-basicstudies", "MACD@tv-basicstudies"],
          "theme": "light"
        }
      }
    ]
  }
}
```

#### DELETE /conversations/{id}
Delete a conversation.

**Response:** `204 No Content`

---

## User Preferences

#### GET /preferences
Get user preferences.

**Response:** `200 OK`
```json
{
  "risk_tolerance": "moderate",
  "investment_horizon": "medium_term",
  "tax_bracket": "24%",
  "tax_filing_status": "single",
  "state_of_residence": "CA",
  "default_scoring_profile_id": null
}
```

#### PUT /preferences
Update user preferences.

**Request:**
```json
{
  "risk_tolerance": "aggressive",
  "investment_horizon": "long_term",
  "tax_bracket": "32%"
}
```

**Response:** `200 OK`

---

## Scoring Configuration (Admin)

#### GET /scoring/configs
List available scoring configurations.

**Response:** `200 OK`
```json
{
  "configs": [
    {
      "id": "uuid",
      "factor": "valuation",
      "name": "Default Valuation",
      "version": 1,
      "is_system": true,
      "is_default": true,
      "metrics_count": 5
    }
  ]
}
```

#### GET /scoring/configs/{id}
Get full scoring configuration.

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "factor": "valuation",
  "name": "Default Valuation",
  "version": 1,
  "default_weight": 0.25,
  "metrics": [
    {
      "id": "pe_ratio",
      "source": "fundamentals.pe_ttm",
      "label": "P/E Ratio (TTM)",
      "scoring_method": "percentile_inverse",
      "percentile_universe": "sector",
      "weight": 0.25
    }
  ]
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "detail": "Error message here",
  "code": "ERROR_CODE"  // optional
}
```

**Common status codes:**
- `400 Bad Request` — Invalid input
- `401 Unauthorized` — Missing or invalid auth token
- `403 Forbidden` — Not allowed to access resource
- `404 Not Found` — Resource doesn't exist
- `422 Unprocessable Entity` — Validation error
- `429 Too Many Requests` — Rate limited
- `500 Internal Server Error` — Server error

---

## Rate Limits

- **Authenticated users:** 100 requests/minute
- **Stock data refresh:** 10/minute (to manage external API limits)
- **Chat messages:** 20/minute

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1705312800
```

# VeraScore Coding Standards

> **Purpose:** Consistent patterns and conventions to follow throughout the VeraScore codebase.

## General Principles

1. **Readability over cleverness** — Write code that's easy to understand
2. **Explicit over implicit** — Name things clearly, avoid magic
3. **DRY but not at the cost of clarity** — Some duplication is okay if it improves readability
4. **Fail fast with clear errors** — Validate inputs, provide helpful error messages

---

## Python (Backend)

### Project Structure

```
/apps/api/src
  /{module}/
    __init__.py
    routes.py       # FastAPI routes
    service.py      # Business logic
    models.py       # Pydantic models
    schemas.py      # Database schemas (if module-specific)
    exceptions.py   # Module-specific exceptions
```

### Naming Conventions

```python
# Files: snake_case
user_service.py
stock_routes.py

# Classes: PascalCase
class StockScore:
class PortfolioService:

# Functions/variables: snake_case
def calculate_score():
user_preferences = {}

# Constants: UPPER_SNAKE_CASE
MAX_RETRY_ATTEMPTS = 3
DEFAULT_CACHE_TTL = 3600
```

### Type Hints

Always use type hints:

```python
# ✅ Good
def calculate_factor_score(ticker: str, config: FactorConfig) -> FactorScore:
    ...

# ❌ Bad
def calculate_factor_score(ticker, config):
    ...
```

### Pydantic Models

Use Pydantic for all API inputs/outputs:

```python
from pydantic import BaseModel, Field
from datetime import date
from decimal import Decimal

class HoldingCreate(BaseModel):
    ticker: str = Field(..., min_length=1, max_length=10)
    shares: Decimal = Field(..., gt=0)
    cost_basis: Decimal = Field(..., ge=0)
    purchase_date: date
    notes: str | None = None

class HoldingResponse(BaseModel):
    id: str
    ticker: str
    shares: Decimal
    cost_basis: Decimal
    purchase_date: date
    current_value: Decimal
    gain_loss: Decimal
    gain_loss_pct: Decimal
    
    class Config:
        from_attributes = True
```

### Error Handling

Use custom exceptions and proper HTTP status codes:

```python
from fastapi import HTTPException, status

class StockNotFoundError(Exception):
    def __init__(self, ticker: str):
        self.ticker = ticker
        super().__init__(f"Stock not found: {ticker}")

# In routes
@router.get("/stocks/{ticker}")
async def get_stock(ticker: str):
    try:
        return await stock_service.get_stock(ticker)
    except StockNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Stock '{e.ticker}' not found"
        )
```

### Async/Await

Use async for I/O operations:

```python
# ✅ Good - async for database/API calls
async def get_fundamentals(ticker: str) -> Fundamentals:
    cached = await redis.get(f"fundamentals:{ticker}")
    if cached:
        return Fundamentals.parse_raw(cached)
    
    data = await alpha_vantage.fetch_fundamentals(ticker)
    await redis.set(f"fundamentals:{ticker}", data.json(), ex=86400)
    return data

# Sync is fine for pure computation
def calculate_percentile(value: float, distribution: list[float]) -> float:
    ...
```

### Docstrings

Use docstrings for public functions:

```python
def calculate_composite_score(
    ticker: str,
    profile_id: str | None = None
) -> CompositeScore:
    """
    Calculate overall stock score from weighted factor scores.
    
    Args:
        ticker: Stock ticker symbol (e.g., "AAPL")
        profile_id: Scoring profile to use. If None, uses default profile.
    
    Returns:
        CompositeScore with overall score and factor breakdown.
    
    Raises:
        StockNotFoundError: If ticker doesn't exist in database.
        ScoringConfigError: If scoring profile is invalid.
    """
    ...
```

---

## TypeScript (Frontend)

### Project Structure

```
/apps/web/src
  /components/
    /ui/              # Generic UI components (Button, Card, etc.)
    /features/        # Feature-specific components
      /portfolio/
      /chat/
      /stocks/
  /pages/             # Route pages
  /hooks/             # Custom hooks
  /services/          # API client functions
  /stores/            # Zustand stores
  /types/             # Shared TypeScript types
  /utils/             # Helper functions
```

### Naming Conventions

```typescript
// Files: PascalCase for components, camelCase for utilities
StockCard.tsx
usePortfolio.ts
stockService.ts

// Components: PascalCase
function StockCard({ ticker, score }: StockCardProps) {}

// Hooks: use prefix
function usePortfolioHoldings(portfolioId: string) {}

// Services: camelCase verbs
async function fetchStock(ticker: string) {}
async function createHolding(data: HoldingCreate) {}
```

### Component Structure

```tsx
// Imports grouped: React, external, internal, types, styles
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { fetchStock } from '@/services/stockService';
import type { Stock } from '@/types/stock';

// Props interface right before component
interface StockCardProps {
  ticker: string;
  showScore?: boolean;
  onSelect?: (ticker: string) => void;
}

// Named export for components
export function StockCard({ 
  ticker, 
  showScore = true, 
  onSelect 
}: StockCardProps) {
  // Hooks first
  const { data: stock, isLoading } = useQuery({
    queryKey: ['stock', ticker],
    queryFn: () => fetchStock(ticker),
  });

  // Event handlers
  const handleClick = () => {
    onSelect?.(ticker);
  };

  // Early returns for loading/error
  if (isLoading) return <CardSkeleton />;
  if (!stock) return null;

  // Main render
  return (
    <Card onClick={handleClick}>
      <h3>{stock.name}</h3>
      {showScore && <ScoreBadge score={stock.score} />}
    </Card>
  );
}
```

### State Management

Use TanStack Query for server state, Zustand for client state:

```typescript
// Server state - TanStack Query
const { data, isLoading, error } = useQuery({
  queryKey: ['portfolios', userId],
  queryFn: () => fetchPortfolios(userId),
  staleTime: 5 * 60 * 1000, // 5 minutes
});

// Client state - Zustand
import { create } from 'zustand';

interface UIStore {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));
```

### API Service Functions

```typescript
// /services/stockService.ts
import { api } from './api';
import type { Stock, StockScore } from '@/types/stock';

export async function fetchStock(ticker: string): Promise<Stock> {
  const response = await api.get<Stock>(`/stocks/${ticker}`);
  return response.data;
}

export async function fetchStockScores(ticker: string): Promise<StockScore> {
  const response = await api.get<StockScore>(`/stocks/${ticker}/scores`);
  return response.data;
}

export async function searchStocks(query: string): Promise<Stock[]> {
  const response = await api.get<Stock[]>('/stocks/search', {
    params: { q: query },
  });
  return response.data;
}
```

### TypeScript Types

```typescript
// /types/stock.ts

export interface Stock {
  ticker: string;
  name: string;
  sector: string;
  industry: string;
  currentPrice: number;
  marketCap: number;
}

export interface StockScore {
  ticker: string;
  overallScore: number;
  factors: {
    growth: FactorScore;
    profitability: FactorScore;
    valuation: FactorScore;
    momentum: FactorScore;
    quality: FactorScore;
  };
  calculatedAt: string;
}

export interface FactorScore {
  score: number;
  components: ScoreComponent[];
  explanation: string;
}

export interface ScoreComponent {
  metricId: string;
  label: string;
  rawValue: number;
  score: number;
  percentile?: number;
  weight: number;
}
```

---

## Tailwind CSS

### Class Organization

Order classes logically:
1. Layout (display, position)
2. Sizing (width, height)
3. Spacing (margin, padding)
4. Typography
5. Colors
6. Effects (shadow, opacity)
7. Transitions

```tsx
// ✅ Good - logical ordering
<div className="flex items-center w-full p-4 text-sm text-gray-700 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow">

// ❌ Bad - random order
<div className="shadow-sm text-gray-700 flex p-4 hover:shadow-md w-full bg-white rounded-lg items-center text-sm transition-shadow">
```

### Component Variants

Use class variance authority (cva) or conditional classes:

```tsx
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md font-medium transition-colors',
  {
    variants: {
      variant: {
        primary: 'bg-blue-600 text-white hover:bg-blue-700',
        secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200',
        danger: 'bg-red-600 text-white hover:bg-red-700',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-base',
        lg: 'h-12 px-6 text-lg',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);
```

---

## Database Conventions

### Table Naming

```sql
-- Tables: plural, snake_case
users
portfolios
holdings
stock_scores

-- Junction tables: both table names
scoring_profile_factors
```

### Column Naming

```sql
-- Columns: snake_case
user_id
created_at
cost_basis
overall_score

-- Foreign keys: singular_table_id
user_id
portfolio_id
```

### Migrations

Name migrations with number prefix and description:

```
001_create_users.sql
002_create_portfolios.sql
003_create_stocks.sql
004_add_score_history.sql
```

---

## Git Conventions

### Commit Messages

```
feat: Add portfolio CSV import
fix: Correct score calculation for negative EPS
refactor: Extract scoring engine to separate package
docs: Update API documentation
test: Add scoring engine unit tests
chore: Update dependencies
```

### Branch Names

```
feature/portfolio-csv-import
fix/score-calculation
refactor/scoring-engine
```

---

## Testing Conventions

### Python Tests

```python
# tests/scoring/test_valuation.py
import pytest
from packages.scoring_engine import ScoringEngine

class TestValuationScoring:
    @pytest.fixture
    def engine(self):
        return ScoringEngine()
    
    @pytest.fixture
    def sample_fundamentals(self):
        return {
            'pe_ttm': 25.0,
            'ps_ttm': 8.0,
            'peg_ratio': 1.5,
        }
    
    def test_pe_ratio_scoring(self, engine, sample_fundamentals):
        """P/E ratio should score inversely (lower is better)."""
        score = engine.score_metric(
            value=sample_fundamentals['pe_ttm'],
            method='percentile_inverse',
            universe='sector'
        )
        assert 0 <= score <= 100
    
    def test_missing_metric_handling(self, engine):
        """Missing metrics should not crash scoring."""
        result = engine.calculate_factor_score(
            ticker='TEST',
            config=self.load_config('valuation_v1')
        )
        assert result is not None
```

### TypeScript Tests

```typescript
// __tests__/components/ScoreBadge.test.tsx
import { render, screen } from '@testing-library/react';
import { ScoreBadge } from '@/components/ScoreBadge';

describe('ScoreBadge', () => {
  it('renders score value', () => {
    render(<ScoreBadge score={75} />);
    expect(screen.getByText('75')).toBeInTheDocument();
  });

  it('applies green color for high scores', () => {
    render(<ScoreBadge score={85} />);
    const badge = screen.getByTestId('score-badge');
    expect(badge).toHaveClass('bg-green-100');
  });

  it('applies red color for low scores', () => {
    render(<ScoreBadge score={35} />);
    const badge = screen.getByTestId('score-badge');
    expect(badge).toHaveClass('bg-red-100');
  });
});
```

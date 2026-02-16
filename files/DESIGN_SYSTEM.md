# VeraScore Design System

## Overview

VeraScore's design philosophy combines **friendly fintech** aesthetics with **minimal, focused interfaces**. The goal is to make complex financial data feel approachable without overwhelming users.

## Design Principles

1. **Approachable, not intimidating** — Finance doesn't have to feel cold
2. **One focus per page** — Don't cram everything into one view
3. **Progressive disclosure** — Summary first, details on demand
4. **Whitespace is a feature** — Let content breathe
5. **Trust through transparency** — Show data sources, not just conclusions

## Visual Style

### Aesthetic Direction

**Friendly Fintech + Minimal**

| Inspiration | What to Take |
|-------------|--------------|
| Robinhood | Simplicity, clean charts, approachable language |
| Linear | Whitespace, focused UI, subtle animations |
| Wealthfront | Trust signals, professional but warm |
| Notion | Clean typography, organized without being rigid |

**NOT aiming for:**
- Bloomberg-style data density
- Complex multi-panel dashboards
- Dark themes with neon accents (gaming aesthetic)
- Overly playful/cartoon style

### Color Palette

```
Primary:
- Background:     #FFFFFF (white)
- Surface:        #F9FAFB (gray-50)
- Border:         #E5E7EB (gray-200)

Text:
- Primary:        #111827 (gray-900)
- Secondary:      #6B7280 (gray-500)
- Muted:          #9CA3AF (gray-400)

Accent (Trust Green):
- Primary:        #059669 (emerald-600)
- Light:          #D1FAE5 (emerald-100)
- Dark:           #047857 (emerald-700)

Semantic:
- Success:        #10B981 (emerald-500)
- Warning:        #F59E0B (amber-500)
- Error:          #EF4444 (red-500)
- Info:           #3B82F6 (blue-500)

Score Colors (0-100):
- Excellent (80+):   #10B981 (emerald)
- Good (60-79):      #3B82F6 (blue)
- Average (40-59):   #F59E0B (amber)
- Below Avg (20-39): #F97316 (orange)
- Poor (<20):        #EF4444 (red)
```

### Typography

```
Font Family: Inter (or system-ui fallback)

Headings:
- H1: 30px / 36px line-height / semibold
- H2: 24px / 32px line-height / semibold
- H3: 20px / 28px line-height / medium
- H4: 16px / 24px line-height / medium

Body:
- Large:  18px / 28px line-height / regular
- Base:   16px / 24px line-height / regular
- Small:  14px / 20px line-height / regular
- XSmall: 12px / 16px line-height / regular (labels, captions)

Numbers/Data:
- Use tabular-nums for aligned numbers
- Mono font for tickers: "SF Mono", "Fira Code", monospace
```

### Spacing Scale

```
4px  - xs (tight padding)
8px  - sm
12px - md
16px - base
24px - lg
32px - xl
48px - 2xl
64px - 3xl
```

### Border Radius

```
Small (buttons, inputs):  6px
Medium (cards):           8px
Large (modals):           12px
Full (avatars, badges):   9999px
```

### Shadows

```
sm:   0 1px 2px rgba(0,0,0,0.05)
base: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)
md:   0 4px 6px rgba(0,0,0,0.1)
lg:   0 10px 15px rgba(0,0,0,0.1)
```

## Navigation

### Structure

Simple top navigation with 5 core sections:

```
┌─────────────────────────────────────────────────────────────────┐
│  [Logo] VeraScore     Portfolio  Research  Screener  News  Chat│
│                                                    [?] [Avatar]│
└─────────────────────────────────────────────────────────────────┘
```

- **Portfolio** — User's holdings, aggregate scores, guardrail status
- **Research** — Individual stock analysis, scores, fundamentals
- **Screener** — Filter stocks by score criteria
- **News** — Market news relevant to holdings
- **Chat** — Full-page conversational interface

**No nested menus.** Maximum 1 click to any section.

### Mobile Navigation

Bottom tab bar on mobile:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                         [Content]                               │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│   📊        🔍        📈        📰        💬                    │
│ Portfolio Research  Screener   News     Chat                    │
└─────────────────────────────────────────────────────────────────┘
```

## Page Layouts

### Portfolio Page

```
┌─────────────────────────────────────────────────────────────────┐
│  My Portfolio                                    [+ Add Holding]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │ Total Value  │ │ Overall Score│ │ Day Change   │            │
│  │ $125,430     │ │     74       │ │ +$1,240      │            │
│  │              │ │   ◐ Good     │ │ (+1.0%)      │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
│                                                                 │
│  Guardrails  ✅ All passing                    [Manage Rules]  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Holdings                                      [Import CSV]  ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ AAPL   Apple Inc.        100 shares   $17,850   +25.7%  76 ││
│  │ NVDA   NVIDIA Corp.       50 shares   $24,500   +96.0%  82 ││
│  │ MSFT   Microsoft          75 shares   $28,125   +25.0%  79 ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│                                           [💬 Chat about this] │
└─────────────────────────────────────────────────────────────────┘
```

### Stock Research Page

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back     AAPL · Apple Inc.                    [Add to Portfolio]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  $178.50  +$2.34 (+1.3%)                    [💬 Chat about AAPL]│
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Overall Score                                              ││
│  │        76                                                   ││
│  │    ┌─────────────────────────────────────────┐              ││
│  │    │ Growth        ████████████░░░░  72      │              ││
│  │    │ Profitability █████████████████  89     │              ││
│  │    │ Valuation     ██████████░░░░░░  58      │              ││
│  │    │ Momentum      ████████████░░░░  74      │              ││
│  │    │ Quality       ████████████████  82      │              ││
│  │    │ Sentiment     ████████████░░░░  71      │              ││
│  │    └─────────────────────────────────────────┘              ││
│  │                                                             ││
│  │  [View as: Default ▼]  ← Persona selector                   ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  Analyst Targets          Institutional Activity               │
│  ┌──────────────────┐     ┌──────────────────┐                 │
│  │ Mean: $198.75    │     │ 61.4% inst. owned│                 │
│  │ Upside: +11.3%   │     │ Net Buying ↑     │                 │
│  │ 40 analysts      │     │ Q3: +125M shares │                 │
│  └──────────────────┘     └──────────────────┘                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Chat Page (Dedicated)

```
┌─────────────────────────────────────────────────────────────────┐
│  Chat                                          [New Conversation]│
├───────────────────────────────────┬─────────────────────────────┤
│                                   │                             │
│  Conversations                    │  ┌─────────────────────────┐│
│  ┌─────────────────────────┐      │  │ USER                    ││
│  │ NVDA Score Analysis     │      │  │ Why did NVDA's score    ││
│  │ Today                   │←     │  │ drop this week?         ││
│  ├─────────────────────────┤      │  └─────────────────────────┘│
│  │ Portfolio Review        │      │                             │
│  │ Yesterday               │      │  ┌─────────────────────────┐│
│  ├─────────────────────────┤      │  │ VERASCORE               ││
│  │ Tax Loss Harvesting     │      │  │ NVDA's overall score    ││
│  │ Jan 10                  │      │  │ dropped from 85 to 78   ││
│  └─────────────────────────┘      │  │ this week. The primary  ││
│                                   │  │ driver was the          ││
│                                   │  │ profitability factor,   ││
│                                   │  │ which fell from 92 to   ││
│                                   │  │ 84.                     ││
│                                   │  │                         ││
│                                   │  │ As of the Q3 2024       ││
│                                   │  │ earnings report,        ││
│                                   │  │ operating margin[¹]     ││
│                                   │  │ compressed from 54%     ││
│                                   │  │ to 51%...               ││
│                                   │  │                         ││
│                                   │  │ [¹] = citation tooltip  ││
│                                   │  └─────────────────────────┘│
│                                   │                             │
│                                   │  ┌─────────────────────────┐│
│                                   │  │ Ask about your portfolio││
│                                   │  │ or any stock...     [→] ││
│                                   │  └─────────────────────────┘│
└───────────────────────────────────┴─────────────────────────────┘
```

## Chat Integration

### Slide-Out Panel (Contextual)

Appears on Stock and Portfolio pages when user clicks "Chat about this":

```
┌─────────────────────────────────────────────────────────────────┐
│  [Main Page Content]                     │ Chat about AAPL    ×│
│                                          ├─────────────────────┤
│                                          │                     │
│                                          │  Context: Discussing│
│                                          │  Apple Inc. (AAPL)  │
│                                          │                     │
│                                          │  ┌─────────────────┐│
│                                          │  │ What's driving  ││
│                                          │  │ the valuation   ││
│                                          │  │ score down?     ││
│                                          │  └─────────────────┘│
│                                          │                     │
│                                          │  ┌─────────────────┐│
│                                          │  │ The valuation   ││
│                                          │  │ score of 58     ││
│                                          │  │ reflects...     ││
│                                          │  └─────────────────┘│
│                                          │                     │
│                                          │  [Ask a question...││
│                                          │                  →] │
│                                          │                     │
│                                          │  [Open full chat ↗] │
└──────────────────────────────────────────┴─────────────────────┘
```

### Chat Panel Behavior

- **Width:** 400px (desktop), full-screen (mobile)
- **Entry points:**
  - "Chat about this" button on Stock/Portfolio pages
  - Floating chat bubble (bottom-right corner)
- **Context loading:** Pre-seeds with current page context
- **Expand option:** Link to open full `/chat` page

## Key Components

### Score Badge

Circular badge showing 0-100 score with color coding:

```
    ┌─────┐
    │ 76  │   ← Number in center
    │ ◐   │   ← Partial fill indicator
    └─────┘
    "Good"    ← Label below (optional)
```

Colors based on score range (see Color Palette).

### Charts

VeraScore uses a **hybrid charting approach**:

| Chart Type | Solution | When to Use |
|------------|----------|-------------|
| Price / Technical | TradingView Widget | "Show me NVDA price chart" |
| Fundamentals | Recharts (custom) | "Show me NVDA revenue over 5 years" |
| Portfolio allocation | Recharts (pie/donut) | Sector breakdown, holdings |
| Score trends | Recharts (line) | Score history over time |

#### TradingView Widget Integration

Embed interactive price charts with the user's preferred indicators:

```jsx
import { AdvancedRealTimeChart } from 'react-ts-tradingview-widgets';

function PriceChart({ ticker, interval = 'D', studies = [] }) {
  return (
    <AdvancedRealTimeChart
      symbol={ticker}
      theme="light"
      interval={interval}
      studies={studies}
      style="1"  // Candles
      timezone="America/New_York"
      allow_symbol_change={false}
      hide_side_toolbar={false}
      withdateranges={true}
      height={400}
    />
  );
}
```

**Available intervals:** `1`, `5`, `15`, `30`, `60`, `D`, `W`, `M`
**Common studies:** `RSI`, `MACD`, `BB` (Bollinger Bands), `MA Cross`, `Volume`

**Note:** TradingView widgets show their branding unless you have Premium. This is fine for MVP.

#### Fundamental Charts (Custom)

Use Recharts for fundamental data visualization:

```jsx
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

function RevenueChart({ data, ticker }) {
  return (
    <div className="bg-white rounded-lg p-4 border">
      <h3 className="text-sm font-medium text-gray-500 mb-2">
        {ticker} Quarterly Revenue
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
          <XAxis dataKey="period" fontSize={12} />
          <YAxis 
            tickFormatter={(v) => `$${(v / 1e9).toFixed(1)}B`}
            fontSize={12}
          />
          <Tooltip 
            formatter={(v) => [`$${(v / 1e9).toFixed(2)}B`, 'Revenue']}
          />
          <Area 
            type="monotone" 
            dataKey="revenue" 
            stroke="#059669" 
            fill="#D1FAE5" 
          />
        </AreaChart>
      </ResponsiveContainer>
      <p className="text-xs text-gray-400 mt-2">
        Source: Alpha Vantage · As of Jan 15, 2025
      </p>
    </div>
  );
}
```

#### Chart Response in Chat

When AI generates a chart, it's embedded inline in the chat:

```
┌─────────────────────────────────────────────────────────────────┐
│  USER                                                           │
│  Show me NVDA revenue over the last 5 years                     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  VERASCORE                                                      │
│                                                                 │
│  Here's NVDA's quarterly revenue over the past 5 years:        │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  NVDA Quarterly Revenue                                  │   │
│  │  $20B ┤                                          ╭───    │   │
│  │  $15B ┤                                    ╭─────╯       │   │
│  │  $10B ┤                              ╭─────╯             │   │
│  │   $5B ┤    ╭─────────────────────────╯                   │   │
│  │   $0B ┼────┴─────────────────────────────────────────    │   │
│  │       Q1'20  Q1'21  Q1'22  Q1'23  Q1'24                  │   │
│  │                                                          │   │
│  │  Source: Alpha Vantage · As of Jan 15, 2025              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Revenue has grown from $3.9B in Q1 2020 to $18.1B in Q4 2024, │
│  representing a CAGR of approximately 47%. The sharp           │
│  acceleration beginning in 2023 coincides with the AI/datacenter│
│  boom.                                                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Chart Types by Use Case

| User Request | Chart Type | Tool |
|--------------|------------|------|
| "NVDA price chart" | TradingView | `generate_tradingview_embed` |
| "NVDA with RSI and MACD" | TradingView + studies | `generate_tradingview_embed` |
| "NVDA revenue over 5 years" | Area/Bar chart | `generate_fundamental_chart` |
| "Compare AAPL vs MSFT revenue" | Multi-line chart | `generate_fundamental_chart` |
| "My portfolio allocation" | Pie/Donut | Custom portfolio chart |
| "My portfolio score history" | Line chart | Custom score chart |

### Citation Highlight

Inline citations in chat responses:

```
"The P/E ratio of 65.2̲ is elevated compared to the sector median."
                   ↑
            [Underlined, hoverable]
```

**Hover tooltip:**
```
┌────────────────────────────┐
│ P/E Ratio (TTM)            │
│ Value: 65.2                │
│ Source: Alpha Vantage      │
│ As of: Jan 15, 2025        │
│                            │
│ [View in context →]        │
└────────────────────────────┘
```

### Guardrail Alert

Friendly warning banner (not scary red):

```
┌─────────────────────────────────────────────────────────────────┐
│ ⚠️  Heads up: Your tech allocation (45%) is approaching your   │
│     50% limit.                                    [Manage Rules]│
└─────────────────────────────────────────────────────────────────┘
```

For violations:
```
┌─────────────────────────────────────────────────────────────────┐
│ 🚨  Guardrail exceeded: Tech sector at 52%, above your 50%     │
│     limit.                                   [View Suggestions] │
└─────────────────────────────────────────────────────────────────┘
```

### Simulation Result Card

Before/after comparison for what-if queries:

```
┌─────────────────────────────────────────────────────────────────┐
│  Simulation: Sell INTC, Buy NVDA ($5,000)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Score Impact                                                   │
│  ┌─────────────────────────────────┐                           │
│  │ Overall    72  →  75  (+3) ✅   │                           │
│  │ Quality    68  →  74  (+6) ✅   │                           │
│  │ Valuation  71  →  67  (-4) ⬇️   │                           │
│  └─────────────────────────────────┘                           │
│                                                                 │
│  Allocation Change                                              │
│  Tech sector: 42% → 45% (+3%)                                   │
│                                                                 │
│  Tax Impact                                                     │
│  Short-term loss: $1,200 → ~$288 tax savings                    │
│                                                                 │
│  Guardrails: ✅ All passing                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Component Library

**Recommended:** shadcn/ui

- Flexible, not opinionated
- Works well with Tailwind
- Professional look out of the box
- Easy to customize

**Charts:** Tremor or Recharts
- Tremor for quick dashboards
- Recharts for custom visualizations

## Responsive Breakpoints

```
sm:  640px   (large phones)
md:  768px   (tablets)
lg:  1024px  (small laptops)
xl:  1280px  (desktops)
2xl: 1536px  (large screens)
```

## Animation Guidelines

- **Duration:** 150-200ms for micro-interactions
- **Easing:** `ease-out` for entrances, `ease-in` for exits
- **What to animate:**
  - Panel slides (chat panel)
  - Tooltips appearing
  - Score changes (subtle pulse)
  - Loading states
- **What NOT to animate:**
  - Navigation between pages (keep instant)
  - Data tables
  - Form submissions

## Accessibility

- **Color contrast:** WCAG AA minimum (4.5:1 for text)
- **Focus states:** Visible focus rings on all interactive elements
- **Screen readers:** Proper ARIA labels, especially for scores and charts
- **Keyboard navigation:** Full keyboard support for all actions

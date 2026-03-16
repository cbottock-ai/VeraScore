import { useState } from 'react'

const TOPICS = [
  {
    title: 'How to Read an Earnings Report',
    body: `An earnings report is a quarterly filing that shows a company's revenue, expenses, and profit. Key numbers to watch: EPS (earnings per share) vs analyst estimates, revenue vs estimates, and forward guidance. A "beat" means the company exceeded expectations — historically stocks that consistently beat tend to outperform.`,
  },
  {
    title: 'What is P/E Ratio?',
    body: `Price-to-Earnings (P/E) ratio compares a stock's price to its annual earnings per share. A P/E of 20 means investors pay $20 for every $1 of earnings. Lower P/E can signal undervaluation, but context matters — high-growth companies often trade at high P/E because investors are paying for future earnings.`,
  },
  {
    title: 'Understanding EPS Surprise',
    body: `EPS surprise is the difference between reported earnings and analyst consensus estimates, expressed as a percentage. A +5% surprise means the company earned 5% more than expected. Companies with a consistent history of positive surprises often see their stock price re-rated higher over time.`,
  },
  {
    title: 'What Does VeraScore Measure?',
    body: `VeraScore combines six factors into a single 0–100 score: Valuation (is it cheap relative to earnings/assets?), Growth (revenue and earnings trajectory), Profitability (margins, return on equity), Quality (balance sheet strength, cash flow), Momentum (recent price performance), and Earnings Quality (beat rate, surprise consistency, sentiment).`,
  },
  {
    title: 'Revenue Beat Rate vs EPS Beat Rate',
    body: `EPS beat rate measures how often a company beats earnings per share estimates. Revenue beat rate measures how often it beats sales estimates. Revenue beats are often considered more meaningful — earnings can be managed through cost-cutting, but growing the top line requires real demand for products or services.`,
  },
  {
    title: 'What is Insider Activity?',
    body: `Insider activity tracks purchases and sales of company stock by executives, directors, and large shareholders (insiders). Insider buying is often viewed as a bullish signal — executives rarely buy their own stock unless they believe it's undervalued. Insider selling is less meaningful as insiders sell for many reasons (diversification, taxes, etc.).`,
  },
  {
    title: 'How to Use Analyst Ratings',
    body: `Analyst ratings (Buy, Hold, Sell) and price targets from investment banks reflect professional research. They are useful as one data point but shouldn't be followed blindly — analysts can have conflicts of interest and often lag behind the market. Upgrades from neutral to buy, especially with a raised price target, tend to be the most actionable signals.`,
  },
]

export function LearningPage() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold">Learning</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Key investing concepts to sharpen your research</p>
      </div>

      <div className="space-y-2">
        {TOPICS.map((t, i) => (
          <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-muted/30 transition-colors"
              onClick={() => setOpen(open === i ? null : i)}
            >
              <span className="text-sm font-medium">{t.title}</span>
              <svg
                className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${open === i ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {open === i && (
              <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-border/50 pt-3">
                {t.body}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

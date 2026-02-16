import { useParams } from 'react-router-dom'

export function ResearchPage() {
  const { ticker } = useParams()

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Research</h1>
      {ticker ? (
        <p className="text-muted-foreground">
          Stock analysis for <span className="font-mono font-medium text-foreground">{ticker.toUpperCase()}</span> will appear here.
        </p>
      ) : (
        <p className="text-muted-foreground">
          Search for a stock to view scores, fundamentals, and analyst data.
        </p>
      )}
    </div>
  )
}

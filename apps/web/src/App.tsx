import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Layout } from '@/components/Layout'
import { DashboardPage } from '@/pages/Dashboard'
import { PortfolioPage } from '@/pages/Portfolio'
import { ResearchLandingPage, EarningsResearchPage, StockResearchPage } from '@/pages/Research'
import { ScreenerPage } from '@/pages/research/Screener'
import { SectorsPage } from '@/pages/research/Sectors'
import { AnalystRatingsPage } from '@/pages/research/AnalystRatings'
import { InsiderActivityPage } from '@/pages/research/InsiderActivity'
import { ChatPage } from '@/pages/Chat'
import { SettingsPage } from '@/pages/Settings'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
    },
  },
})

const CLERK_ENABLED = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
const ClerkAuthWrapper = lazy(() => import('@/components/ClerkAuthWrapper'))

function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/watchlist" element={<PortfolioPage />} />

        {/* Research section */}
        <Route path="/research" element={<ResearchLandingPage />} />
        <Route path="/research/earnings" element={<EarningsResearchPage />} />
        <Route path="/research/screener" element={<ScreenerPage />} />
        <Route path="/research/sectors" element={<SectorsPage />} />
        <Route path="/research/analyst-ratings" element={<AnalystRatingsPage />} />
        <Route path="/research/insider-activity" element={<InsiderActivityPage />} />
        <Route path="/research/stock/:ticker" element={<StockResearchPage />} />

        {/* Legacy redirects */}
        <Route path="/research/:ticker" element={<Navigate to="/research" replace />} />
        <Route path="/earnings" element={<Navigate to="/research/earnings" replace />} />

        <Route path="/chat" element={<ChatPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {CLERK_ENABLED ? (
          <Suspense fallback={<div className="min-h-screen bg-background" />}>
            <ClerkAuthWrapper>
              <AppRoutes />
            </ClerkAuthWrapper>
          </Suspense>
        ) : (
          <AppRoutes />
        )}
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App

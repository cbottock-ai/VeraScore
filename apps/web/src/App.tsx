import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth, SignIn, SignedIn, SignedOut } from '@clerk/react'
import { Layout } from '@/components/Layout'
import { DashboardPage } from '@/pages/Dashboard'
import { PortfolioPage } from '@/pages/Portfolio'
import { ResearchPage } from '@/pages/Research'
import { EarningsPage } from '@/pages/Earnings'
import { ChatPage } from '@/pages/Chat'
import { SettingsPage } from '@/pages/Settings'
import { setAuthTokenGetter } from '@/services/api'

const queryClient = new QueryClient()

// Component to set up auth token for API requests
function AuthSetup({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth()

  useEffect(() => {
    setAuthTokenGetter(getToken)
  }, [getToken])

  return <>{children}</>
}

// Check if Clerk is configured
const CLERK_ENABLED = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

function App() {
  // If Clerk is not configured, render without auth
  if (!CLERK_ENABLED) {
    return (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/watchlist" element={<PortfolioPage />} />
              <Route path="/research" element={<ResearchPage />} />
              <Route path="/research/:ticker" element={<ResearchPage />} />
              <Route path="/earnings" element={<EarningsPage />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <SignedIn>
          <AuthSetup>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/watchlist" element={<PortfolioPage />} />
                <Route path="/research" element={<ResearchPage />} />
                <Route path="/research/:ticker" element={<ResearchPage />} />
                <Route path="/earnings" element={<EarningsPage />} />
                <Route path="/chat" element={<ChatPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
            </Routes>
          </AuthSetup>
        </SignedIn>
        <SignedOut>
          <div className="min-h-screen flex items-center justify-center bg-background">
            <SignIn routing="hash" />
          </div>
        </SignedOut>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App

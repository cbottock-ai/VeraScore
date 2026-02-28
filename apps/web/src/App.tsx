import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Layout } from '@/components/Layout'
import { DashboardPage } from '@/pages/Dashboard'
import { PortfolioPage } from '@/pages/Portfolio'
import { ResearchPage } from '@/pages/Research'
import { EarningsPage } from '@/pages/Earnings'
import { ChatPage } from '@/pages/Chat'
import { SettingsPage } from '@/pages/Settings'

const queryClient = new QueryClient()

function App() {
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

export default App

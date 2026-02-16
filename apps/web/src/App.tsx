import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Layout } from '@/components/Layout'
import { PortfolioPage } from '@/pages/Portfolio'
import { ResearchPage } from '@/pages/Research'
import { ChatPage } from '@/pages/Chat'
import { SettingsPage } from '@/pages/Settings'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<PortfolioPage />} />
            <Route path="/research" element={<ResearchPage />} />
            <Route path="/research/:ticker" element={<ResearchPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App

// src/App.jsx — wraps entire app in <MemoryRouter> so useNavigate works everywhere
import { useState } from 'react'
import { MemoryRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import Layout from './components/Layout/Layout'
import Dashboard  from './pages/Dashboard'
import Analysis   from './pages/Analysis'
import Backtest   from './pages/Backtest'
import Portfolio  from './pages/Portfolio'
import Discovery  from './pages/Discovery'
import Memory     from './pages/Memory'

// Inner component so we can use useNavigate (requires being inside Router)
function AppRoutes() {
  const [selectedStock, setSelectedStock] = useState('NVDA')
  const navigate = useNavigate()
  const location = useLocation()

  // Derive activePage from current route path for the sidebar nav
  const pathToPage = { '/': 'dashboard', '/analysis': 'analysis', '/backtest': 'backtest', '/portfolio': 'portfolio', '/discovery': 'discovery', '/memory': 'memory' }
  const activePage = pathToPage[location.pathname] || 'dashboard'

  const setActivePage = (page) => {
    const pageToPath = { dashboard: '/', analysis: '/analysis', backtest: '/backtest', portfolio: '/portfolio', discovery: '/discovery', memory: '/memory' }
    navigate(pageToPath[page] || '/')
  }

  return (
    <Layout activePage={activePage} setActivePage={setActivePage} selectedStock={selectedStock}>
      <Routes>
        <Route path="/"          element={<Dashboard  selectedStock={selectedStock} setSelectedStock={setSelectedStock} />} />
        <Route path="/analysis"  element={<Analysis   selectedStock={selectedStock} setSelectedStock={setSelectedStock} />} />
        <Route path="/backtest"  element={<Backtest />} />
        <Route path="/portfolio" element={<Portfolio  selectedStock={selectedStock} setSelectedStock={setSelectedStock} />} />
        <Route path="/discovery" element={<Discovery  setSelectedStock={setSelectedStock} setActivePage={setActivePage} />} />
        <Route path="/memory"    element={<Memory     selectedStock={selectedStock} />} />
      </Routes>
    </Layout>
  )
}

export default function App() {
  return (
    <div className="scanlines">
      <MemoryRouter>
        <AppRoutes />
      </MemoryRouter>
    </div>
  )
}

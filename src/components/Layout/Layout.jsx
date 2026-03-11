import { useState, useEffect } from 'react'
import { checkBackend, resetBackendCache } from '../../hooks/useBackend'

const TICKER_ITEMS = []
const MARKET_EVENTS = []

const NAV_ITEMS = [
  { id: 'dashboard', label: 'OVERVIEW',       icon: '⬡' },
  { id: 'analysis',  label: 'LAYER ANALYSIS', icon: '◈' },
  { id: 'discovery', label: 'DISCOVERY',      icon: '◎' },
  { id: 'memory',    label: 'MEMORY',         icon: '◆' },
  { id: 'backtest',  label: 'BACKTEST',       icon: '◇' },
  { id: 'portfolio', label: 'PORTFOLIO',      icon: '○' },
]

function Ticker() {
  const items = TICKER_ITEMS.length ? [...TICKER_ITEMS, ...TICKER_ITEMS] : []
  if (items.length === 0) return null
  return (
    <div style={{ background: '#080810', borderBottom: '1px solid #1e1e35', height: '32px', overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
      <div style={{ background: '#4466ff', padding: '0 12px', height: '100%', display: 'flex', alignItems: 'center', flexShrink: 0, fontSize: '10px', fontFamily: 'IBM Plex Mono', fontWeight: 600, color: 'white', letterSpacing: '0.1em' }}>
        LIVE
      </div>
      <div style={{ overflow: 'hidden', flex: 1 }}>
        <div className="animate-ticker" style={{ display: 'flex', gap: '32px', whiteSpace: 'nowrap', padding: '0 16px' }}>
          {items.map((item, i) => (
            <span key={i} style={{ fontSize: '11px', fontFamily: 'IBM Plex Mono', color: item.change >= 0 ? '#00ff88' : '#ff3355' }}>
              <span style={{ color: '#7070a0', marginRight: '6px' }}>{item.symbol}</span>
              {typeof item.price === 'number' && item.price > 1000 ? item.price.toLocaleString() : item.price.toFixed(2)}
              <span style={{ marginLeft: '4px' }}>{item.change >= 0 ? '+' : ''}{item.change.toFixed(2)}%</span>
            </span>
          ))}
        </div>
      </div>
      <div style={{ padding: '0 12px', fontSize: '10px', fontFamily: 'IBM Plex Mono', color: '#404060', flexShrink: 0 }}>
        {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  )
}

export default function Layout({ children, activePage, setActivePage, selectedStock }) {
  const [time, setTime] = useState(new Date())
  const [eventIdx, setEventIdx] = useState(0)
  const [backendStatus, setBackendStatus] = useState('checking') // 'checking' | 'live' | 'offline'

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    const e = MARKET_EVENTS.length ? setInterval(() => setEventIdx(i => (i + 1) % MARKET_EVENTS.length), 4000) : undefined
    return () => { clearInterval(t); if (e) clearInterval(e) }
  }, [])

  // Check backend on mount and every 30s
  useEffect(() => {
    const doCheck = async () => {
      const live = await checkBackend()
      setBackendStatus(live ? 'live' : 'offline')
    }
    doCheck()
    const interval = setInterval(doCheck, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleRetryBackend = async () => {
    setBackendStatus('checking')
    resetBackendCache()
    const live = await checkBackend()
    setBackendStatus(live ? 'live' : 'offline')
  }

  const currentEvent = MARKET_EVENTS[eventIdx] || null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#050508' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 20px', height: '48px', background: '#08080f', borderBottom: '1px solid #1e1e35', flexShrink: 0, gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '24px', height: '24px', background: 'linear-gradient(135deg, #4466ff, #00d4ff)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>A</div>
          <span style={{ fontFamily: 'IBM Plex Mono', fontWeight: 600, fontSize: '13px', letterSpacing: '0.15em', color: '#e8e8f0' }}>APEX</span>
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#404060', letterSpacing: '0.1em' }}>RESEARCH TERMINAL v2.4</span>
        </div>
        
        <div style={{ flex: 1 }} />
        
        {/* Live event flash — only when backend provides events */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', maxWidth: '500px', overflow: 'hidden' }}>
          <div className="live-dot" />
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: '#7070a0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {currentEvent ? (
              <><span style={{ color: getSeverityColor(currentEvent.severity) }}>[{currentEvent.type}]</span>{' '}{currentEvent.symbol}: {currentEvent.text}</>
            ) : (
              'Run Discovery or analyze a ticker for live data'
            )}
          </span>
        </div>
        
        <div style={{ flex: 1 }} />
        
        <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '11px', color: '#7070a0' }}>
          {time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          <span style={{ marginLeft: '8px', color: '#e8e8f0' }}>{time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div className="live-dot" />
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: '#00ff88' }}>MARKET OPEN</span>
        </div>

        {/* Backend brain status */}
        <button
          onClick={handleRetryBackend}
          title={backendStatus === 'offline' ? 'Backend offline — click to retry. Run: npm run dev:backend' : 'Backend brain status'}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'none', border: `1px solid ${backendStatus === 'live' ? '#00ff8830' : backendStatus === 'offline' ? '#ff335530' : '#4466ff30'}`,
            borderRadius: 3, padding: '2px 8px', cursor: backendStatus === 'offline' ? 'pointer' : 'default',
          }}
        >
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: backendStatus === 'live' ? '#00ff88' : backendStatus === 'offline' ? '#ff3355' : '#ffcc00',
            boxShadow: backendStatus === 'live' ? '0 0 6px #00ff88' : backendStatus === 'offline' ? '0 0 6px #ff3355' : '0 0 6px #ffcc00',
          }} />
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: backendStatus === 'live' ? '#00ff88' : backendStatus === 'offline' ? '#ff3355' : '#ffcc00' }}>
            {backendStatus === 'live' ? 'BRAIN ONLINE' : backendStatus === 'offline' ? 'BRAIN OFFLINE' : 'CONNECTING...'}
          </span>
        </button>
      </div>

      {/* Ticker */}
      <Ticker />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <div style={{ width: '180px', background: '#08080f', borderRight: '1px solid #1e1e35', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid #1e1e35' }}>
            <div style={{ fontSize: '9px', fontFamily: 'IBM Plex Mono', color: '#404060', letterSpacing: '0.1em', marginBottom: '12px' }}>NAVIGATION</div>
            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '8px 10px', marginBottom: '2px', borderRadius: '3px',
                  background: activePage === item.id ? 'rgba(68, 102, 255, 0.15)' : 'transparent',
                  border: activePage === item.id ? '1px solid rgba(68, 102, 255, 0.3)' : '1px solid transparent',
                  color: activePage === item.id ? '#e8e8f0' : '#7070a0',
                  cursor: 'pointer', fontSize: '11px', fontFamily: 'IBM Plex Mono',
                  letterSpacing: '0.05em', transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize: '12px', color: activePage === item.id ? '#4466ff' : '#404060' }}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>

          {/* Market indicators */}
          <div style={{ padding: '16px', borderBottom: '1px solid #1e1e35' }}>
            <div style={{ fontSize: '9px', fontFamily: 'IBM Plex Mono', color: '#404060', letterSpacing: '0.1em', marginBottom: '10px' }}>MARKET STATUS</div>
            {[
              { label: 'S&P 500', val: '+0.34%', up: true },
              { label: 'NASDAQ', val: '+0.56%', up: true },
              { label: 'VIX', val: '16.23', up: false },
              { label: 'DXY', val: '-0.21%', up: false },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: '#7070a0' }}>{item.label}</span>
                <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: item.up ? '#00ff88' : '#ff3355' }}>{item.val}</span>
              </div>
            ))}
          </div>

          {/* Events feed */}
          <div style={{ padding: '16px', flex: 1, overflow: 'hidden' }}>
            <div style={{ fontSize: '9px', fontFamily: 'IBM Plex Mono', color: '#404060', letterSpacing: '0.1em', marginBottom: '10px' }}>RECENT EVENTS</div>
            {MARKET_EVENTS.slice(0, 5).map((ev, i) => (
              <div key={i} style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: getSeverityColor(ev.severity) }}>{ev.type}</span>
                  <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#404060' }}>{ev.time}</span>
                </div>
                <div style={{ fontSize: '10px', color: '#7070a0', lineHeight: '1.4' }}>{ev.symbol}: {ev.text.slice(0, 45)}...</div>
              </div>
            ))}
          </div>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, overflow: 'auto' }} className="noise-bg">
          {children}
        </div>
      </div>
    </div>
  )
}

function getSeverityColor(severity) {
  return { HIGH: '#ff3355', MEDIUM: '#ffcc00', LOW: '#7070a0' }[severity] || '#7070a0'
}

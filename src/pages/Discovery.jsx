import { useState, useEffect } from 'react'
import { useDiscovery } from '../hooks/useBackend'

const THESIS_STYLE = {
  MOMENTUM_BREAKOUT:     { color: '#00ff88', bg: 'rgba(0,255,136,0.12)', icon: '🚀' },
  CONTRARIAN_LONG:       { color: '#00d4ff', bg: 'rgba(0,212,255,0.12)', icon: '⚡' },
  HIGH_CONVICTION_SHORT: { color: '#ff3355', bg: 'rgba(255,51,85,0.12)',  icon: '📉' },
  WATCH:                 { color: '#ffcc00', bg: 'rgba(255,204,0,0.10)',  icon: '👁' },
  MONITOR:               { color: '#7070a0', bg: 'rgba(112,112,160,0.08)', icon: '◈' },
}

const DIRECTION_COLOR = { BULLISH: '#00ff88', BEARISH: '#ff3355', NEUTRAL: '#ffcc00' }

function MiniBar({ label, score, color }) {
  const pct = Math.abs(score) * 50
  const c = score > 0.1 ? '#00ff88' : score < -0.1 ? '#ff3355' : '#ffcc00'
  return (
    <div style={{ marginBottom: 3 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 1 }}>
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, color: '#7070a0' }}>{label}</span>
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, color: c }}>{score >= 0 ? '+' : ''}{score.toFixed(2)}</span>
      </div>
      <div style={{ height: 3, background: '#1a1a2e', borderRadius: 2, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', height: '100%', width: `${pct}%`, background: c, left: score > 0 ? '50%' : `${50 - pct}%`, boxShadow: `0 0 3px ${c}50` }} />
        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: '#2a2a4a' }} />
      </div>
    </div>
  )
}

function SetupCard({ item, onSelect, rank }) {
  const style     = THESIS_STYLE[item.thesis] || THESIS_STYLE.MONITOR
  const dirColor  = DIRECTION_COLOR[item.direction] || '#7070a0'
  const convPct   = Math.round(item.convergence * 100)

  return (
    <div
      onClick={() => onSelect(item.ticker)}
      style={{
        background: '#0c0c18', border: '1px solid #1e1e35', borderRadius: 4,
        padding: '12px 14px', cursor: 'pointer', position: 'relative',
        transition: 'all 0.2s',
        borderLeft: `3px solid ${style.color}`,
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = '#2a2a4a'}
      onMouseLeave={e => e.currentTarget.style.borderColor = '#1e1e35'}
    >
      {/* Rank badge */}
      <div style={{ position: 'absolute', top: 8, right: 10, fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#404060' }}>#{rank}</div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 16, fontWeight: 700, color: '#e8e8f0' }}>{item.ticker}</span>
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, background: '#1e1e35', padding: '1px 6px', borderRadius: 2, color: '#7070a0' }}>{item.sector}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, padding: '1px 6px', borderRadius: 2, background: style.bg, color: style.color }}>
              {style.icon} {item.thesis.replace(/_/g, ' ')}
            </span>
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: dirColor }}>{item.direction}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {item.lastPrice > 0 && <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 13, color: '#e8e8f0' }}>${item.lastPrice.toFixed(2)}</div>}
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: item.ret5d >= 0 ? '#00ff88' : '#ff3355' }}>
            {item.ret5d >= 0 ? '+' : ''}{item.ret5d?.toFixed(2)}% 5d
          </div>
        </div>
      </div>

      {/* Convergence bar */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, color: '#404060', letterSpacing: '0.08em' }}>CONVERGENCE SCORE</span>
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: style.color, fontWeight: 600 }}>{convPct}%</span>
        </div>
        <div style={{ height: 5, background: '#1a1a2e', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${convPct}%`, background: `linear-gradient(90deg, ${style.color}80, ${style.color})`, borderRadius: 3, transition: 'width 0.6s ease', boxShadow: `0 0 6px ${style.color}40` }} />
        </div>
      </div>

      {/* Mini signal bars */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px' }}>
        <MiniBar label="MOMENTUM" score={item.momentumScore || 0} />
        <MiniBar label="SENTIMENT" score={item.sentimentScore || 0} />
      </div>

      {/* Headline */}
      {item.topHeadline && (
        <div style={{ marginTop: 8, fontSize: 9, color: '#404060', lineHeight: 1.4, fontStyle: 'italic', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          "{item.topHeadline}"
        </div>
      )}

      {!item.isLive && (
        <div style={{ marginTop: 4, fontFamily: 'IBM Plex Mono', fontSize: 8, color: '#404060' }}>● mock data</div>
      )}
    </div>
  )
}

function ScanStats({ data, source }) {
  if (!data) return null
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', fontFamily: 'IBM Plex Mono' }}>
      <span style={{ fontSize: 9, color: '#404060' }}>{data.scanned} tickers scanned</span>
      <span style={{ fontSize: 9, color: '#404060' }}>{data.elapsed}ms</span>
      <span style={{ fontSize: 9, color: source === 'live' ? '#00ff88' : '#404060' }}>
        ● {source === 'live' ? 'LIVE' : 'MOCK'}
      </span>
      <span style={{ fontSize: 9, color: '#404060' }}>
        {new Date(data.timestamp).toLocaleTimeString()}
      </span>
    </div>
  )
}

export default function Discovery({ setSelectedStock, setActivePage }) {
  const { results, loading, source, scan } = useDiscovery()
  const [filter, setFilter]  = useState('ALL')
  const [sortBy, setSortBy]  = useState('convergence')
  const [limit, setLimit]    = useState(12)

  useEffect(() => { scan(limit) }, [limit])

  const handleSelect = (ticker) => {
    setSelectedStock(ticker)
    setActivePage('dashboard')
  }

  const items = results?.results || []
  const filtered = items.filter(item => {
    if (filter === 'BULLISH')  return item.direction === 'BULLISH'
    if (filter === 'BEARISH')  return item.direction === 'BEARISH'
    if (filter === 'HIGH_CONV') return item.convergence > 0.45
    return true
  })
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'ret5d')    return b.ret5d - a.ret5d
    if (sortBy === 'score')    return Math.abs(b.score) - Math.abs(a.score)
    return b.convergence - a.convergence
  })

  const bullishCount = items.filter(i => i.direction === 'BULLISH').length
  const bearishCount = items.filter(i => i.direction === 'BEARISH').length
  const highConvCount = items.filter(i => i.convergence > 0.45).length

  return (
    <div style={{ padding: 20 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#404060', letterSpacing: '0.15em', marginBottom: 4 }}>
          AUTONOMOUS SCANNER
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 20, color: '#e8e8f0' }}>
            Discovery Engine
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <ScanStats data={results} source={source} />
            <button
              onClick={() => scan(limit)}
              disabled={loading}
              style={{
                padding: '6px 14px', fontFamily: 'IBM Plex Mono', fontSize: 10,
                background: loading ? '#1e1e35' : 'rgba(68,102,255,0.15)',
                border: `1px solid ${loading ? '#2a2a4a' : '#4466ff'}`,
                color: loading ? '#404060' : '#4466ff', cursor: loading ? 'wait' : 'pointer', borderRadius: 3,
              }}
            >
              {loading ? '⟳ SCANNING...' : '↻ RESCAN'}
            </button>
          </div>
        </div>
      </div>

      {/* Summary stats */}
      {items.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'SETUPS FOUND',    value: items.length,    color: '#e8e8f0' },
            { label: 'BULLISH',          value: bullishCount,    color: '#00ff88' },
            { label: 'BEARISH',          value: bearishCount,    color: '#ff3355' },
            { label: 'HIGH CONVICTION',  value: highConvCount,   color: '#4466ff' },
          ].map(item => (
            <div key={item.label} style={{ background: '#0d0d16', border: '1px solid #1e1e35', borderRadius: 4, padding: '10px 14px' }}>
              <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#404060', marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 22, fontWeight: 600, color: item.color }}>{item.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#404060' }}>FILTER:</span>
        {['ALL', 'BULLISH', 'BEARISH', 'HIGH_CONV'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '4px 10px', fontFamily: 'IBM Plex Mono', fontSize: 9,
            background: filter === f ? 'rgba(68,102,255,0.15)' : 'transparent',
            border: `1px solid ${filter === f ? '#4466ff' : '#1e1e35'}`,
            color: filter === f ? '#4466ff' : '#404060', cursor: 'pointer', borderRadius: 3,
          }}>{f.replace(/_/g, ' ')}</button>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#404060' }}>SORT:</span>
        {[['convergence', 'CONVERGENCE'], ['score', 'SCORE'], ['ret5d', '5D RETURN']].map(([k, l]) => (
          <button key={k} onClick={() => setSortBy(k)} style={{
            padding: '4px 10px', fontFamily: 'IBM Plex Mono', fontSize: 9,
            background: sortBy === k ? 'rgba(68,102,255,0.10)' : 'transparent',
            border: `1px solid ${sortBy === k ? '#4466ff' : '#1e1e35'}`,
            color: sortBy === k ? '#4466ff' : '#404060', cursor: 'pointer', borderRadius: 3,
          }}>{l}</button>
        ))}
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#404060' }}>SHOW:</span>
        {[8, 12, 20].map(n => (
          <button key={n} onClick={() => setLimit(n)} style={{
            padding: '4px 8px', fontFamily: 'IBM Plex Mono', fontSize: 9,
            background: limit === n ? 'rgba(68,102,255,0.10)' : 'transparent',
            border: `1px solid ${limit === n ? '#4466ff' : '#1e1e35'}`,
            color: limit === n ? '#4466ff' : '#404060', cursor: 'pointer', borderRadius: 3,
          }}>{n}</button>
        ))}
      </div>

      {/* Results grid */}
      {loading && items.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12 }}>
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: '#404060', letterSpacing: '0.1em' }}>
            SCANNING {results?.universe?.length || '...'} TICKERS...
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {Array(5).fill(0).map((_, i) => (
              <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#4466ff', animation: `blink 1.2s ${i * 0.2}s infinite` }} />
            ))}
          </div>
        </div>
      ) : sorted.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10 }}>
          {sorted.map((item, i) => (
            <SetupCard key={item.ticker} item={item} onSelect={handleSelect} rank={i + 1} />
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 60, fontFamily: 'IBM Plex Mono', fontSize: 12, color: '#404060' }}>
          No setups found matching current filters. Click RESCAN to refresh.
        </div>
      )}
    </div>
  )
}

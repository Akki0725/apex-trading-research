// src/components/ConvergenceTree/DrilldownSidebar.jsx
// Sidebar that opens when a user clicks a layer node in the Convergence Tree.
// "View Evidence" navigates to Analysis.jsx passing rawData via React Router state.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { sparklinePath } from '../../utils/convergenceLogic'

const LAYER_META = {
  macro:       { shortName: 'MACRO', color: '#ff55aa', label: 'Macroeconomic',     icon: '🌐',
                 rawKeys: ['VIX Level', '10Y Yield', 'Yield Spread', 'S&P 20d', 'Regime'] },
  sector:      { shortName: 'SECT',  color: '#8855ff', label: 'Sector & Industry',  icon: '🏭',
                 rawKeys: ['ETF 20d Return', 'SPY 20d', 'Relative Perf', 'Ticker 20d'] },
  event:       { shortName: 'EVENT', color: '#ffcc00', label: 'Event Detection',    icon: '⚠️',
                 rawKeys: ['Primary Event', 'Earnings Date', 'Catalyst Strength', 'News Count'] },
  sentiment:   { shortName: 'SENT',  color: '#ff6644', label: 'News Sentiment',     icon: '📰',
                 rawKeys: ['WSB Posts', 'r/stocks Posts', 'Crowd Emotion', 'Divergence'] },
  fundamental: { shortName: 'FUND',  color: '#4466ff', label: 'Fundamentals',       icon: '📊',
                 rawKeys: ['EPS Surprise', 'Revenue Growth', 'EPS Beat History', 'Fwd P/E'] },
  commodity:   { shortName: 'CMDTY', color: '#ffaa00', label: 'Supply Chain',       icon: '⛽',
                 rawKeys: ['Primary Commodity', 'Input Costs', 'Supply Chain', 'Margin Impact'] },
  historical:  { shortName: 'HIST',  color: '#00ff88', label: 'Historical Analog',  icon: '📈',
                 rawKeys: ['Top Similarity', 'Match Ticker', 'Win Rate', 'Analog Count'] },
  momentum:    { shortName: 'MOMT',  color: '#00d4ff', label: 'Price Momentum',     icon: '⚡',
                 rawKeys: ['RSI (14)', 'MACD Signal', 'Price vs 20d MA', '20d Return'] },
  options:     { shortName: 'OPTN',  color: '#55ffcc', label: 'Options Flow',       icon: '🎯',
                 rawKeys: ['Put/Call Ratio', 'Avg IV %', 'Unusual Calls', 'Unusual Puts'] },
}

// Build readable display values from live rawData only — no mock
function extractDisplayValues(layerId, rawData, score) {
  const r = rawData || {}
  if (!rawData) return buildNoData(layerId)

  const map = {
    macro:       [[`${r.vixLast ?? '—'}`,         r.vixLast > 30 ? -1 : r.vixLast < 15 ? 1 : 0],
                  [`${r.tnxLast ?? '—'}%`,         r.tnxLast > 5 ? -0.5 : 0.2],
                  [`${r.yieldSpread ?? '—'}%`,      r.yieldSpread < 0 ? -1 : 0.5],
                  [`${r.sp20dRet ?? '—'}%`,         r.sp20dRet > 0 ? 1 : -1],
                  [r.geminiRegime || (score > 0.3 ? 'BULL' : score < -0.3 ? 'BEAR' : 'NEUTRAL'), score]],
    sector:      [[`${r.etfRet ?? '—'}%`,           r.etfRet > 0 ? 1 : -1],
                  [`${r.spyRet ?? '—'}%`,            0.2],
                  [`${r.relPerf ?? '—'}%`,           r.relPerf > 0 ? 1 : -1],
                  [`${r.tickerRet ?? '—'}%`,         r.tickerRet > 0 ? 1 : -1]],
    event:       [[r.primaryEventType || 'NONE',     score],
                  [r.earningsDate     || 'Unknown',  r.earningsDate ? 0.5 : 0],
                  [r.geminiMagnitude  || (Math.abs(score) > 0.5 ? 'HIGH' : 'MEDIUM'), score],
                  [`${r.newsCount ?? 0} articles`,   Math.min(1, (r.newsCount || 0) / 20)]],
    sentiment:   [[`${r.wsbPostCount ?? 0} posts`,   Math.min(1, (r.wsbPostCount || 0) / 15)],
                  [`${r.stocksPostCount ?? 0} posts`, Math.min(1, (r.stocksPostCount || 0) / 15)],
                  [r.geminiCrowdEmotion || r.crowdEmotion || 'MIXED', score],
                  [r.divergenceWarning ? '⚠ YES' : 'NO', r.divergenceWarning ? -0.5 : 0.5]],
    fundamental: [[`${r.epsSurprisePct ?? '—'}%`,    r.epsSurprisePct > 0 ? 1 : -1],
                  [`${r.revenueGrowth  ?? '—'}%`,    r.revenueGrowth  > 0 ? 1 : -1],
                  [r.epsBeats           || '—',       score],
                  [r.forwardPE ? `${r.forwardPE.toFixed ? r.forwardPE.toFixed(1) : r.forwardPE}x` : '—', score]],
    commodity:   [[r.primaryCommodity                        || 'N/A',                  0],
                  [score > 0 ? 'DECLINING' : 'RISING',        score],
                  [r.geminiSupplyChainHealth || (score > 0 ? 'STRONG' : 'DISRUPTED'), score],
                  [score > 0.2 ? 'EXPAND' : score < -0.2 ? 'COMPRESS' : 'NEUTRAL',    score]],
    historical:  [[r.topSimilarity != null ? `${(r.topSimilarity * 100).toFixed(0)}%` : '—', r.topSimilarity > 0.85 ? 1 : 0.5],
                  [r.analogs?.[0]?.ticker                    || 'None',                 0],
                  [r.winRate != null ? `${r.winRate}%` : '—', r.winRate > 55 ? 1 : r.winRate < 45 ? -1 : 0],
                  [`${r.analogCount ?? 0}`,                   Math.min(1, (r.analogCount || 0) / 5)]],
    momentum:    [[`${r.rsi != null ? r.rsi.toFixed(0) : '—'}`, r.rsi > 70 ? -0.5 : r.rsi < 30 ? 0.5 : 0.2],
                  [r.macdBullish ? 'BULLISH' : 'BEARISH',     r.macdBullish ? 1 : -1],
                  [r.price && r.ma20 ? `${((r.price - r.ma20) / r.ma20 * 100).toFixed(1)}%` : '—', score],
                  [`${r.ret20d ?? '—'}%`,                      r.ret20d > 0 ? 1 : -1]],
    options:     [[`${r.putCallRatio ?? '—'}`,                  r.putCallRatio < 0.7 ? 1 : r.putCallRatio > 1.5 ? -1 : 0],
                  [`${r.avgIV ?? '—'}%`,                        r.avgIV > 80 ? -0.5 : 0.2],
                  [`${r.unusualCalls ?? 0} strikes`,            r.unusualCalls > 2 ? 1 : 0],
                  [`${r.unusualPuts  ?? 0} strikes`,            r.unusualPuts  > 2 ? -1 : 0]],
  }
  return map[layerId] || buildNoData(layerId)
}

function buildNoData(layerId) {
  const meta = LAYER_META[layerId]
  const keys = meta?.rawKeys || ['—']
  return keys.map(k => [k, 0])
}

function Sparkline({ data, color, width = 100, height = 32 }) {
  if (!data || data.length < 2) return null
  const path  = sparklinePath(data, width, height)
  const lastY = height - ((data[data.length - 1] + 1) / 2) * height
  return (
    <svg width={width} height={height}>
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} opacity={0.7} />
      <circle cx={width} cy={Math.max(3, Math.min(height - 3, lastY))} r={3} fill={color} />
    </svg>
  )
}

function SubSignalRow({ sub }) {
  const c = sub.score > 0.1 ? '#00ff88' : sub.score < -0.1 ? '#ff3355' : '#ffcc00'
  return (
    <div style={{ marginBottom: 7 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#7070a0' }}>{sub.name}</span>
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: c }}>{sub.score >= 0 ? '+' : ''}{sub.score.toFixed(2)}</span>
      </div>
      <div style={{ height: 3, background: '#1a1a2e', borderRadius: 2, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', height: '100%', width: `${Math.abs(sub.score) * 50}%`, background: c, left: sub.score > 0 ? '50%' : `${50 - Math.abs(sub.score) * 50}%` }} />
        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: '#2a2a4a' }} />
      </div>
    </div>
  )
}

function RawDataRow({ label, value, score }) {
  const c = typeof score === 'number' ? (score > 0 ? '#00ff88' : score < 0 ? '#ff3355' : '#7070a0') : '#7070a0'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #0e0e1a' }}>
      <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#7070a0' }}>{label}</span>
      <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: c }}>{String(value)}</span>
    </div>
  )
}

function SourceBadge({ sources }) {
  if (!sources) return null
  const flags = [
    sources.serp   && { label: 'WEB',    color: '#4466ff' },
    sources.jina   && { label: 'JINA',   color: '#8855ff' },
    sources.gemini && { label: 'GEMINI', color: '#00d4ff' },
    sources.reddit && { label: 'REDDIT', color: '#ff6644' },
    sources.live   && !sources.serp && !sources.reddit && { label: 'LIVE', color: '#00ff88' },
  ].filter(Boolean)
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
      {flags.map(f => (
        <span key={f.label} style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, padding: '2px 5px', borderRadius: 2, background: `${f.color}18`, border: `1px solid ${f.color}40`, color: f.color }}>{f.label}</span>
      ))}
      {!flags.length && (
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, padding: '2px 5px', borderRadius: 2, background: '#1a1a2e', color: '#404060' }}>NO DATA</span>
      )}
    </div>
  )
}

export default function DrilldownSidebar({ node, signals, onClose, onSimulate, simulatedOverrides }) {
  const [rawExpanded, setRawExpanded] = useState(false)
  const [simMode, setSimMode]         = useState(false)
  const navigate                      = useNavigate()

  if (!node) return null

  const layerId     = node.data?.signal?.id || node.id
  const meta        = LAYER_META[layerId]
  if (!meta) return null

  const signal      = signals.find(s => s.id === layerId)
  const score       = node.data?.score ?? signal?.score ?? 0
  const isSimulated = simulatedOverrides?.[layerId] !== undefined
  const simValue    = simulatedOverrides?.[layerId] ?? score
  const scoreColor  = score > 0.12 ? '#00ff88' : score < -0.12 ? '#ff3355' : '#ffcc00'
  const rawValues   = extractDisplayValues(layerId, signal?.rawData, score)

  const articleCount  = signal?.rawData?.articles?.length    || 0
  const redditCount   = signal?.rawData?.redditPosts?.length || 0
  const hasEvidence   = articleCount > 0 || redditCount > 0
  const evidenceCount = articleCount + redditCount

  // Navigate to Analysis.jsx with full rawData payload in router state
  const handleLearnMore = () => {
    navigate('/analysis', {
      state: {
        activeLayer: layerId,
        rawData:     signal?.rawData    || {},
        reasoning:   signal?.reasoning  || '',
        score,
        confidence:  signal?.confidence || 0,
        weight:      signal?.weight     || 0,
        subSignals:  signal?.subSignals || [],
        ticker:      node.data?.ticker  || '',
      }
    })
    onClose()
  }

  const handleSimChange = (val) => onSimulate(layerId, +val)
  const clearSim        = ()    => onSimulate(layerId, undefined)

  return (
    <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 320, background: '#09090f', borderLeft: `1px solid ${meta.color}30`, display: 'flex', flexDirection: 'column', zIndex: 50, animation: 'slideInRight 0.22s ease' }}>

      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #1e1e35', background: 'linear-gradient(135deg, #0d0d1a, #0a0a14)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: meta.color, letterSpacing: '0.12em', marginBottom: 3 }}>{meta.icon} {meta.shortName} — LAYER ANALYSIS</div>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 14, fontWeight: 600, color: '#e8e8f0' }}>{meta.label}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid #1e1e35', color: '#7070a0', cursor: 'pointer', fontSize: 14, width: 26, height: 26, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
          <div>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 28, fontWeight: 700, color: scoreColor, lineHeight: 1 }}>{score >= 0 ? '+' : ''}{score.toFixed(3)}</div>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#404060', marginTop: 2 }}>{isSimulated ? '⚙ SIMULATED VALUE' : 'CURRENT SCORE'}</div>
          </div>
          <Sparkline data={node.data?.sparkline} color={meta.color} />
        </div>
        <SourceBadge sources={signal?.sources || signal?.rawData?.sources} />
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

        {/* Reasoning */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#404060', letterSpacing: '0.1em', marginBottom: 8 }}>
            {signal?.sources?.gemini ? '🤖 GEMINI REASONING' : 'LAYER REASONING'}
          </div>
          <div style={{ background: '#0c0c18', border: `1px solid ${signal?.sources?.gemini ? '#00d4ff20' : '#1e1e35'}`, borderRadius: 4, padding: '10px 12px' }}>
            <p style={{ fontSize: 11, color: '#a0a0c0', lineHeight: 1.7, margin: 0 }}>{signal?.reasoning || 'No reasoning data available.'}</p>
            {signal?.rawData?.geminiKeyFactors?.length > 0 && (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #1a1a2e' }}>
                {signal.rawData.geminiKeyFactors.map((f, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 3 }}>
                    <span style={{ color: '#00d4ff', fontSize: 9, fontFamily: 'IBM Plex Mono', flexShrink: 0 }}>►</span>
                    <span style={{ fontSize: 10, color: '#7070a0', fontFamily: 'IBM Plex Mono' }}>{f}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sub-signals */}
        {signal?.subSignals && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#404060', letterSpacing: '0.1em', marginBottom: 8 }}>SUB-SIGNALS</div>
            {signal.subSignals.map((sub, i) => <SubSignalRow key={i} sub={sub} />)}
          </div>
        )}

        {/* Key metrics (collapsible) */}
        <div style={{ marginBottom: 16 }}>
          <button onClick={() => setRawExpanded(!rawExpanded)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0c0c18', border: '1px solid #1e1e35', borderRadius: rawExpanded ? '4px 4px 0 0' : 4, padding: '8px 12px', cursor: 'pointer' }}>
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#7070a0', letterSpacing: '0.1em' }}>KEY METRICS</span>
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: meta.color }}>{rawExpanded ? '▲' : '▼ EXPAND'}</span>
          </button>
          {rawExpanded && (
            <div style={{ background: '#0c0c18', border: '1px solid #1e1e35', borderTop: 'none', borderRadius: '0 0 4px 4px', padding: '4px 12px 8px' }}>
              {rawValues.map((item, i) => {
                const [val, s] = Array.isArray(item) ? item : [item, 0]
                return <RawDataRow key={i} label={meta.rawKeys?.[i] || `Value ${i+1}`} value={val} score={typeof s === 'number' ? s : 0} />
              })}
            </div>
          )}
        </div>

        {/* Evidence preview */}
        {hasEvidence && (
          <div style={{ marginBottom: 16, background: '#0c0c18', border: '1px solid #1e1e35', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #0e0e1a', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#7070a0', letterSpacing: '0.1em' }}>EVIDENCE PREVIEW</span>
              <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#404060' }}>{evidenceCount} sources</span>
            </div>
            {(signal.rawData.articles || []).slice(0, 2).map((a, i) => (
              <div key={`a${i}`} style={{ padding: '8px 12px', borderBottom: '1px solid #0e0e1a', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ color: '#4466ff', fontSize: 9, fontFamily: 'IBM Plex Mono', marginTop: 2, flexShrink: 0 }}>◈</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#a0a0c0', marginBottom: 2, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</div>
                  <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, color: '#404060' }}>{a.source}</div>
                </div>
              </div>
            ))}
            {(signal.rawData.redditPosts || []).slice(0, 1).map((p, i) => (
              <div key={`r${i}`} style={{ padding: '8px 12px', borderBottom: '1px solid #0e0e1a', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ color: '#ff6644', fontSize: 9, fontFamily: 'IBM Plex Mono', marginTop: 2, flexShrink: 0 }}>◈</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#a0a0c0', marginBottom: 2, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                  <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, color: '#ff6644' }}>{p.subreddit} · {p.ups?.toLocaleString()} upvotes</div>
                </div>
              </div>
            ))}
            <div style={{ padding: '5px 12px' }}>
              <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, color: '#404060' }}>{evidenceCount > 3 ? `+ ${evidenceCount - 3} more in Evidence view` : `${evidenceCount} source${evidenceCount > 1 ? 's' : ''} total`}</span>
            </div>
          </div>
        )}

        {/* Simulation mode */}
        <div style={{ border: '1px solid #1e1e35', borderRadius: 4, overflow: 'hidden' }}>
          <button onClick={() => setSimMode(!simMode)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: simMode ? 'rgba(68,102,255,0.12)' : '#0c0c18', border: 'none', padding: '8px 12px', cursor: 'pointer', borderBottom: simMode ? '1px solid #1e1e35' : 'none' }}>
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#4466ff', letterSpacing: '0.1em' }}>⚙ SIMULATION MODE</span>
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: isSimulated ? '#ffcc00' : '#404060' }}>{isSimulated ? '● ACTIVE' : simMode ? '▲' : '▼'}</span>
          </button>
          {simMode && (
            <div style={{ background: '#0a0a14', padding: '12px 12px 14px' }}>
              <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#7070a0', marginBottom: 8 }}>Drag to override this layer's score and watch downstream nodes update.</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#ff3355' }}>-1.00</span>
                <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, fontWeight: 700, color: '#4466ff' }}>{(+simValue).toFixed(2)}</span>
                <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#00ff88' }}>+1.00</span>
              </div>
              <input type="range" min={-100} max={100} step={1} value={Math.round((+simValue) * 100)} onChange={e => handleSimChange((+e.target.value) / 100)} style={{ width: '100%', accentColor: '#4466ff', marginBottom: 8 }} />
              <div style={{ display: 'flex', gap: 6 }}>
                {[-1, -0.5, 0, 0.5, 1].map(v => (
                  <button key={v} onClick={() => handleSimChange(v)} style={{ flex: 1, padding: '4px 0', fontFamily: 'IBM Plex Mono', fontSize: 8, background: '#111120', border: '1px solid #1e1e35', color: '#7070a0', cursor: 'pointer', borderRadius: 2 }}>{v > 0 ? '+' : ''}{v.toFixed(1)}</button>
                ))}
              </div>
              {isSimulated && (
                <button onClick={clearSim} style={{ width: '100%', marginTop: 8, padding: '5px', fontFamily: 'IBM Plex Mono', fontSize: 9, background: 'rgba(255,51,85,0.1)', border: '1px solid rgba(255,51,85,0.3)', color: '#ff3355', cursor: 'pointer', borderRadius: 2, letterSpacing: '0.08em' }}>✕ CLEAR SIMULATION</button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ flexShrink: 0, borderTop: '1px solid #1e1e35' }}>
        <div style={{ padding: '10px 16px', display: 'flex', gap: 12 }}>
          {[
            { label: 'CONFIDENCE', value: `${((signal?.confidence || 0.5) * 100).toFixed(0)}%`, color: meta.color },
            { label: 'WEIGHT',     value: `${((signal?.weight     || 0.1) * 100).toFixed(1)}%`, color: '#7070a0' },
          ].map(item => (
            <div key={item.label} style={{ flex: 1, background: '#0c0c18', borderRadius: 3, padding: '6px 8px', border: '1px solid #1e1e35' }}>
              <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, color: '#404060', marginBottom: 2 }}>{item.label}</div>
              <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 14, fontWeight: 600, color: item.color }}>{item.value}</div>
            </div>
          ))}
        </div>

        {/* ── VIEW EVIDENCE BUTTON ── */}
        <div style={{ padding: '0 16px 14px' }}>
          <button
            onClick={handleLearnMore}
            style={{
              width: '100%', padding: '10px 16px', fontFamily: 'IBM Plex Mono', fontSize: 11,
              fontWeight: 600, letterSpacing: '0.10em', cursor: 'pointer', borderRadius: 4,
              border: `1px solid ${meta.color}60`,
              background: `linear-gradient(135deg, ${meta.color}14, ${meta.color}06)`,
              color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = `${meta.color}22`; e.currentTarget.style.borderColor = `${meta.color}90` }}
            onMouseLeave={e => { e.currentTarget.style.background = `linear-gradient(135deg, ${meta.color}14, ${meta.color}06)`; e.currentTarget.style.borderColor = `${meta.color}60` }}
          >
            <span style={{ fontSize: 13 }}>◈</span>
            VIEW EVIDENCE
            {hasEvidence && (
              <span style={{ background: meta.color, color: '#000', borderRadius: 10, padding: '1px 6px', fontSize: 9, fontWeight: 700 }}>
                {evidenceCount}
              </span>
            )}
            <span style={{ marginLeft: 'auto' }}>→</span>
          </button>
          {!hasEvidence && (
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, color: '#404060', textAlign: 'center', marginTop: 5, lineHeight: 1.5 }}>
              Add SERP_API_KEY + GEMINI_API_KEY to backend/.env<br/>to enable live article scraping
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

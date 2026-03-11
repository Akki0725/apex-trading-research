import { useState, useEffect, useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { DEFAULT_SYMBOLS } from '../data/constants'
import ConvergenceTree from '../components/ConvergenceTree/ConvergenceTree'
import { useAnalysis } from '../hooks/useBackend'

// Derive prediction from real backend signals (no mock)
function predictionFromSignals(signals) {
  if (!signals?.length) return null
  const totalWeight = signals.reduce((s, l) => s + (l.weight ?? 0.11), 0)
  const weightedScore = signals.reduce((s, l) => s + (l.score ?? 0) * (l.weight ?? 0.11), 0) / totalWeight
  const avgConf = signals.reduce((s, l) => s + (l.confidence ?? 0.5), 0) / signals.length
  return {
    score: weightedScore,
    direction: weightedScore > 0.05 ? 'BULLISH' : weightedScore < -0.05 ? 'BEARISH' : 'NEUTRAL',
    probability: 0.5 + weightedScore * 0.45,
    confidence: avgConf,
    targetMove: weightedScore * 8,
    horizon: '5 days',
  }
}

function CustomTooltip({ active, payload, label }) {
  if (active && payload?.length) {
    return (
      <div style={{ background: '#111120', border: '1px solid #2a2a4a', borderRadius: 4, padding: '7px 11px' }}>
        <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: '#7070a0', marginBottom: 3 }}>{label}</div>
        <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: '#4466ff' }}>
          ${payload[0]?.value?.toFixed(2)}
        </div>
      </div>
    )
  }
  return null
}

function StockHeader({ symbol, prediction }) {
  const predColor = prediction?.direction === 'BULLISH' ? '#00ff88'
                  : prediction?.direction === 'BEARISH' ? '#ff3355' : '#ffcc00'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16,
      background: '#0d0d16', borderBottom: '1px solid #1e1e35',
      padding: '10px 20px', flexShrink: 0, flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 20, fontWeight: 700, color: '#e8e8f0' }}>
          {symbol}
        </span>
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, background: '#1e1e35', padding: '1px 7px', borderRadius: 2, color: '#7070a0' }}>
          Live pipeline data
        </span>
      </div>

      <div style={{ flex: 1 }} />

      {prediction && (
        <div style={{
          display: 'flex', gap: 12, alignItems: 'center',
          background: '#111120', border: `1px solid ${predColor}30`, borderRadius: 4, padding: '6px 14px',
        }}>
          <div>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, color: '#404060', letterSpacing: '0.1em', marginBottom: 1 }}>AI PREDICTION</div>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 15, fontWeight: 700, color: predColor }}>{prediction.direction}</div>
          </div>
          <div style={{ width: 1, background: '#1e1e35', alignSelf: 'stretch' }} />
          <div>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, color: '#404060', marginBottom: 1 }}>PROBABILITY</div>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 15, fontWeight: 600, color: '#e8e8f0' }}>
              {(prediction.probability * 100).toFixed(1)}%
            </div>
          </div>
          <div style={{ width: 1, background: '#1e1e35', alignSelf: 'stretch' }} />
          <div>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, color: '#404060', marginBottom: 1 }}>TARGET / 5D</div>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 15, fontWeight: 600, color: predColor }}>
              {prediction.targetMove >= 0 ? '+' : ''}{prediction.targetMove}%
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Dashboard({ selectedStock, setSelectedStock }) {
  const { signals, loading: analysisLoading, source: dataSource, metadata, analyze, error } = useAnalysis()
  const [view, setView] = useState('tree')

  useEffect(() => {
    analyze(selectedStock)
  }, [selectedStock, analyze])

  const prediction = useMemo(() => predictionFromSignals(signals), [signals])
  const chartData = useMemo(() => [], [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Stock selector strip */}
      <div style={{
        display: 'flex', gap: 6, padding: '10px 20px',
        background: '#07070e', borderBottom: '1px solid #1e1e35',
        overflowX: 'auto', flexShrink: 0,
      }}>
        {DEFAULT_SYMBOLS.map(sym => (
          <button key={sym} onClick={() => setSelectedStock(sym)} style={{
            padding: '5px 13px', borderRadius: 3, cursor: 'pointer', flexShrink: 0,
            background: selectedStock === sym ? 'rgba(68,102,255,0.2)' : '#0d0d16',
            border: `1px solid ${selectedStock === sym ? '#4466ff' : '#1e1e35'}`,
            color: selectedStock === sym ? '#e8e8f0' : '#7070a0',
            fontFamily: 'IBM Plex Mono', fontSize: 11, transition: 'all 0.15s',
          }}>
            {sym}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {/* Data source indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {analysisLoading && (
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#4466ff', letterSpacing: '0.08em' }}>
              ⟳ ANALYZING...
            </span>
          )}
          {dataSource === 'live' && !analysisLoading && (
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#00ff88' }}>
              ● LIVE DATA
            </span>
          )}
          {error && !analysisLoading && (
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#ff3355' }}>{error}</span>
          )}
          {metadata?.elapsed > 0 && (
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#404060' }}>{metadata.elapsed}ms</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
          {[{ id: 'tree', label: '◈ XAI TREE' }, { id: 'chart', label: '◎ CHART' }].map(v => (
            <button key={v.id} onClick={() => setView(v.id)} style={{
              padding: '4px 12px', fontFamily: 'IBM Plex Mono', fontSize: 10,
              background: view === v.id ? 'rgba(68,102,255,0.15)' : 'transparent',
              border: `1px solid ${view === v.id ? '#4466ff' : '#1e1e35'}`,
              color: view === v.id ? '#4466ff' : '#404060',
              cursor: 'pointer', borderRadius: 3,
            }}>{v.label}</button>
          ))}
        </div>
      </div>

      {/* Memory alerts banner */}
      {metadata?.memoryAlerts?.length > 0 && (
        <div style={{ padding: '8px 20px', background: 'rgba(255,51,85,0.06)', borderBottom: '1px solid rgba(255,51,85,0.3)', flexShrink: 0 }}>
          {metadata.memoryAlerts.map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff3355', flexShrink: 0 }} />
              <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#ff3355', letterSpacing: '0.06em' }}>
                ⚡ MEMORY MATCH {(a.similarity * 100).toFixed(0)}%: {a.message}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Stock header */}
      <StockHeader symbol={selectedStock} prediction={prediction} />

      {/* Main content */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {view === 'tree' ? (
          analysisLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
              <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: '#4466ff', letterSpacing: '0.1em' }}>
                RUNNING 9-LAYER PIPELINE...
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {Array(5).fill(0).map((_, i) => (
                  <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#4466ff', animation: `blink 1.2s ${i * 0.24}s infinite` }} />
                ))}
              </div>
              <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#404060' }}>Macro → Sector → Event → Sentiment → Fundamentals → Commodity → Historical → Momentum → Options</div>
            </div>
          ) : signals.length > 0 ? (
            <ConvergenceTree signals={signals} ticker={selectedStock} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: '#404060' }}>Loading signals…</span>
            </div>
          )
        ) : (
          <div style={{ padding: 20, height: '100%', boxSizing: 'border-box', overflowY: 'auto' }}>
            <div style={{ background: '#0d0d16', border: '1px solid #1e1e35', borderRadius: 4, padding: 16 }}>
              <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: '#404060', letterSpacing: '0.1em', marginBottom: 16 }}>
                PRICE CHART — 30D
              </div>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4466ff" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#4466ff" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1e35" />
                    <XAxis dataKey="date" tick={{ fill: '#404060', fontSize: 9, fontFamily: 'IBM Plex Mono' }} tickLine={false} axisLine={{ stroke: '#1e1e35' }} interval={4} />
                    <YAxis tick={{ fill: '#404060', fontSize: 9, fontFamily: 'IBM Plex Mono' }} tickLine={false} axisLine={false} tickFormatter={v => `$${v.toFixed(0)}`} width={50} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="price" stroke="#4466ff" strokeWidth={2} fill="url(#priceGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a12', borderRadius: 4 }}>
                  <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: '#404060' }}>No price history — chart data from live feed only</span>
                </div>
              )}
            </div>

            <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {signals.map(layer => {
                const c = layer.score > 0.1 ? '#00ff88' : layer.score < -0.1 ? '#ff3355' : '#ffcc00'
                return (
                  <div key={layer.id} style={{ background: '#0d0d16', border: '1px solid #1e1e35', borderLeft: `3px solid ${layer.color}`, borderRadius: 4, padding: '10px 12px' }}>
                    <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#404060', marginBottom: 2 }}>{layer.shortName}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: '#c8c8e0' }}>{layer.name}</span>
                      <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 14, fontWeight: 700, color: c }}>{layer.score >= 0 ? '+' : ''}{layer.score.toFixed(2)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

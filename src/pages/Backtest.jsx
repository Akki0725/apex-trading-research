import { useState, useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, ReferenceLine } from 'recharts'

const EMPTY_BACKTEST = {
  stats: { totalReturn: 0, winRate: 0, totalTrades: 0, avgWin: 0, avgLoss: 0, profitFactor: 0, sharpe: 0, maxDrawdown: 0, finalEquity: 100000 },
  equityCurve: [],
  trades: [],
}

function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: '#111120', border: '1px solid #2a2a4a', borderRadius: '4px', padding: '8px 12px' }}>
        <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: '#7070a0', marginBottom: '4px' }}>{label}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ fontFamily: 'IBM Plex Mono', fontSize: '11px', color: p.color }}>
            {p.name}: ${typeof p.value === 'number' ? p.value.toLocaleString(undefined, {maximumFractionDigits: 0}) : p.value}
          </div>
        ))}
      </div>
    )
  }
  return null
}

function StatCard({ label, value, sub, color = '#e8e8f0', highlight = false }) {
  return (
    <div style={{
      background: highlight ? 'rgba(68, 102, 255, 0.08)' : '#0d0d16',
      border: `1px solid ${highlight ? 'rgba(68, 102, 255, 0.3)' : '#1e1e35'}`,
      borderRadius: '4px', padding: '14px 16px',
    }}>
      <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#404060', letterSpacing: '0.1em', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '22px', fontWeight: 600, color }}>{value}</div>
      {sub && <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: '#7070a0', marginTop: '2px' }}>{sub}</div>}
    </div>
  )
}

export default function Backtest() {
  const [results] = useState(EMPTY_BACKTEST)
  const [weightConfig, setWeightConfig] = useState({
    fundamental: 15,
    momentum: 12,
    sector: 10,
    commodity: 8,
    sentiment: 11,
    historical: 14,
    macro: 10,
    options: 10,
    event: 10,
  })
  const [horizon, setHorizon] = useState(5)
  const [running, setRunning] = useState(false)
  const [ran, setRan] = useState(true)

  const { stats, equityCurve, trades } = results

  const equityReturn = ((stats.finalEquity - 100000) / 100000 * 100)
  const returnColor = equityReturn >= 0 ? '#00ff88' : '#ff3355'

  const tradeData = trades.map(t => ({
    ...t,
    pnlK: t.pnl / 1000,
  }))

  function runBacktest() {
    setRunning(true)
    setTimeout(() => {
      setRunning(false)
      setRan(true)
    }, 1800)
  }

  const totalWeight = Object.values(weightConfig).reduce((a, b) => a + b, 0)

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#404060', letterSpacing: '0.15em', marginBottom: '4px' }}>STRATEGY RESEARCH</div>
      <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '20px', color: '#e8e8f0', marginBottom: '20px' }}>Backtest Engine</div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '16px' }}>
        {/* Config panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          {/* Parameters */}
          <div style={{ background: '#0d0d16', border: '1px solid #1e1e35', borderRadius: '4px', padding: '16px' }}>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#404060', letterSpacing: '0.1em', marginBottom: '14px' }}>STRATEGY PARAMETERS</div>
            
            <div style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: '#7070a0' }}>PREDICTION HORIZON</span>
                <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: '#4466ff' }}>{horizon} days</span>
              </div>
              <input type="range" min={1} max={20} value={horizon} onChange={e => setHorizon(+e.target.value)}
                style={{ width: '100%', accentColor: '#4466ff' }} />
            </div>

            {[
              { key: 'fundamental', label: 'FUNDAMENTAL', color: '#4466ff' },
              { key: 'momentum', label: 'MOMENTUM', color: '#00d4ff' },
              { key: 'sector', label: 'SECTOR', color: '#8855ff' },
              { key: 'commodity', label: 'COMMODITY', color: '#ffaa00' },
              { key: 'sentiment', label: 'SENTIMENT', color: '#ff6644' },
              { key: 'historical', label: 'HISTORICAL', color: '#00ff88' },
              { key: 'macro', label: 'MACRO', color: '#ff55aa' },
              { key: 'options', label: 'OPTIONS', color: '#55ffcc' },
              { key: 'event', label: 'EVENT', color: '#ffcc00' },
            ].map(({ key, label, color }) => (
              <div key={key} style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#7070a0' }}>{label}</span>
                  <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color }}>{weightConfig[key]}%</span>
                </div>
                <input
                  type="range" min={0} max={40} value={weightConfig[key]}
                  onChange={e => setWeightConfig(prev => ({ ...prev, [key]: +e.target.value }))}
                  style={{ width: '100%', accentColor: color }}
                />
              </div>
            ))}
            
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: '#111120', borderRadius: '3px', marginBottom: '12px' }}>
              <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#7070a0' }}>TOTAL WEIGHT</span>
              <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: totalWeight === 100 ? '#00ff88' : '#ffcc00' }}>
                {totalWeight}% {totalWeight !== 100 ? '⚠ should be 100' : '✓'}
              </span>
            </div>

            <button
              onClick={runBacktest}
              disabled={running}
              style={{
                width: '100%', padding: '10px', borderRadius: '3px', cursor: running ? 'not-allowed' : 'pointer',
                background: running ? '#1e1e35' : 'rgba(68, 102, 255, 0.2)',
                border: `1px solid ${running ? '#2a2a4a' : '#4466ff'}`,
                color: running ? '#404060' : '#4466ff',
                fontFamily: 'IBM Plex Mono', fontSize: '11px', letterSpacing: '0.1em',
                transition: 'all 0.15s',
              }}
            >
              {running ? '⟳ RUNNING...' : '▶ RUN BACKTEST'}
            </button>
          </div>

          {/* Stats summary */}
          {ran && (
            <div style={{ background: '#0d0d16', border: '1px solid #1e1e35', borderRadius: '4px', padding: '16px' }}>
              <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#404060', letterSpacing: '0.1em', marginBottom: '12px' }}>QUICK STATS</div>
              {[
                { label: 'Total Return', value: `${equityReturn >= 0 ? '+' : ''}${equityReturn.toFixed(2)}%`, color: returnColor },
                { label: 'Win Rate', value: `${stats.winRate}%`, color: '#e8e8f0' },
                { label: 'Profit Factor', value: `${stats.profitFactor}x`, color: stats.profitFactor > 1.5 ? '#00ff88' : '#ffcc00' },
                { label: 'Sharpe Ratio', value: stats.sharpe, color: stats.sharpe > 1.5 ? '#00ff88' : '#ffcc00' },
                { label: 'Max Drawdown', value: `${stats.maxDrawdown}%`, color: '#ff3355' },
                { label: 'Total Trades', value: stats.totalTrades, color: '#e8e8f0' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #1e1e35' }}>
                  <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: '#7070a0' }}>{item.label}</span>
                  <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: item.color }}>{item.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {ran && (
            <>
              {/* Stat cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                <StatCard label="TOTAL RETURN" value={`${equityReturn >= 0 ? '+' : ''}${equityReturn.toFixed(2)}%`} color={returnColor} highlight />
                <StatCard label="FINAL EQUITY" value={`$${stats.finalEquity.toLocaleString(undefined, {maximumFractionDigits: 0})}`} color="#e8e8f0" />
                <StatCard label="WIN RATE" value={`${stats.winRate}%`} color={stats.winRate > 55 ? '#00ff88' : '#ffcc00'} sub={`${stats.totalTrades} total trades`} />
                <StatCard label="SHARPE RATIO" value={stats.sharpe} color={stats.sharpe > 1.5 ? '#00ff88' : '#ffcc00'} sub="annualized" />
              </div>

              {/* Equity curve */}
              <div style={{ background: '#0d0d16', border: '1px solid #1e1e35', borderRadius: '4px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#404060', letterSpacing: '0.1em' }}>EQUITY CURVE</span>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#4466ff' }}>● Strategy</span>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={equityCurve} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4466ff" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#4466ff" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1e35" />
                    <XAxis dataKey="date" tick={{ fill: '#404060', fontSize: 9, fontFamily: 'IBM Plex Mono' }} tickLine={false} axisLine={{ stroke: '#1e1e35' }} interval={8} />
                    <YAxis tick={{ fill: '#404060', fontSize: 9, fontFamily: 'IBM Plex Mono' }} tickLine={false} axisLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} width={50} />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={100000} stroke="#2a2a4a" strokeDasharray="4 4" />
                    <Area type="monotone" dataKey="equity" name="Strategy" stroke="#4466ff" strokeWidth={2} fill="url(#equityGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* P&L per trade */}
              <div style={{ background: '#0d0d16', border: '1px solid #1e1e35', borderRadius: '4px', padding: '16px' }}>
                <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#404060', letterSpacing: '0.1em', marginBottom: '12px' }}>P&L PER TRADE ($K)</div>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={tradeData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1e35" />
                    <XAxis dataKey="symbol" tick={{ fill: '#404060', fontSize: 9 }} tickLine={false} axisLine={{ stroke: '#1e1e35' }} />
                    <YAxis tick={{ fill: '#404060', fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={v => `${v.toFixed(1)}k`} width={40} />
                    <ReferenceLine y={0} stroke="#2a2a4a" />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="pnlK" name="P&L (K)" radius={[2, 2, 0, 0]}>
                      {tradeData.map((entry, i) => (
                        <Cell key={i} fill={entry.pnl > 0 ? '#00ff88' : '#ff3355'} fillOpacity={0.7} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Trade log */}
              <div style={{ background: '#0d0d16', border: '1px solid #1e1e35', borderRadius: '4px', padding: '16px' }}>
                <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#404060', letterSpacing: '0.1em', marginBottom: '12px' }}>TRADE LOG</div>
                <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['#', 'DATE', 'SYMBOL', 'SIDE', 'DURATION', 'RETURN %', 'P&L'].map(h => (
                          <th key={h} style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#404060', padding: '4px 8px', textAlign: 'left', borderBottom: '1px solid #1e1e35', letterSpacing: '0.05em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {trades.map(trade => (
                        <tr key={trade.id} style={{ borderBottom: '1px solid #111120' }}>
                          <td style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: '#404060', padding: '5px 8px' }}>{trade.id}</td>
                          <td style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: '#7070a0', padding: '5px 8px' }}>{trade.date}</td>
                          <td style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: '#e8e8f0', padding: '5px 8px' }}>{trade.symbol}</td>
                          <td style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: trade.side === 'LONG' ? '#00ff88' : '#ff3355', padding: '5px 8px' }}>{trade.side}</td>
                          <td style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: '#7070a0', padding: '5px 8px' }}>{trade.duration}d</td>
                          <td style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: trade.won ? '#00ff88' : '#ff3355', padding: '5px 8px' }}>
                            {(trade.returnPct * 100) >= 0 ? '+' : ''}{(trade.returnPct * 100).toFixed(2)}%
                          </td>
                          <td style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: trade.won ? '#00ff88' : '#ff3355', padding: '5px 8px' }}>
                            {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

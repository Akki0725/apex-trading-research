import { useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { DEFAULT_SYMBOLS } from '../data/constants'

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

function OrderModal({ onClose, onSubmit }) {
  const [symbol, setSymbol] = useState('NVDA')
  const [side, setSide] = useState('LONG')
  const [shares, setShares] = useState(10)
  const [entryPrice, setEntryPrice] = useState('')
  const price = parseFloat(entryPrice) || 0
  const cost = shares * price

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#0d0d16', border: '1px solid #2a2a4a', borderRadius: '4px', padding: '24px', width: '360px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '12px', color: '#e8e8f0', letterSpacing: '0.1em' }}>NEW PAPER TRADE</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#7070a0', cursor: 'pointer', fontSize: '16px' }}>×</button>
        </div>
        
        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#404060', marginBottom: '6px', letterSpacing: '0.1em' }}>SYMBOL</div>
          <select value={symbol} onChange={e => setSymbol(e.target.value)}
            style={{ width: '100%', background: '#111120', border: '1px solid #2a2a4a', color: '#e8e8f0', fontFamily: 'IBM Plex Mono', fontSize: '12px', padding: '8px', borderRadius: '3px' }}>
            {DEFAULT_SYMBOLS.map(sym => <option key={sym} value={sym}>{sym}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#404060', marginBottom: '6px', letterSpacing: '0.1em' }}>ENTRY PRICE</div>
          <input type="number" value={entryPrice} onChange={e => setEntryPrice(e.target.value)} placeholder="e.g. 150.00" step="0.01" min={0}
            style={{ width: '100%', background: '#111120', border: '1px solid #2a2a4a', color: '#e8e8f0', fontFamily: 'IBM Plex Mono', fontSize: '14px', padding: '8px', borderRadius: '3px' }} />
        </div>

        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#404060', marginBottom: '6px', letterSpacing: '0.1em' }}>DIRECTION</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['LONG', 'SHORT'].map(s => (
              <button key={s} onClick={() => setSide(s)}
                style={{ flex: 1, padding: '8px', background: side === s ? (s === 'LONG' ? 'rgba(0,255,136,0.15)' : 'rgba(255,51,85,0.15)') : '#111120',
                  border: `1px solid ${side === s ? (s === 'LONG' ? '#00ff88' : '#ff3355') : '#2a2a4a'}`,
                  color: side === s ? (s === 'LONG' ? '#00ff88' : '#ff3355') : '#7070a0',
                  fontFamily: 'IBM Plex Mono', fontSize: '11px', cursor: 'pointer', borderRadius: '3px' }}>
                {s === 'LONG' ? '▲ LONG' : '▼ SHORT'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#404060', marginBottom: '6px', letterSpacing: '0.1em' }}>SHARES</div>
          <input type="number" value={shares} onChange={e => setShares(+e.target.value)} min={1}
            style={{ width: '100%', background: '#111120', border: '1px solid #2a2a4a', color: '#e8e8f0', fontFamily: 'IBM Plex Mono', fontSize: '14px', padding: '8px', borderRadius: '3px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#7070a0' }}>Entry: enter price above</span>
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#4466ff' }}>TOTAL: {price > 0 ? `$${cost.toLocaleString(undefined, {maximumFractionDigits: 0})}` : '—'}</span>
          </div>
        </div>

        <button onClick={() => { onSubmit({ symbol, side, shares, price: price || undefined }); onClose() }} disabled={!price}
          style={{ width: '100%', padding: '10px', background: 'rgba(68,102,255,0.2)', border: '1px solid #4466ff',
            color: '#4466ff', fontFamily: 'IBM Plex Mono', fontSize: '11px', cursor: 'pointer', borderRadius: '3px', letterSpacing: '0.1em' }}>
          ▶ SUBMIT ORDER
        </button>
      </div>
    </div>
  )
}

export default function Portfolio() {
  const [positions, setPositions] = useState([])
  const [equityCurve] = useState([])
  const [showOrder, setShowOrder] = useState(false)
  const [signals] = useState({})

  const startEquity = 100000
  const positionValues = positions.map(p => {
    const currentPrice = p.currentPrice ?? p.entryPrice
    const currentValue = p.shares * currentPrice
    const entryValue = p.shares * p.entryPrice
    const pnl = p.side === 'LONG' ? currentValue - entryValue : entryValue - currentValue
    const pnlPct = entryValue ? (pnl / entryValue) * 100 : 0
    return { ...p, currentValue, entryValue, pnl, pnlPct }
  })

  const totalPnl = positionValues.reduce((s, p) => s + p.pnl, 0)
  const totalValue = startEquity + totalPnl
  const cashBalance = startEquity - positionValues.reduce((s, p) => s + p.entryValue, 0)

  function addPosition(order) {
    const price = order.price ?? 0
    setPositions(prev => [...prev, {
      symbol: order.symbol,
      shares: order.shares,
      entryPrice: price,
      currentPrice: price,
      side: order.side,
      openDate: new Date().toISOString().split('T')[0],
    }])
  }

  function closePosition(idx) {
    setPositions(prev => prev.filter((_, i) => i !== idx))
  }

  // Allocation pie data
  const pieData = positionValues.map((p, i) => ({
    name: p.symbol,
    value: p.currentValue,
    color: ['#4466ff', '#00ff88', '#ff3355', '#ffcc00', '#8855ff', '#00d4ff'][i % 6],
  }))
  pieData.push({ name: 'CASH', value: Math.max(0, cashBalance), color: '#1e1e35' })

  return (
    <div style={{ padding: '20px' }}>
      {showOrder && <OrderModal onClose={() => setShowOrder(false)} onSubmit={addPosition} />}
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#404060', letterSpacing: '0.15em', marginBottom: '4px' }}>PAPER TRADING</div>
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '20px', color: '#e8e8f0' }}>Portfolio Dashboard</div>
        </div>
        <button onClick={() => setShowOrder(true)}
          style={{ padding: '8px 16px', background: 'rgba(68,102,255,0.15)', border: '1px solid #4466ff', color: '#4466ff',
            fontFamily: 'IBM Plex Mono', fontSize: '11px', cursor: 'pointer', borderRadius: '3px', letterSpacing: '0.1em' }}>
          + NEW POSITION
        </button>
      </div>

      {/* Top stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginBottom: '16px' }}>
        {[
          { label: 'TOTAL EQUITY', value: `$${totalValue.toLocaleString(undefined, {maximumFractionDigits: 0})}`, color: '#e8e8f0', highlight: true },
          { label: 'UNREALIZED P&L', value: `${totalPnl >= 0 ? '+' : ''}$${totalPnl.toLocaleString(undefined, {maximumFractionDigits: 0})}`, color: totalPnl >= 0 ? '#00ff88' : '#ff3355' },
          { label: 'RETURN', value: `${((totalPnl/startEquity)*100) >= 0 ? '+' : ''}${((totalPnl/startEquity)*100).toFixed(2)}%`, color: totalPnl >= 0 ? '#00ff88' : '#ff3355' },
          { label: 'OPEN POSITIONS', value: positions.length, color: '#e8e8f0' },
          { label: 'CASH BALANCE', value: `$${Math.max(0, cashBalance).toLocaleString(undefined, {maximumFractionDigits: 0})}`, color: '#7070a0' },
        ].map(item => (
          <div key={item.label} style={{ background: item.highlight ? 'rgba(68,102,255,0.08)' : '#0d0d16', border: `1px solid ${item.highlight ? 'rgba(68,102,255,0.3)' : '#1e1e35'}`, borderRadius: '4px', padding: '12px 14px' }}>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#404060', marginBottom: '4px', letterSpacing: '0.1em' }}>{item.label}</div>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '18px', fontWeight: 600, color: item.color }}>{item.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Equity curve */}
          <div style={{ background: '#0d0d16', border: '1px solid #1e1e35', borderRadius: '4px', padding: '16px' }}>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#404060', letterSpacing: '0.1em', marginBottom: '12px' }}>EQUITY CURVE — 60 DAYS</div>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={equityCurve} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="portGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={totalPnl >= 0 ? '#00ff88' : '#ff3355'} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={totalPnl >= 0 ? '#00ff88' : '#ff3355'} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e35" />
                <XAxis dataKey="date" tick={{ fill: '#404060', fontSize: 9, fontFamily: 'IBM Plex Mono' }} tickLine={false} axisLine={{ stroke: '#1e1e35' }} interval={9} />
                <YAxis tick={{ fill: '#404060', fontSize: 9, fontFamily: 'IBM Plex Mono' }} tickLine={false} axisLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} width={50} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="equity" name="Portfolio" stroke={totalPnl >= 0 ? '#00ff88' : '#ff3355'} strokeWidth={2} fill="url(#portGrad)" dot={false} />
                <Area type="monotone" dataKey="benchmark" name="Benchmark" stroke="#4466ff" strokeWidth={1} fill="none" strokeDasharray="4 4" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Positions table */}
          <div style={{ background: '#0d0d16', border: '1px solid #1e1e35', borderRadius: '4px', padding: '16px' }}>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#404060', letterSpacing: '0.1em', marginBottom: '12px' }}>OPEN POSITIONS</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['SYMBOL', 'SIDE', 'SHARES', 'ENTRY', 'CURRENT', 'P&L', 'P&L%', 'AI SIGNAL', 'ACTION'].map(h => (
                    <th key={h} style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#404060', padding: '4px 8px', textAlign: 'left', borderBottom: '1px solid #1e1e35', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {positionValues.map((pos, i) => {
                  const sig = signals[pos.symbol]
                  const sigColor = sig?.direction === 'BULLISH' ? '#00ff88' : sig?.direction === 'BEARISH' ? '#ff3355' : '#ffcc00'
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #111120' }}>
                      <td style={{ fontFamily: 'IBM Plex Mono', fontSize: '11px', color: '#e8e8f0', padding: '8px' }}>{pos.symbol}</td>
                      <td style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: pos.side === 'LONG' ? '#00ff88' : '#ff3355', padding: '8px' }}>{pos.side}</td>
                      <td style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: '#7070a0', padding: '8px' }}>{pos.shares}</td>
                      <td style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: '#7070a0', padding: '8px' }}>${pos.entryPrice.toFixed(2)}</td>
                      <td style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: '#e8e8f0', padding: '8px' }}>${pos.currentPrice.toFixed(2)}</td>
                      <td style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: pos.pnl >= 0 ? '#00ff88' : '#ff3355', padding: '8px' }}>
                        {pos.pnl >= 0 ? '+' : ''}${pos.pnl.toLocaleString(undefined, {maximumFractionDigits: 0})}
                      </td>
                      <td style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: pos.pnl >= 0 ? '#00ff88' : '#ff3355', padding: '8px' }}>
                        {pos.pnlPct >= 0 ? '+' : ''}{pos.pnlPct.toFixed(2)}%
                      </td>
                      <td style={{ padding: '8px' }}>
                        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', padding: '2px 6px', borderRadius: '2px', background: `${sigColor}20`, color: sigColor }}>
                          {sig?.direction || '...'} {sig ? `${(sig.probability*100).toFixed(0)}%` : ''}
                        </span>
                      </td>
                      <td style={{ padding: '8px' }}>
                        <button onClick={() => closePosition(i)}
                          style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', padding: '3px 8px', background: 'rgba(255,51,85,0.1)', border: '1px solid rgba(255,51,85,0.3)', color: '#ff3355', cursor: 'pointer', borderRadius: '2px' }}>
                          CLOSE
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {positions.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px', fontFamily: 'IBM Plex Mono', fontSize: '11px', color: '#404060' }}>
                No open positions. Click "+ NEW POSITION" to start paper trading.
              </div>
            )}
          </div>
        </div>

        {/* Right: allocation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: '#0d0d16', border: '1px solid #1e1e35', borderRadius: '4px', padding: '16px' }}>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#404060', letterSpacing: '0.1em', marginBottom: '12px' }}>ALLOCATION</div>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [`$${v.toLocaleString(undefined, {maximumFractionDigits: 0})}`, 'Value']} contentStyle={{ background: '#111120', border: '1px solid #2a2a4a', fontFamily: 'IBM Plex Mono', fontSize: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
            {pieData.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: item.color }} />
                  <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: '#7070a0' }}>{item.name}</span>
                </div>
                <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: '#e8e8f0' }}>
                  {((item.value / totalValue) * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>

          {/* AI signal watch */}
          <div style={{ background: '#0d0d16', border: '1px solid #1e1e35', borderRadius: '4px', padding: '16px' }}>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#404060', letterSpacing: '0.1em', marginBottom: '12px' }}>AI SIGNAL WATCH</div>
            {positionValues.map((pos, i) => {
              const sig = signals[pos.symbol]
              const c = sig?.direction === 'BULLISH' ? '#00ff88' : sig?.direction === 'BEARISH' ? '#ff3355' : '#ffcc00'
              const aligned = (pos.side === 'LONG' && sig?.direction === 'BULLISH') || (pos.side === 'SHORT' && sig?.direction === 'BEARISH')
              return (
                <div key={i} style={{ padding: '10px', background: '#111120', borderRadius: '3px', marginBottom: '8px', border: `1px solid ${aligned ? '#1e3a2a' : '#2a1e1e'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '11px', color: '#e8e8f0' }}>{pos.symbol}</span>
                    <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: c }}>{sig?.direction}</span>
                  </div>
                  <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#7070a0' }}>
                    Position: {pos.side} | Signal: {sig?.direction === 'BULLISH' ? '▲' : sig?.direction === 'BEARISH' ? '▼' : '◆'} {(sig?.probability * 100 || 0).toFixed(0)}%
                  </div>
                  <div style={{ marginTop: '4px', fontFamily: 'IBM Plex Mono', fontSize: '9px', color: aligned ? '#00aa55' : '#aa2240' }}>
                    {aligned ? '✓ Signal aligned with position' : '⚠ Signal conflicts with position'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

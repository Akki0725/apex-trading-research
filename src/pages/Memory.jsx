import { useState, useEffect } from 'react'
import { useMemory } from '../hooks/useBackend'
import { DEFAULT_SYMBOLS } from '../data/constants'

const VECTOR_LABELS = ['MACRO', 'SECT', 'EVENT', 'SENT', 'FUND', 'CMDTY', 'HIST', 'MOMT', 'OPTN']

function VectorDisplay({ vector }) {
  if (!vector || vector.length === 0) return null
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 28 }}>
      {vector.map((v, i) => {
        const h   = Math.abs(v) * 24
        const c   = v > 0.1 ? '#00ff88' : v < -0.1 ? '#ff3355' : '#ffcc00'
        return (
          <div key={i} title={`${VECTOR_LABELS[i]}: ${v.toFixed(2)}`}
            style={{ width: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
            <div style={{ width: 8, height: h, background: c, borderRadius: 2, opacity: 0.8, minHeight: 2 }} />
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 6, color: '#404060' }}>{VECTOR_LABELS[i]?.slice(0,2)}</div>
          </div>
        )
      })}
    </div>
  )
}

function SimilarityMeter({ value }) {
  const pct  = Math.round(value * 100)
  const c    = pct >= 90 ? '#ff3355' : pct >= 82 ? '#ffcc00' : '#4466ff'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 60, height: 4, background: '#1a1a2e', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: c, borderRadius: 2, boxShadow: `0 0 4px ${c}60` }} />
      </div>
      <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: c, fontWeight: 600 }}>{pct}%</span>
    </div>
  )
}

function AlertCard({ alert }) {
  return (
    <div style={{
      background: 'rgba(255, 51, 85, 0.06)', border: '1px solid rgba(255, 51, 85, 0.4)',
      borderRadius: 4, padding: '12px 14px',
      boxShadow: '0 0 16px rgba(255,51,85,0.12)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff3355', animation: 'pulseGlow 1.5s infinite' }} />
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#ff3355', letterSpacing: '0.1em' }}>
          ⚡ PATTERN ALERT — {(alert.similarity * 100).toFixed(0)}% DNA MATCH
        </span>
      </div>
      <p style={{ fontSize: 11, color: '#c0c0e0', lineHeight: 1.6, margin: '0 0 8px 0' }}>
        {alert.message}
      </p>
      <div style={{ display: 'flex', gap: 12 }}>
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#404060' }}>
          {alert.matchTicker} · {alert.matchDate}
        </span>
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: alert.outcome > 0 ? '#00ff88' : '#ff3355' }}>
          Outcome: {alert.outcome > 0 ? '+' : ''}{alert.outcome?.toFixed(1)}% in {alert.outcomeDays}d
        </span>
      </div>
    </div>
  )
}

function MatchCard({ match, rank }) {
  return (
    <div style={{ background: '#0c0c18', border: '1px solid #1e1e35', borderRadius: 4, padding: '12px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 2 }}>
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 13, fontWeight: 700, color: '#e8e8f0' }}>{match.ticker}</span>
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#404060' }}>{match.timestamp?.split('T')[0]}</span>
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, background: '#1a1a2e', padding: '1px 5px', borderRadius: 2, color: '#7070a0' }}>
              #{rank}
            </span>
          </div>
          {match.thesis_label && (
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#4466ff' }}>{match.thesis_label}</span>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <SimilarityMeter value={match.similarity} />
          {match.outcome_pct != null && (
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: match.outcome_pct > 0 ? '#00ff88' : '#ff3355', marginTop: 3 }}>
              {match.outcome_pct > 0 ? '+' : ''}{match.outcome_pct.toFixed(1)}% / {match.outcome_days || 5}d
            </div>
          )}
        </div>
      </div>
      <VectorDisplay vector={match.vector} />
    </div>
  )
}

function SnapshotRow({ snap, onRecordOutcome }) {
  const [editing, setEditing] = useState(false)
  const [outcomePct, setOutcomePct] = useState('')
  const scoreColor = (snap.convergence_score || 0) > 0 ? '#00ff88' : '#ff3355'

  return (
    <tr style={{ borderBottom: '1px solid #0e0e1a' }}>
      <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: '#e8e8f0', padding: '7px 8px' }}>{snap.ticker}</td>
      <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 9,  color: '#7070a0', padding: '7px 8px' }}>{snap.timestamp?.split('T')[0]}</td>
      <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: '#4466ff',  padding: '7px 8px' }}>{snap.thesis_label || '—'}</td>
      <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: scoreColor, padding: '7px 8px' }}>
        {snap.convergence_score != null ? `${snap.convergence_score > 0 ? '+' : ''}${snap.convergence_score.toFixed(2)}` : '—'}
      </td>
      <td style={{ padding: '7px 8px' }}>
        <VectorDisplay vector={snap.vector?.slice(0, 9) || []} />
      </td>
      <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, padding: '7px 8px' }}>
        {snap.outcome_pct != null ? (
          <span style={{ color: snap.outcome_pct > 0 ? '#00ff88' : '#ff3355' }}>
            {snap.outcome_pct > 0 ? '+' : ''}{snap.outcome_pct.toFixed(1)}%
          </span>
        ) : editing ? (
          <div style={{ display: 'flex', gap: 4 }}>
            <input
              type="number" placeholder="+5.2" value={outcomePct}
              onChange={e => setOutcomePct(e.target.value)}
              style={{ width: 60, background: '#111120', border: '1px solid #4466ff', color: '#e8e8f0', fontFamily: 'IBM Plex Mono', fontSize: 9, padding: '2px 4px', borderRadius: 2 }}
            />
            <button onClick={() => { onRecordOutcome(snap.id, parseFloat(outcomePct)); setEditing(false) }}
              style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, padding: '2px 6px', background: 'rgba(0,255,136,0.1)', border: '1px solid #00ff88', color: '#00ff88', cursor: 'pointer', borderRadius: 2 }}>✓</button>
            <button onClick={() => setEditing(false)}
              style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, padding: '2px 4px', background: 'none', border: '1px solid #404060', color: '#404060', cursor: 'pointer', borderRadius: 2 }}>✕</button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)}
            style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, padding: '2px 8px', background: '#111120', border: '1px solid #1e1e35', color: '#404060', cursor: 'pointer', borderRadius: 2 }}>
            + RECORD
          </button>
        )}
      </td>
    </tr>
  )
}

export default function Memory({ selectedStock }) {
  const { snapshots, stats, matches, alerts, loading, source, fetchMemory, recordOutcome } = useMemory()
  const [filterTicker, setFilterTicker] = useState(selectedStock || '')
  const [activeTab, setActiveTab] = useState('snapshots')

  useEffect(() => {
    fetchMemory(filterTicker || null)
  }, [filterTicker])

  const filteredSnaps = filterTicker
    ? snapshots.filter(s => s.ticker === filterTicker.toUpperCase())
    : snapshots

  return (
    <div style={{ padding: 20 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#404060', letterSpacing: '0.15em', marginBottom: 4 }}>VECTOR MEMORY</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 20, color: '#e8e8f0' }}>Pattern Recognition Engine</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: source === 'live' ? '#00ff88' : '#404060' }}>
              ● {source === 'live' ? 'LIVE DB' : 'MOCK'}
            </span>
            <button onClick={() => fetchMemory(filterTicker || null)} disabled={loading}
              style={{ padding: '5px 12px', fontFamily: 'IBM Plex Mono', fontSize: 10, background: 'rgba(68,102,255,0.1)', border: '1px solid #4466ff', color: '#4466ff', cursor: loading ? 'wait' : 'pointer', borderRadius: 3 }}>
              {loading ? '⟳' : '↻'} REFRESH
            </button>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#ff3355', letterSpacing: '0.1em', marginBottom: 4 }}>
            ⚠ PATTERN ALERTS
          </div>
          {alerts.map((a, i) => <AlertCard key={i} alert={a} />)}
        </div>
      )}

      {/* DB Stats */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'TOTAL SNAPSHOTS', value: stats.totalSnapshots ?? 0,       color: '#e8e8f0' },
            { label: 'WITH OUTCOMES',   value: stats.withOutcomes  ?? 0,       color: '#7070a0' },
            { label: 'WIN RATE',        value: stats.winRate ? `${stats.winRate}%` : '—', color: '#00ff88' },
            { label: 'TICKERS TRACKED', value: stats.uniqueTickers ?? 0,       color: '#4466ff' },
            { label: 'AVG CONV SCORE',  value: stats.avgConvergenceScore ?? '—', color: '#ffcc00' },
          ].map(item => (
            <div key={item.label} style={{ background: '#0d0d16', border: '1px solid #1e1e35', borderRadius: 4, padding: '10px 14px' }}>
              <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#404060', marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 20, fontWeight: 600, color: item.color }}>{item.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Ticker filter + tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#404060' }}>FILTER:</span>
        <select value={filterTicker} onChange={e => setFilterTicker(e.target.value)}
          style={{ background: '#0d0d16', border: '1px solid #1e1e35', color: '#e8e8f0', fontFamily: 'IBM Plex Mono', fontSize: 11, padding: '5px 8px', borderRadius: 3 }}>
          <option value="">All tickers</option>
          {DEFAULT_SYMBOLS.map(sym => <option key={sym} value={sym}>{sym}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        {['snapshots', 'matches'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '5px 14px', fontFamily: 'IBM Plex Mono', fontSize: 10,
            background: activeTab === tab ? 'rgba(68,102,255,0.15)' : 'transparent',
            border: `1px solid ${activeTab === tab ? '#4466ff' : '#1e1e35'}`,
            color: activeTab === tab ? '#4466ff' : '#404060', cursor: 'pointer', borderRadius: 3, letterSpacing: '0.06em',
          }}>{tab.toUpperCase()} {tab === 'matches' && matches.length > 0 ? `(${matches.length})` : ''}</button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'snapshots' && (
        <div style={{ background: '#0d0d16', border: '1px solid #1e1e35', borderRadius: 4, padding: 16 }}>
          {loading && filteredSnaps.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, fontFamily: 'IBM Plex Mono', fontSize: 11, color: '#404060' }}>Loading memory...</div>
          ) : filteredSnaps.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: '#404060', marginBottom: 8 }}>No snapshots yet</div>
              <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: '#2a2a4a' }}>Run analyses on the Overview tab to build your memory database.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['TICKER', 'DATE', 'THESIS', 'SCORE', '9-LAYER DNA', 'OUTCOME'].map(h => (
                      <th key={h} style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#404060', padding: '4px 8px', textAlign: 'left', borderBottom: '1px solid #1e1e35', letterSpacing: '0.06em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredSnaps.slice(0, 100).map(snap => (
                    <SnapshotRow key={snap.id} snap={snap} onRecordOutcome={recordOutcome} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'matches' && (
        <div>
          {matches.length === 0 ? (
            <div style={{ background: '#0d0d16', border: '1px solid #1e1e35', borderRadius: 4, padding: 40, textAlign: 'center' }}>
              <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: '#404060', marginBottom: 8 }}>
                {source === 'mock' ? 'Connect backend to see pattern matches' : 'No similar patterns found'}
              </div>
              <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: '#2a2a4a' }}>
                Select a ticker filter above and run analyses to populate the memory database.
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 10 }}>
              {matches.map((m, i) => <MatchCard key={m.id || i} match={m} rank={i + 1} />)}
            </div>
          )}
        </div>
      )}

      {/* How it works */}
      <div style={{ marginTop: 20, background: '#0d0d16', border: '1px solid #1e1e35', borderRadius: 4, padding: 16 }}>
        <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#404060', letterSpacing: '0.1em', marginBottom: 12 }}>HOW VECTOR MEMORY WORKS</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { icon: '📸', title: 'Snapshot', text: 'Every analysis saves the 9-layer scores as a vector into SQLite — a "DNA fingerprint" of that market moment.' },
            { icon: '🔍', title: 'Similarity Search', text: 'Cosine similarity compares current conditions against all stored vectors. Threshold ≥88% triggers an alert.' },
            { icon: '🔔', title: 'Pattern Alert', text: 'When conditions match a historical setup that had a recorded outcome, you get notified: "I\'ve seen this movie before."' },
          ].map(item => (
            <div key={item.title} style={{ padding: '10px 12px', background: '#111120', borderRadius: 3, border: '1px solid #1a1a2e' }}>
              <div style={{ fontSize: 16, marginBottom: 6 }}>{item.icon}</div>
              <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: '#4466ff', marginBottom: 4 }}>{item.title}</div>
              <p style={{ fontSize: 10, color: '#7070a0', lineHeight: 1.6, margin: 0 }}>{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

import { memo } from 'react'
import { Handle, Position } from 'reactflow'

const THESIS_STYLES = {
  MOMENTUM_BREAKOUT:    { color: '#00ff88', glow: 'rgba(0,255,136,0.35)', icon: '🚀' },
  CONTRARIAN_LONG:      { color: '#00d4ff', glow: 'rgba(0,212,255,0.35)', icon: '⚡' },
  HIGH_CONVICTION_SHORT:{ color: '#ff3355', glow: 'rgba(255,51,85,0.35)',  icon: '📉' },
  DEFENSIVE_ROTATION:   { color: '#8855ff', glow: 'rgba(136,85,255,0.35)', icon: '🛡' },
  EVENT_DRIVEN:         { color: '#ffaa00', glow: 'rgba(255,170,0,0.35)',  icon: '📰' },
  VOLATILITY_PLAY:      { color: '#ff6644', glow: 'rgba(255,102,68,0.35)', icon: '⚡' },
  AWAIT_TRIGGER:        { color: '#ffcc00', glow: 'rgba(255,204,0,0.30)',  icon: '⏳' },
  NO_CONVERGENCE:       { color: '#7070a0', glow: 'rgba(112,112,160,0.2)', icon: '⛔' },
  NEUTRAL:              { color: '#7070a0', glow: 'rgba(112,112,160,0.2)', icon: '◈' },
}

const ThesisNode = memo(({ data }) => {
  const { thesis } = data
  if (!thesis) return null

  const style  = THESIS_STYLES[thesis.type] || THESIS_STYLES.NEUTRAL
  const probPct = Math.round(thesis.probability * 100)
  const confColor = thesis.confidence === 'HIGH' ? '#00ff88' : thesis.confidence === 'MEDIUM' ? '#ffcc00' : '#7070a0'

  // Arc for probability gauge
  const r = 32, cx = 40, cy = 40
  const angle = (thesis.probability - 0.5) * 270  // -135 to +135
  const startAngle = -135 * (Math.PI / 180)
  const endAngle = (angle - 135) * (Math.PI / 180)
  const x1 = cx + r * Math.cos(startAngle), y1 = cy + r * Math.sin(startAngle)
  const x2 = cx + r * Math.cos(endAngle),   y2 = cy + r * Math.sin(endAngle)
  const largeArc = Math.abs(angle) > 180 ? 1 : 0
  const sweep = thesis.probability >= 0.5 ? 1 : 0

  return (
    <>
      <Handle type="target" position={Position.Top} style={{ opacity: 0, pointerEvents: 'none' }} />

      <div style={{
        width: 320,
        background: 'linear-gradient(145deg, #0e0e1c, #080810)',
        border: `2px solid ${style.color}`,
        borderRadius: 8,
        padding: '16px 18px',
        cursor: 'default',
        position: 'relative',
        boxShadow: `0 0 28px ${style.glow}, inset 0 1px 0 rgba(255,255,255,0.04)`,
      }}>

        {/* Radiant top accent */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 3,
          background: `linear-gradient(90deg, transparent, ${style.color}, transparent)`,
          borderRadius: '8px 8px 0 0',
        }} />

        {/* THESIS badge */}
        <div style={{
          position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)',
          fontFamily: 'IBM Plex Mono', fontSize: 9, fontWeight: 700,
          background: style.color, color: '#000', padding: '2px 12px', borderRadius: 2,
          letterSpacing: '0.15em',
        }}>
          CONVERGENCE THESIS
        </div>

        {/* Main content row */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
          {/* Probability gauge */}
          <div style={{ flexShrink: 0 }}>
            <svg width={80} height={60}>
              {/* BG arc */}
              <path
                d={`M ${cx + r * Math.cos(-135 * Math.PI/180)} ${cy + r * Math.sin(-135 * Math.PI/180)} A ${r} ${r} 0 1 1 ${cx + r * Math.cos(-45 * Math.PI/180)} ${cy + r * Math.sin(-45 * Math.PI/180)}`}
                fill="none" stroke="#1e1e35" strokeWidth={6} strokeLinecap="round"
              />
              {/* Value arc */}
              {thesis.probability !== 0.5 && (
                <path
                  d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} ${sweep} ${x2} ${y2}`}
                  fill="none" stroke={style.color} strokeWidth={6} strokeLinecap="round"
                  style={{ filter: `drop-shadow(0 0 3px ${style.color})` }}
                />
              )}
              <text x={cx} y={cy + 4} textAnchor="middle" fill={style.color}
                fontSize="13" fontFamily="IBM Plex Mono" fontWeight="700">{probPct}%</text>
              <text x={cx} y={cy + 16} textAnchor="middle" fill="#404060" fontSize="7" fontFamily="IBM Plex Mono">PROB</text>
            </svg>
          </div>

          {/* Label + confidence */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, marginBottom: 4 }}>{style.icon}</div>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 14, fontWeight: 700, color: style.color, lineHeight: 1.2, marginBottom: 4 }}>
              {thesis.label}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, padding: '2px 6px', borderRadius: 2, background: `${confColor}20`, color: confColor, letterSpacing: '0.08em' }}>
                {thesis.confidence} CONVICTION
              </span>
              <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, padding: '2px 6px', borderRadius: 2, background: '#1a1a2e', color: '#7070a0' }}>
                {thesis.bullishStages}↑ / {thesis.bearishStages}↓ STAGES
              </span>
            </div>
          </div>
        </div>

        {/* Summary text */}
        <div style={{
          background: '#0a0a14', border: '1px solid #1a1a2e', borderRadius: 4,
          padding: '8px 10px',
        }}>
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, color: '#404060', letterSpacing: '0.1em', marginBottom: 4 }}>AI THESIS SUMMARY</div>
          <p style={{ fontSize: 10, color: '#a0a0c0', lineHeight: 1.6, margin: 0 }}>{thesis.summary}</p>
        </div>

        {/* Stage conviction bar */}
        <div style={{ marginTop: 10, display: 'flex', gap: 3, justifyContent: 'center' }}>
          {['REGIME', 'CATALYST', 'EVIDENCE', 'ANALOG', 'TIMING'].map((s, i) => {
            const val = [
              thesis.overallScore, thesis.overallScore * 0.8,
              thesis.overallScore * 0.9, thesis.overallScore * 0.7, thesis.overallScore * 0.85
            ][i]
            const c = val > 0.05 ? '#00ff88' : val < -0.05 ? '#ff3355' : '#ffcc00'
            return (
              <div key={s} style={{ textAlign: 'center' }}>
                <div style={{ width: 36, height: 4, background: c, borderRadius: 2, opacity: Math.max(0.3, Math.abs(val) * 1.2) }} />
                <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 7, color: '#404060', marginTop: 2 }}>{s.slice(0,3)}</div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
})

ThesisNode.displayName = 'ThesisNode'
export default ThesisNode

import { memo } from 'react'
import { Handle, Position } from 'reactflow'
import { sparklinePath } from '../../utils/convergenceLogic'

const LAYER_META = {
  macro:       { shortName: 'MACRO', icon: '🌐', color: '#ff55aa', label: 'Macroeconomic' },
  sector:      { shortName: 'SECT',  icon: '🏭', color: '#8855ff', label: 'Sector & Industry' },
  event:       { shortName: 'EVENT', icon: '⚠️', color: '#ffcc00', label: 'Event Detection' },
  sentiment:   { shortName: 'SENT',  icon: '📰', color: '#ff6644', label: 'News Sentiment' },
  fundamental: { shortName: 'FUND',  icon: '📊', color: '#4466ff', label: 'Fundamentals' },
  commodity:   { shortName: 'CMDTY', icon: '⛽', color: '#ffaa00', label: 'Supply Chain' },
  historical:  { shortName: 'HIST',  icon: '📈', color: '#00ff88', label: 'Historical Analog' },
  momentum:    { shortName: 'MOMT',  icon: '⚡', color: '#00d4ff', label: 'Price Momentum' },
  options:     { shortName: 'OPTN',  icon: '🎯', color: '#55ffcc', label: 'Options Flow' },
}

function Sparkline({ data, color }) {
  if (!data || data.length < 2) return null
  const path = sparklinePath(data, 84, 26)
  const lastX = 84
  const lastY = 26 - ((data[data.length - 1] + 1) / 2) * 26
  return (
    <svg width={84} height={26} style={{ display: 'block' }}>
      <path d={path} fill="none" stroke={color} strokeWidth={1.4} opacity={0.65} />
      <circle cx={lastX} cy={lastY} r={2.5} fill={color} opacity={0.9} />
    </svg>
  )
}

function ScoreGlow({ score }) {
  const color = score > 0.12 ? '#00ff88' : score < -0.12 ? '#ff3355' : '#ffcc00'
  const label = score > 0.12 ? 'BULL' : score < -0.12 ? 'BEAR' : 'NEUT'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{
        width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0,
        boxShadow: `0 0 6px ${color}, 0 0 12px ${color}60`,
        animation: 'pulseGlow 2.4s ease-in-out infinite',
      }} />
      <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color, letterSpacing: '0.08em' }}>{label}</span>
    </div>
  )
}

const LayerNode = memo(({ data, selected }) => {
  const id = data.signal?.id || ''
  const meta = LAYER_META[id] || { shortName: id.toUpperCase(), icon: '◈', color: '#4466ff', label: id }
  const score = data.score ?? 0
  const scoreColor = score > 0.12 ? '#00ff88' : score < -0.12 ? '#ff3355' : '#ffcc00'
  const isHistorical = id === 'historical'
  const isHighVolOpt = id === 'options' && data.isHighVol

  // Special label for historical: show win rate
  const subInfo = isHistorical && data.winRate
    ? `${data.winRate}% WIN RATE`
    : data.crowdReaction
      ? data.crowdReaction.replace(/_/g, ' ')
      : `CONF ${((data.signal?.confidence || 0.5) * 100).toFixed(0)}%`

  return (
    <>
      {/* Target handle — top */}
      <Handle type="target" position={Position.Top} style={{ opacity: 0, pointerEvents: 'none' }} />

      <div style={{
        width: isHighVolOpt ? 220 : 188,
        background: '#0c0c18',
        border: `1.5px solid ${data.isConflict ? '#ff3355' : selected ? meta.color : '#1e1e35'}`,
        borderLeft: `3px solid ${meta.color}`,
        borderRadius: 5,
        padding: '10px 12px',
        cursor: 'pointer',
        position: 'relative',
        transition: 'all 0.2s',
        boxShadow: data.isConflict
          ? '0 0 14px rgba(255,51,85,0.35)'
          : selected
            ? `0 0 16px ${meta.color}30`
            : '0 2px 8px rgba(0,0,0,0.5)',
      }}>
        {/* Conflict warning badge */}
        {data.isConflict && (
          <div style={{
            position: 'absolute', top: -8, right: -8,
            width: 18, height: 18, borderRadius: '50%',
            background: '#ff3355', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, boxShadow: '0 0 8px rgba(255,51,85,0.7)',
            animation: 'pulseGlow 1.2s ease-in-out infinite',
          }}>⚠</div>
        )}

        {/* Simulated badge */}
        {data.isSimulated && (
          <div style={{
            position: 'absolute', top: -7, left: 8,
            fontSize: 8, fontFamily: 'IBM Plex Mono', letterSpacing: '0.08em',
            background: '#4466ff', color: 'white', padding: '1px 5px', borderRadius: 2,
          }}>SIM</div>
        )}

        {/* High-vol badge for options */}
        {isHighVolOpt && (
          <div style={{
            position: 'absolute', top: -7, left: 8,
            fontSize: 8, fontFamily: 'IBM Plex Mono', letterSpacing: '0.08em',
            background: '#ff6644', color: 'white', padding: '1px 5px', borderRadius: 2,
          }}>HIGH VOL ⚡</div>
        )}

        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <div>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#404060', letterSpacing: '0.1em', marginBottom: 1 }}>
              {meta.icon} {meta.shortName}
            </div>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: '#c8c8e0', lineHeight: 1.2 }}>{meta.label}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 18, fontWeight: 700, color: scoreColor, lineHeight: 1 }}>
              {score >= 0 ? '+' : ''}{score.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Score status */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <ScoreGlow score={score} />
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, color: '#404060' }}>{subInfo}</span>
        </div>

        {/* Sparkline */}
        <div style={{ background: '#08080f', borderRadius: 3, padding: '3px 4px', border: '1px solid #1a1a2e' }}>
          <Sparkline data={data.sparkline} color={meta.color} />
        </div>

        {/* Score bar */}
        <div style={{ marginTop: 6, height: 3, background: '#1a1a2e', borderRadius: 2, position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', height: '100%',
            width: `${Math.abs(score) * 50}%`,
            background: scoreColor,
            left: score > 0 ? '50%' : `${50 - Math.abs(score) * 50}%`,
            borderRadius: 2,
            boxShadow: `0 0 4px ${scoreColor}80`,
          }} />
          <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: '#2a2a4a' }} />
        </div>
      </div>

      {/* Source handle — bottom */}
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, pointerEvents: 'none' }} />
    </>
  )
})

LayerNode.displayName = 'LayerNode'
export default LayerNode

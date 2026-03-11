import { memo } from 'react'
import { Handle, Position } from 'reactflow'

const STAGE_COLORS = {
  0: '#4466ff',
  1: '#ff6644',
  2: '#00d4ff',
  3: '#00ff88',
  4: '#8855ff',
}

const STAGE_ICONS = ['◈', '◎', '⬡', '◇', '◆']

const StageNode = memo(({ data, selected }) => {
  const { stageNum, label, sublabel, score, confidence, isConflict, isHighVol } = data
  const color = STAGE_COLORS[stageNum] || '#4466ff'
  const scoreColor = score > 0.1 ? '#00ff88' : score < -0.1 ? '#ff3355' : '#ffcc00'
  const dir = score > 0.1 ? '▲' : score < -0.1 ? '▼' : '◆'
  const confPct = Math.round((confidence ?? 0.5) * 100)

  return (
    <>
      <Handle type="target" position={Position.Top} style={{ opacity: 0, pointerEvents: 'none' }} />

      <div style={{
        width: 240,
        background: 'linear-gradient(135deg, #0f0f1e, #0a0a18)',
        border: `1.5px solid ${isConflict ? '#ff3355' : selected ? color : '#2a2a4a'}`,
        borderRadius: 5,
        padding: '10px 14px',
        cursor: 'pointer',
        position: 'relative',
        boxShadow: isConflict
          ? '0 0 16px rgba(255,51,85,0.4)'
          : selected
            ? `0 0 20px ${color}30`
            : `0 0 12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.03)`,
        transition: 'all 0.2s',
      }}>

        {/* Top accent bar */}
        <div style={{
          position: 'absolute', top: 0, left: 12, right: 12, height: 2,
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
          borderRadius: '0 0 2px 2px', opacity: 0.7,
        }} />

        {/* Stage badge */}
        <div style={{
          position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
          background: color, color: '#000', fontFamily: 'IBM Plex Mono',
          fontSize: 8, fontWeight: 700, padding: '2px 8px', borderRadius: 2,
          letterSpacing: '0.12em', whiteSpace: 'nowrap',
        }}>
          STAGE {stageNum} {STAGE_ICONS[stageNum]}
        </div>

        {/* Content */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, fontWeight: 600, color: '#e8e8f0', letterSpacing: '0.05em' }}>
              {label}
            </div>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: isConflict ? '#ff3355' : '#7070a0', marginTop: 2 }}>
              {sublabel}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 20, fontWeight: 700, color: scoreColor }}>
              {dir}{Math.abs(score).toFixed(2)}
            </div>
          </div>
        </div>

        {/* Confidence bar */}
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, color: '#404060', letterSpacing: '0.08em', flexShrink: 0 }}>
            CONF
          </span>
          <div style={{ flex: 1, height: 3, background: '#1a1a2e', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${confPct}%`,
              background: `linear-gradient(90deg, ${color}80, ${color})`,
              borderRadius: 2,
              boxShadow: `0 0 4px ${color}60`,
            }} />
          </div>
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, color: color }}>{confPct}%</span>
        </div>

        {isHighVol && (
          <div style={{ marginTop: 6, fontFamily: 'IBM Plex Mono', fontSize: 8, color: '#ff6644', letterSpacing: '0.08em', textAlign: 'center' }}>
            ⚡ OPTIONS WEIGHT ELEVATED
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, pointerEvents: 'none' }} />
    </>
  )
})

StageNode.displayName = 'StageNode'
export default StageNode

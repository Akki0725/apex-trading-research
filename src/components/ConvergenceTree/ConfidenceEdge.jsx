import { memo } from 'react'
import { getBezierPath, EdgeLabelRenderer, BaseEdge } from 'reactflow'

const ConfidenceEdge = memo(({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, data,
}) => {
  const conf   = data?.confidence ?? 0.5
  const isConf = data?.isConflict ?? false
  const score  = data?.sourceScore ?? 0

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
    curvature: 0.35,
  })

  // Visual encoding
  const strokeWidth   = isConf ? 1.5 : 1 + conf * 3.5
  const strokeColor   = isConf ? '#ff3355' : score > 0.08 ? '#00ff88' : score < -0.08 ? '#ff3355' : '#5566aa'
  const strokeOpacity = isConf ? 0.7 : 0.25 + conf * 0.65
  const isDashed      = conf < 0.35 || isConf
  const dashArray     = isConf ? '5 4' : conf < 0.35 ? '4 6' : 'none'
  const animDuration  = 1.8 + (1 - conf) * 2  // faster for high confidence

  // Show label only for medium/high confidence edges
  const showLabel = conf > 0.45

  return (
    <>
      {/* Glow underlay for high-confidence edges */}
      {conf > 0.65 && !isConf && (
        <path
          d={edgePath}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth + 4}
          strokeOpacity={0.08}
          strokeLinecap="round"
        />
      )}

      {/* Main edge path */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeOpacity={strokeOpacity}
        strokeDasharray={isDashed ? dashArray : undefined}
        strokeLinecap="round"
      />

      {/* Animated flow marker for high-confidence edges */}
      {conf > 0.55 && !isConf && (
        <circle r={2.5} fill={strokeColor} opacity={0.85}>
          <animateMotion
            dur={`${animDuration}s`}
            repeatCount="indefinite"
            path={edgePath}
          />
        </circle>
      )}

      {/* Confidence label */}
      {showLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'none',
              background: '#080810',
              border: `1px solid ${isConf ? '#ff335540' : '#1e1e3580'}`,
              borderRadius: 3,
              padding: '1px 5px',
              fontFamily: 'IBM Plex Mono',
              fontSize: 8,
              color: isConf ? '#ff3355' : strokeColor,
              letterSpacing: '0.06em',
              whiteSpace: 'nowrap',
              opacity: 0.9,
            }}
            className="nodrag nopan"
          >
            {isConf ? '⚡ CONFLICT' : `${Math.round(conf * 100)}% CONF`}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
})

ConfidenceEdge.displayName = 'ConfidenceEdge'
export default ConfidenceEdge

import { useState, useCallback, useMemo, useEffect } from 'react'
import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  Panel,
} from 'reactflow'
import 'reactflow/dist/style.css'

import { buildConvergenceTree, buildFlowElements } from '../../utils/convergenceLogic'
import LayerNode from './LayerNode'
import StageNode from './StageNode'
import ThesisNode from './ThesisNode'
import ConfidenceEdge from './ConfidenceEdge'
import DrilldownSidebar from './DrilldownSidebar'

// Define custom node/edge types OUTSIDE component to avoid re-registration
const nodeTypes = {
  layerNode: LayerNode,
  stageNode: StageNode,
  thesisNode: ThesisNode,
}

const edgeTypes = {
  confidenceEdge: ConfidenceEdge,
}

function ConflictBanner({ conflicts }) {
  if (!conflicts || conflicts.length === 0) return null
  return (
    <div style={{
      position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
      zIndex: 10, display: 'flex', flexDirection: 'column', gap: 4, pointerEvents: 'none',
    }}>
      {conflicts.map(c => (
        <div key={c.id} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#140609', border: '1px solid #ff335580',
          borderRadius: 4, padding: '5px 12px',
          boxShadow: '0 0 12px rgba(255,51,85,0.25)',
        }}>
          <span style={{ fontSize: 10 }}>⚠</span>
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#ff3355', letterSpacing: '0.08em' }}>
            {c.label}
          </span>
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, color: '#7070a0' }}>
            — {c.severity}
          </span>
        </div>
      ))}
    </div>
  )
}

function SimBanner({ count, onClear }) {
  if (count === 0) return null
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      background: 'rgba(68,102,255,0.12)', border: '1px solid #4466ff40',
      borderRadius: 3, padding: '4px 10px',
    }}>
      <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#4466ff', letterSpacing: '0.08em' }}>
        ⚙ {count} LAYER{count > 1 ? 'S' : ''} SIMULATED
      </span>
      <button onClick={onClear} style={{
        fontFamily: 'IBM Plex Mono', fontSize: 8, background: 'none', border: '1px solid #4466ff40',
        color: '#4466ff', cursor: 'pointer', padding: '1px 6px', borderRadius: 2,
      }}>RESET ALL</button>
    </div>
  )
}

function FlowInner({ signals, ticker }) {
  const [simulatedOverrides, setSimulatedOverrides] = useState({})
  const [selectedNode, setSelectedNode] = useState(null)

  // Build tree and flow elements whenever signals or overrides change
  const tree = useMemo(
    () => buildConvergenceTree(signals, simulatedOverrides),
    [signals, simulatedOverrides]
  )

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildFlowElements(tree, signals, simulatedOverrides),
    [tree, signals, simulatedOverrides]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  // Sync when tree updates
  useEffect(() => {
    setNodes(initialNodes)
    setEdges(initialEdges)
  }, [initialNodes, initialEdges])

  const onNodeClick = useCallback((_, node) => {
    // Only layer nodes get a full sidebar; stage/thesis show nothing (they are summaries)
    if (node.type === 'layerNode') {
      setSelectedNode(prev => prev?.id === node.id ? null : node)
    }
  }, [])

  const handleSimulate = useCallback((layerId, val) => {
    setSimulatedOverrides(prev => {
      if (val === undefined) {
        const next = { ...prev }; delete next[layerId]; return next
      }
      return { ...prev, [layerId]: val }
    })
  }, [])

  const clearAllSim = useCallback(() => {
    setSimulatedOverrides({})
    setSelectedNode(null)
  }, [])

  const simCount = Object.keys(simulatedOverrides).length
  const conflicts = tree.conflicts

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* React Flow canvas */}
      <div style={{
        position: 'absolute', inset: 0,
        marginRight: selectedNode ? 320 : 0,
        transition: 'margin-right 0.22s ease',
      }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          fitView
          fitViewOptions={{ padding: 0.12, minZoom: 0.3, maxZoom: 1.2 }}
          minZoom={0.15}
          maxZoom={2}
          nodesDraggable={true}
          nodesConnectable={false}
          elementsSelectable={true}
          style={{ background: 'transparent' }}
          proOptions={{ hideAttribution: true }}
        >
          <Background
            color="#1e1e35"
            gap={28}
            size={0.8}
            style={{ background: '#050508' }}
          />
          <Controls
            style={{
              background: '#0d0d16', border: '1px solid #1e1e35',
              borderRadius: 4, overflow: 'hidden',
            }}
            showInteractive={false}
          />

          {/* Top left: ticker + stage labels */}
          <Panel position="top-left">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{
                background: '#0d0d16', border: '1px solid #1e1e35', borderRadius: 4,
                padding: '6px 12px',
              }}>
                <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, color: '#404060', letterSpacing: '0.12em', marginBottom: 2 }}>
                  CONVERGENCE TREE
                </div>
                <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 16, fontWeight: 700, color: '#e8e8f0' }}>
                  {ticker}
                  <span style={{ fontSize: 9, color: '#4466ff', marginLeft: 8 }}>
                    9 LAYERS • 5 STAGES
                  </span>
                </div>
              </div>
              <SimBanner count={simCount} onClear={clearAllSim} />
            </div>
          </Panel>

          {/* Conflict banners */}
          {conflicts.length > 0 && (
            <Panel position="top-center">
              <ConflictBanner conflicts={conflicts} />
            </Panel>
          )}

          {/* Stage legend */}
          <Panel position="bottom-left">
            <div style={{
              background: '#0d0d16', border: '1px solid #1e1e35', borderRadius: 4,
              padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, color: '#404060', letterSpacing: '0.1em', marginBottom: 2 }}>
                PIPELINE STAGES
              </div>
              {[
                ['0', '4466ff', 'Market Context', 'MACRO + SECT'],
                ['1', 'ff6644', 'Catalyst',       'EVENT + SENT'],
                ['2', '00d4ff', 'Evidence',        'FUND + CMDTY'],
                ['3', '00ff88', 'Historical Analog','HIST'],
                ['4', '8855ff', 'Execution Timing','MOMT + OPTN'],
              ].map(([n, c, name, layers]) => (
                <div key={n} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <div style={{ width: 14, height: 14, borderRadius: 2, background: `#${c}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 7, fontWeight: 700, color: '#000' }}>{n}</span>
                  </div>
                  <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, color: '#7070a0' }}>{name}</span>
                  <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 7, color: '#404060' }}>{layers}</span>
                </div>
              ))}
            </div>
          </Panel>

          {/* Edge legend */}
          <Panel position="bottom-right">
            <div style={{
              background: '#0d0d16', border: '1px solid #1e1e35', borderRadius: 4,
              padding: '8px 10px', marginRight: selectedNode ? 320 : 0, transition: 'margin-right 0.22s',
            }}>
              <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, color: '#404060', letterSpacing: '0.1em', marginBottom: 6 }}>EDGE GUIDE</div>
              {[
                { label: 'High Confidence', style: '4px solid #00ff8880' },
                { label: 'Moderate', style: '2px solid #5566aa80' },
                { label: 'Leap of Faith', style: '1px dashed #404060' },
                { label: 'Conflict', style: '2px dashed #ff335580' },
              ].map(({ label, style }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{ width: 24, height: 0, border: style, borderRadius: 1 }} />
                  <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, color: '#7070a0' }}>{label}</span>
                </div>
              ))}
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* Drilldown sidebar */}
      {selectedNode && (
        <DrilldownSidebar
          node={selectedNode}
          signals={signals}
          onClose={() => setSelectedNode(null)}
          onSimulate={handleSimulate}
          simulatedOverrides={simulatedOverrides}
        />
      )}
    </div>
  )
}

export default function ConvergenceTree({ signals, ticker }) {
  return (
    <ReactFlowProvider>
      <FlowInner signals={signals} ticker={ticker} />
    </ReactFlowProvider>
  )
}

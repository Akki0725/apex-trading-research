// src/pages/Analysis.jsx
// Layer Analysis + Evidence Reader
//
// Two modes:
//   1. NORMAL — stock selector + all-layers view (same as before)
//   2. EVIDENCE — navigated here from DrilldownSidebar with router state
//      Renders: AI reasoning, Gemini key factors, scraped articles with full text,
//               Reddit posts with sentiment, historical analogs — all sourced from
//               the exact rawData payload the backend layers produced.

import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { DEFAULT_SYMBOLS, LAYERS } from '../data/constants'
import { useAnalysis } from '../hooks/useBackend'

// ─────────────────────────────────────────────────────────────────────────────
// Shared tiny components
// ─────────────────────────────────────────────────────────────────────────────
function Mono({ children, size = 9, color = '#7070a0', style = {} }) {
  return <span style={{ fontFamily: 'IBM Plex Mono', fontSize: size, color, ...style }}>{children}</span>
}

function SectionLabel({ children }) {
  return <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#404060', letterSpacing: '0.12em', marginBottom: 10 }}>{children}</div>
}

function ScorePill({ score, size = 10 }) {
  const color = score > 0.1 ? '#00ff88' : score < -0.1 ? '#ff3355' : '#ffcc00'
  return (
    <span style={{ fontFamily: 'IBM Plex Mono', fontSize: size, color, background: `${color}18`, border: `1px solid ${color}40`, borderRadius: 3, padding: '1px 6px' }}>
      {score >= 0 ? '+' : ''}{score.toFixed(2)}
    </span>
  )
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#111120', border: '1px solid #2a2a4a', borderRadius: 4, padding: '8px 12px' }}>
      <Mono size={10} color="#7070a0" style={{ display: 'block', marginBottom: 4 }}>{label}</Mono>
      {payload.map((p, i) => (
        <div key={i}><Mono size={11} color={p.color}>{p.name}: {typeof p.value === 'number' ? p.value.toFixed(3) : p.value}</Mono></div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Evidence Reader sub-components
// ─────────────────────────────────────────────────────────────────────────────

const LAYER_COLORS = {
  macro:'#ff55aa', sector:'#8855ff', event:'#ffcc00', sentiment:'#ff6644',
  fundamental:'#4466ff', commodity:'#ffaa00', historical:'#00ff88',
  momentum:'#00d4ff', options:'#55ffcc',
}
const LAYER_LABELS = {
  macro:'Macroeconomic', sector:'Sector & Industry', event:'Event Detection',
  sentiment:'News Sentiment', fundamental:'Fundamentals', commodity:'Supply Chain',
  historical:'Historical Analog', momentum:'Price Momentum', options:'Options Flow',
}
const LAYER_ICONS = {
  macro:'🌐', sector:'🏭', event:'⚠️', sentiment:'📰',
  fundamental:'📊', commodity:'⛽', historical:'📈', momentum:'⚡', options:'🎯',
}

// Article card — shows scraped web article with Jina-extracted text
function ArticleCard({ article, idx }) {
  const [expanded, setExpanded] = useState(false)
  const hasFull = !!article.fullText

  return (
    <div style={{ background: '#0d0d16', border: '1px solid #1e1e35', borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
      {/* Header row */}
      <div style={{ padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ width: 22, height: 22, borderRadius: 3, background: '#4466ff18', border: '1px solid #4466ff40', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Mono size={9} color="#4466ff">#{idx + 1}</Mono>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ marginBottom: 4 }}>
            <a href={article.url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: '#c8c8e8', textDecoration: 'none', lineHeight: 1.5 }}
              onMouseEnter={e => e.target.style.color = '#4466ff'}
              onMouseLeave={e => e.target.style.color = '#c8c8e8'}>
              {article.title}
            </a>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, padding: '1px 5px', background: '#1a1a2e', borderRadius: 2, color: '#7070a0', border: '1px solid #2a2a3e' }}>{article.source}</span>
            {hasFull && <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, padding: '1px 5px', background: '#8855ff18', borderRadius: 2, color: '#8855ff', border: '1px solid #8855ff40' }}>JINA EXTRACTED</span>}
            <a href={article.url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, color: '#404060', textDecoration: 'none' }}>
              ↗ open
            </a>
          </div>
        </div>
      </div>

      {/* Snippet / excerpt */}
      <div style={{ padding: '0 14px 10px', paddingLeft: 48 }}>
        <div style={{ background: '#0a0a12', borderRadius: 3, padding: '8px 10px', borderLeft: '2px solid #2a2a4a' }}>
          <p style={{ fontSize: 11, color: '#7070a0', lineHeight: 1.7, margin: 0 }}>
            {expanded && hasFull ? article.fullText : (article.snippet || article.fullText?.slice(0, 200))}
            {!expanded && hasFull && article.fullText?.length > 200 && '…'}
          </p>
          {hasFull && (
            <button onClick={() => setExpanded(!expanded)} style={{ marginTop: 6, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'IBM Plex Mono', fontSize: 8, color: '#8855ff', padding: 0 }}>
              {expanded ? '▲ Show less' : '▼ Show full extracted text'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// Reddit post card
function RedditCard({ post }) {
  const [expanded, setExpanded] = useState(false)
  const sentColor = post.sentiment > 0.1 ? '#00ff88' : post.sentiment < -0.1 ? '#ff3355' : '#ffcc00'

  return (
    <div style={{ background: '#0d0d16', border: '1px solid #1e1e35', borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
      <div style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          {/* Upvote column */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flexShrink: 0, minWidth: 36 }}>
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#ff6644' }}>▲</span>
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, fontWeight: 600, color: '#e8e8f0' }}>{(post.ups || 0) >= 1000 ? `${((post.ups || 0)/1000).toFixed(1)}k` : post.ups || 0}</span>
          </div>
          {/* Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
              <a href={post.url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: '#c8c8e8', textDecoration: 'none', lineHeight: 1.5 }}
                onMouseEnter={e => e.target.style.color = '#ff6644'}
                onMouseLeave={e => e.target.style.color = '#c8c8e8'}>
                {post.title}
              </a>
              <ScorePill score={post.sentiment || 0} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, padding: '1px 5px', background: '#ff664418', borderRadius: 2, color: '#ff6644', border: '1px solid #ff664440' }}>{post.subreddit}</span>
              <Mono size={8} color="#404060">{post.numComments || 0} comments</Mono>
              {post.created && <Mono size={8} color="#404060">{new Date(post.created).toLocaleDateString()}</Mono>}
              <a href={post.url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, color: '#404060', textDecoration: 'none' }}>↗ open</a>
            </div>
          </div>
        </div>

        {/* Post body */}
        {post.selftext && (
          <div style={{ marginTop: 8, paddingLeft: 46 }}>
            <div style={{ background: '#0a0a12', borderRadius: 3, padding: '8px 10px', borderLeft: '2px solid #2a2a4a' }}>
              <p style={{ fontSize: 11, color: '#7070a0', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-line' }}>
                {expanded ? post.selftext : post.selftext.slice(0, 250)}
                {!expanded && post.selftext.length > 250 && '…'}
              </p>
              {post.selftext.length > 250 && (
                <button onClick={() => setExpanded(!expanded)} style={{ marginTop: 4, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'IBM Plex Mono', fontSize: 8, color: '#ff6644', padding: 0 }}>
                  {expanded ? '▲ Collapse' : '▼ Expand body'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Historical analog card
function AnalogCard({ analog, idx }) {
  const sim  = typeof analog.similarity === 'number' ? analog.similarity : 0
  const simColor = sim >= 0.9 ? '#00ff88' : sim >= 0.75 ? '#ffcc00' : '#ff6644'
  return (
    <div style={{ background: '#0d0d16', border: `1px solid ${simColor}30`, borderRadius: 4, padding: '12px 14px', marginBottom: 10, display: 'flex', gap: 14, alignItems: 'center' }}>
      <div style={{ textAlign: 'center', flexShrink: 0, width: 56 }}>
        <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 18, fontWeight: 700, color: simColor }}>{(sim * 100).toFixed(0)}%</div>
        <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, color: '#404060' }}>SIMILARITY</div>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: '#e8e8f0', fontWeight: 600 }}>{analog.ticker || '—'}</span>
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: '#7070a0' }}>{analog.date || '—'}</span>
          {analog.thesis && <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, padding: '1px 6px', background: '#4466ff18', borderRadius: 2, color: '#4466ff', border: '1px solid #4466ff30' }}>{analog.thesis}</span>}
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {analog.outcome && (
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: analog.outcome.startsWith('+') ? '#00ff88' : '#ff3355' }}>
              Outcome: {analog.outcome}
            </span>
          )}
          {!analog.outcome && <Mono size={9} color="#404060">No outcome recorded yet</Mono>}
        </div>
      </div>
    </div>
  )
}

// News headline card (for event layer)
function NewsHeadlineCard({ article, idx }) {
  return (
    <div style={{ display: 'flex', gap: 10, padding: '10px 14px', background: '#0d0d16', border: '1px solid #1e1e35', borderRadius: 4, marginBottom: 8 }}>
      <Mono size={9} color="#ffcc00" style={{ flexShrink: 0, marginTop: 2 }}>#{idx+1}</Mono>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ marginBottom: 3 }}>
          {article.url
            ? <a href={article.url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: '#c8c8e8', textDecoration: 'none', lineHeight: 1.5 }}
                onMouseEnter={e => e.target.style.color = '#ffcc00'}
                onMouseLeave={e => e.target.style.color = '#c8c8e8'}>{article.title}</a>
            : <Mono size={11} color="#c8c8e8">{article.title}</Mono>
          }
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {article.source && <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, padding: '1px 5px', background: '#1a1a2e', borderRadius: 2, color: '#7070a0' }}>{article.source}</span>}
          {article.published && <Mono size={8} color="#404060">{new Date(article.published * 1000).toLocaleDateString()}</Mono>}
          {article.url && <a href={article.url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, color: '#404060', textDecoration: 'none' }}>↗ open</a>}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Evidence Panel — rendered when navigated from DrilldownSidebar
// ─────────────────────────────────────────────────────────────────────────────
function EvidencePanel({ layerState }) {
  const { activeLayer, rawData, reasoning, score, confidence, weight, subSignals, ticker } = layerState
  const color = LAYER_COLORS[activeLayer] || '#4466ff'
  const label = LAYER_LABELS[activeLayer] || activeLayer
  const icon  = LAYER_ICONS[activeLayer]  || '◈'
  const scoreColor = score > 0.1 ? '#00ff88' : score < -0.1 ? '#ff3355' : '#ffcc00'

  const articles      = rawData?.articles     || []
  const redditPosts   = rawData?.redditPosts  || []
  const analogs       = rawData?.analogs       || []
  const newsArticles  = rawData?.newsArticles  || []
  const hasGemini     = !!rawData?.geminiReasoning
  const hasWebData    = articles.length > 0
  const hasReddit     = redditPosts.length > 0
  const hasAnalogs    = analogs.length > 0
  const hasNews       = newsArticles.length > 0

  const [activeTab, setActiveTab] = useState(
    hasGemini ? 'ai' : hasWebData ? 'articles' : hasReddit ? 'reddit' : 'math'
  )

  const tabs = [
    hasGemini             && { id: 'ai',       label: '🤖 AI SYNTHESIS',      count: null },
    (hasWebData||hasNews) && { id: 'articles',  label: '◈ WEB EVIDENCE',      count: articles.length + newsArticles.length },
    hasReddit             && { id: 'reddit',    label: '◈ REDDIT',             count: redditPosts.length },
    hasAnalogs            && { id: 'analogs',   label: '◈ HISTORICAL ANALOGS', count: analogs.length },
                             { id: 'math',      label: '◈ MATH BREAKDOWN',     count: null },
  ].filter(Boolean)

  return (
    <div>
      {/* Layer header */}
      <div style={{ background: '#0d0d16', border: `1px solid ${color}30`, borderRadius: 4, padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color, letterSpacing: '0.12em', marginBottom: 4 }}>{icon} {activeLayer?.toUpperCase()} — LAYER EVIDENCE READER</div>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 20, color: '#e8e8f0', marginBottom: 2 }}>{label}</div>
            {ticker && <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: '#7070a0' }}>Analysis for: <span style={{ color }}>{ticker}</span></div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 32, fontWeight: 700, color: scoreColor, lineHeight: 1 }}>{score >= 0 ? '+' : ''}{score.toFixed(3)}</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#404060' }}>CONF {(confidence * 100).toFixed(0)}%</span>
              <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#404060' }}>WEIGHT {(weight * 100).toFixed(1)}%</span>
            </div>
            {/* Source flags */}
            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', marginTop: 6 }}>
              {rawData?.sources?.serp   && <span style={{ fontFamily:'IBM Plex Mono', fontSize:8, padding:'1px 5px', background:'#4466ff18', borderRadius:2, color:'#4466ff', border:'1px solid #4466ff40' }}>WEB</span>}
              {rawData?.sources?.jina   && <span style={{ fontFamily:'IBM Plex Mono', fontSize:8, padding:'1px 5px', background:'#8855ff18', borderRadius:2, color:'#8855ff', border:'1px solid #8855ff40' }}>JINA</span>}
              {rawData?.sources?.gemini && <span style={{ fontFamily:'IBM Plex Mono', fontSize:8, padding:'1px 5px', background:'#00d4ff18', borderRadius:2, color:'#00d4ff', border:'1px solid #00d4ff40' }}>GEMINI</span>}
              {rawData?.sources?.reddit && <span style={{ fontFamily:'IBM Plex Mono', fontSize:8, padding:'1px 5px', background:'#ff664418', borderRadius:2, color:'#ff6644', border:'1px solid #ff664440' }}>REDDIT</span>}
              {!rawData?.sources?.serp && !rawData?.sources?.gemini && !rawData?.sources?.reddit && (
                <span style={{ fontFamily:'IBM Plex Mono', fontSize:8, padding:'1px 5px', background:'#1a1a2e', borderRadius:2, color:'#404060' }}>MATH ONLY</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #1e1e35', paddingBottom: 0 }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            fontFamily: 'IBM Plex Mono', fontSize: 9, padding: '8px 12px', cursor: 'pointer',
            background: activeTab === tab.id ? `${color}18` : 'transparent',
            border: 'none', borderBottom: activeTab === tab.id ? `2px solid ${color}` : '2px solid transparent',
            color: activeTab === tab.id ? color : '#7070a0', letterSpacing: '0.08em',
            display: 'flex', gap: 6, alignItems: 'center',
          }}>
            {tab.label}
            {tab.count != null && (
              <span style={{ background: activeTab === tab.id ? color : '#1a1a2e', color: activeTab === tab.id ? '#000' : '#7070a0', borderRadius: 10, padding: '0px 5px', fontSize: 8, fontWeight: 700 }}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab: AI Synthesis */}
      {activeTab === 'ai' && (
        <div>
          <SectionLabel>GEMINI AI SYNTHESIS — MATH-GROUNDED ANALYSIS</SectionLabel>
          <div style={{ background: '#0d0d16', border: '1px solid #00d4ff20', borderRadius: 4, padding: '16px 18px', marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, padding: '2px 7px', background: '#00d4ff18', borderRadius: 3, color: '#00d4ff', border: '1px solid #00d4ff40' }}>GEMINI 1.5 FLASH</span>
              {rawData?.geminiScore != null && (
                <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, padding: '2px 7px', background: scoreColor + '18', borderRadius: 3, color: scoreColor, border: `1px solid ${scoreColor}40` }}>AI SCORE: {rawData.geminiScore >= 0 ? '+' : ''}{rawData.geminiScore.toFixed(3)}</span>
              )}
            </div>
            <p style={{ fontSize: 13, color: '#c8c8e8', lineHeight: 1.8, margin: 0 }}>{rawData?.geminiReasoning || reasoning}</p>
          </div>

          {/* Key factors */}
          {rawData?.geminiKeyFactors?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <SectionLabel>KEY FACTORS IDENTIFIED</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {rawData.geminiKeyFactors.map((f, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, background: '#0d0d16', border: '1px solid #1e1e35', borderRadius: 4, padding: '10px 14px' }}>
                    <span style={{ color, fontSize: 10, fontFamily: 'IBM Plex Mono', flexShrink: 0, marginTop: 1 }}>►</span>
                    <span style={{ fontSize: 12, color: '#a0a0c0', lineHeight: 1.6, fontFamily: 'IBM Plex Mono' }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Additional Gemini metadata by layer */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[
              rawData?.geminiCrowdEmotion   && { label: 'CROWD EMOTION',    value: rawData.geminiCrowdEmotion },
              rawData?.geminiRegime         && { label: 'MARKET REGIME',    value: rawData.geminiRegime },
              rawData?.geminiFlowDirection  && { label: 'FLOW DIRECTION',   value: rawData.geminiFlowDirection },
              rawData?.geminiEntryQuality   && { label: 'ENTRY QUALITY',    value: rawData.geminiEntryQuality },
              rawData?.geminiMarginImpact   && { label: 'MARGIN IMPACT',    value: rawData.geminiMarginImpact },
              rawData?.geminiInstitutionalBias && { label: 'INST. BIAS',    value: rawData.geminiInstitutionalBias },
              rawData?.geminiEarningsQuality   && { label: 'EARN. QUALITY', value: rawData.geminiEarningsQuality },
              rawData?.geminiGuidanceTone      && { label: 'GUIDANCE TONE', value: rawData.geminiGuidanceTone },
            ].filter(Boolean).map((item, i) => (
              <div key={i} style={{ background: '#0d0d16', border: '1px solid #1e1e35', borderRadius: 4, padding: '10px 12px' }}>
                <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, color: '#404060', marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, fontWeight: 600, color }}{...{}}>{item.value}</div>
              </div>
            ))}
          </div>

          {/* Divergence warning */}
          {rawData?.geminiDivergence && (
            <div style={{ marginTop: 12, background: 'rgba(255,204,0,0.06)', border: '1px solid rgba(255,204,0,0.3)', borderRadius: 4, padding: '10px 14px' }}>
              <Mono size={9} color="#ffcc00" style={{ marginBottom: 4, display: 'block' }}>⚠ DIVERGENCE DETECTED</Mono>
              <Mono size={11} color="#e8c060">{rawData.geminiDivergenceNote || 'Crowd sentiment diverges from underlying event data.'}</Mono>
            </div>
          )}
        </div>
      )}

      {/* Tab: Web Evidence (Scraped Articles) */}
      {activeTab === 'articles' && (
        <div>
          {articles.length > 0 && (
            <>
              <SectionLabel>SCRAPED WEB ARTICLES (SERPAPI + JINA READER)</SectionLabel>
              <div style={{ marginBottom: 4 }}>
                <Mono size={9} color="#404060">Articles retrieved by SerpApi. Text extracted by Jina AI Reader. Exact sources Gemini read.</Mono>
              </div>
              <div style={{ marginBottom: 20, marginTop: 10 }}>
                {articles.map((a, i) => <ArticleCard key={i} article={a} idx={i} />)}
              </div>
            </>
          )}
          {newsArticles.length > 0 && (
            <>
              <SectionLabel>YAHOO FINANCE NEWS HEADLINES</SectionLabel>
              <div>
                {newsArticles.map((a, i) => <NewsHeadlineCard key={i} article={a} idx={i} />)}
              </div>
            </>
          )}
          {articles.length === 0 && newsArticles.length === 0 && (
            <NoDataCard message="No scraped articles available." hint="Add SERP_API_KEY to backend/.env to enable web article scraping." />
          )}
        </div>
      )}

      {/* Tab: Reddit Posts */}
      {activeTab === 'reddit' && (
        <div>
          <SectionLabel>REDDIT POSTS — EXACT SOURCES USED FOR SENTIMENT SCORING</SectionLabel>
          {redditPosts.length > 0
            ? redditPosts.map((p, i) => <RedditCard key={i} post={p} />)
            : <NoDataCard message="No Reddit posts available." hint="Reddit data is fetched live with no API key required." />
          }
        </div>
      )}

      {/* Tab: Historical Analogs */}
      {activeTab === 'analogs' && (
        <div>
          <SectionLabel>HISTORICAL ANALOG MATCHES FROM APEX MEMORY DATABASE</SectionLabel>
          {analogs.length > 0
            ? analogs.map((a, i) => <AnalogCard key={i} analog={a} idx={i} />)
            : <NoDataCard message="No historical analogs stored yet." hint="Run more analyses to build the pattern memory database. Analogs appear after 5+ stored snapshots." />
          }
          {rawData?.geminiSummary && (
            <div style={{ marginTop: 16, background: '#0d0d16', border: '1px solid #00d4ff20', borderRadius: 4, padding: '14px 16px' }}>
              <SectionLabel>GEMINI VALIDATION SUMMARY</SectionLabel>
              <p style={{ fontSize: 12, color: '#a0a0c0', lineHeight: 1.7, margin: 0 }}>{rawData.geminiSummary}</p>
            </div>
          )}
        </div>
      )}

      {/* Tab: Math Breakdown */}
      {activeTab === 'math' && (
        <div>
          <SectionLabel>MATHEMATICAL REASONING — THE NUMBERS BEHIND THE SCORE</SectionLabel>
          <div style={{ background: '#0d0d16', border: '1px solid #1e1e35', borderRadius: 4, padding: '14px 16px', marginBottom: 16 }}>
            <p style={{ fontSize: 12, color: '#a0a0c0', lineHeight: 1.7, margin: 0 }}>{reasoning || 'No reasoning available.'}</p>
          </div>

          {subSignals?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <SectionLabel>SUB-SIGNAL BREAKDOWN</SectionLabel>
              {subSignals.map((sub, i) => {
                const c = sub.score > 0.1 ? '#00ff88' : sub.score < -0.1 ? '#ff3355' : '#ffcc00'
                return (
                  <div key={i} style={{ background: '#0d0d16', border: '1px solid #1e1e35', borderRadius: 4, padding: '12px 14px', marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Mono size={11} color="#e8e8f0">{sub.name}</Mono>
                      <ScorePill score={sub.score} size={11} />
                    </div>
                    <div style={{ height: 5, background: '#1a1a2e', borderRadius: 3, position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', height: '100%', width: `${Math.abs(sub.score) * 50}%`, background: c, left: sub.score > 0 ? '50%' : `${50 - Math.abs(sub.score) * 50}%`, borderRadius: 3 }} />
                      <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: '#2a2a4a' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Math score vs Gemini score */}
          {rawData?.mathScore != null && rawData?.geminiScore != null && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[
                { label: 'MATH BASE SCORE',  value: rawData.mathScore >= 0 ? `+${rawData.mathScore.toFixed(3)}` : rawData.mathScore.toFixed(3), color: scoreColor },
                { label: 'GEMINI AI SCORE',  value: rawData.geminiScore >= 0 ? `+${rawData.geminiScore.toFixed(3)}` : rawData.geminiScore.toFixed(3), color: '#00d4ff' },
                { label: 'FINAL BLENDED',    value: score >= 0 ? `+${score.toFixed(3)}` : score.toFixed(3), color },
              ].map(item => (
                <div key={item.label} style={{ background: '#0d0d16', border: '1px solid #1e1e35', borderRadius: 4, padding: '12px 14px' }}>
                  <Mono size={8} color="#404060" style={{ display: 'block', marginBottom: 5 }}>{item.label}</Mono>
                  <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 20, fontWeight: 700, color: item.color }}>{item.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function NoDataCard({ message, hint }) {
  return (
    <div style={{ background: '#0d0d16', border: '1px dashed #1e1e35', borderRadius: 4, padding: '24px', textAlign: 'center' }}>
      <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 13, color: '#404060', marginBottom: 8 }}>{message}</div>
      {hint && <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: '#2a2a4a', lineHeight: 1.6 }}>{hint}</div>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Normal layer detail panel (existing behavior)
// ─────────────────────────────────────────────────────────────────────────────
function LayerDetailPanel({ layer }) {
  const [expanded, setExpanded] = useState(false)
  const scoreColor  = layer.score > 0.1 ? '#00ff88' : layer.score < -0.1 ? '#ff3355' : '#ffcc00'
  const direction   = layer.score > 0.15 ? 'BULLISH' : layer.score < -0.15 ? 'BEARISH' : 'NEUTRAL'
  return (
    <div style={{ background: '#0d0d16', border: `1px solid ${expanded ? '#2a2a4a' : '#1e1e35'}`, borderRadius: 4, overflow: 'hidden', cursor: 'pointer', transition: 'border-color 0.2s' }} onClick={() => setExpanded(!expanded)}>
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 4, alignSelf: 'stretch', background: layer.color, borderRadius: 2, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div>
              <Mono size={9} color="#404060" style={{ display: 'block', marginBottom: 2, letterSpacing: '0.1em' }}>LAYER {LAYERS.findIndex(l => l.id === layer.id) + 1} — {layer.shortName ?? layer.id?.toUpperCase?.()}</Mono>
              <Mono size={13} color="#e8e8f0">{layer.name}</Mono>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 20, fontWeight: 600, color: scoreColor }}>{layer.score > 0 ? '+' : ''}{layer.score.toFixed(3)}</div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 2 }}>
                <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, padding: '1px 6px', borderRadius: 2, background: `${scoreColor}20`, color: scoreColor }}>{direction}</span>
                <Mono size={9} color="#404060">CONF {(layer.confidence * 100).toFixed(0)}%</Mono>
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {layer.subSignals.map((sub, i) => {
              const sc = sub.score > 0.1 ? '#00ff88' : sub.score < -0.1 ? '#ff3355' : '#ffcc00'
              return (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <Mono size={9} color="#7070a0">{sub.name}</Mono>
                    <Mono size={9} color={sc}>{sub.score > 0 ? '+' : ''}{sub.score.toFixed(2)}</Mono>
                  </div>
                  <div style={{ height: 3, background: '#1e1e35', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
                    <div style={{ position: 'absolute', height: '100%', width: `${Math.abs(sub.score) * 50}%`, background: sc, left: sub.score > 0 ? '50%' : `${50 - Math.abs(sub.score) * 50}%` }} />
                    <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: '#2a2a4a' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <div style={{ color: '#404060', fontSize: 12, flexShrink: 0 }}>{expanded ? '▲' : '▼'}</div>
      </div>
      {expanded && (
        <div style={{ padding: '12px 16px 16px', borderTop: '1px solid #1e1e35', background: '#111120' }}>
          <Mono size={9} color="#404060" style={{ display: 'block', letterSpacing: '0.1em', marginBottom: 8 }}>AI REASONING</Mono>
          <p style={{ fontSize: 12, color: '#a0a0c0', lineHeight: 1.7 }}>{layer.reasoning}</p>
          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            {[
              { label: 'RAW SCORE',  value: `${layer.score > 0 ? '+' : ''}${layer.score.toFixed(3)}`, color: scoreColor },
              { label: 'WEIGHT',     value: `${(layer.weight * 100).toFixed(1)}%`,                     color: '#e8e8f0' },
              { label: 'CONFIDENCE', value: `${(layer.confidence * 100).toFixed(0)}%`,                 color: '#e8e8f0' },
            ].map(item => (
              <div key={item.label} style={{ background: '#0d0d16', padding: 10, borderRadius: 3, border: '1px solid #1e1e35' }}>
                <Mono size={9} color="#404060" style={{ display: 'block', marginBottom: 4 }}>{item.label}</Mono>
                <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 16, color: item.color }}>{item.value}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, padding: '8px 10px', background: '#0d0d16', borderRadius: 3, border: `1px solid ${layer.color}30` }}>
            <Mono size={9} color={layer.color}>{layer.shortName} CONTRIBUTION: </Mono>
            <Mono size={9} color="#7070a0">{((layer.score * layer.weight) * 100).toFixed(2)} weighted signal points → {direction} pressure</Mono>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────
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
    topDrivers: signals.sort((a, b) => Math.abs((b.score ?? 0) * (b.weight ?? 0.11)) - Math.abs((a.score ?? 0) * (a.weight ?? 0.11))).slice(0, 3).map(l => ({ name: l.name, score: l.score, weight: l.weight ?? 0.11 })),
  }
}

export default function Analysis({ selectedStock, setSelectedStock }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { signals, loading, error, analyze } = useAnalysis()

  const layerState = location.state?.activeLayer ? location.state : null

  const [compareStock, setCompareStock] = useState(null)
  const [compareSignals, setCompareSignals] = useState([])

  useEffect(() => {
    analyze(selectedStock)
  }, [selectedStock, analyze])

  useEffect(() => {
    if (compareStock) {
      fetch(`/api/analyze/${compareStock}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => setCompareSignals(data?.signals ?? []))
        .catch(() => setCompareSignals([]))
    } else setCompareSignals([])
  }, [compareStock])

  const prediction = predictionFromSignals(signals)
  const radarData = signals.map(s => ({ layer: s.shortName ?? s.id, value: ((s.score ?? 0) + 1) / 2 }))
  const barData   = signals.map((s, i) => ({ name: s.shortName ?? s.id, score: s.score ?? 0, color: s.color, compareScore: compareSignals[i]?.score }))

  // ── EVIDENCE MODE ──────────────────────────────────────────────────────────
  if (layerState) {
    return (
      <div style={{ padding: 20 }}>
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          style={{ marginBottom: 20, background: 'none', border: '1px solid #1e1e35', borderRadius: 4, padding: '7px 14px', cursor: 'pointer', fontFamily: 'IBM Plex Mono', fontSize: 10, color: '#7070a0', display: 'flex', alignItems: 'center', gap: 6 }}>
          ← BACK TO OVERVIEW
        </button>
        <EvidencePanel layerState={layerState} />
      </div>
    )
  }

  // ── NORMAL MODE ─────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Mono size={9} color="#404060" style={{ display: 'block', letterSpacing: '0.15em', marginBottom: 4 }}>LAYER ANALYSIS SYSTEM</Mono>
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 20, color: '#e8e8f0' }}>Multi-Factor Signal Breakdown</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Mono size={10} color="#404060">SYMBOL:</Mono>
          <select value={selectedStock} onChange={e => setSelectedStock(e.target.value)} style={{ background: '#0d0d16', border: '1px solid #1e1e35', color: '#e8e8f0', fontFamily: 'IBM Plex Mono', fontSize: 11, padding: '6px 10px', borderRadius: 3, cursor: 'pointer' }}>
            {DEFAULT_SYMBOLS.map(sym => <option key={sym} value={sym}>{sym}</option>)}
          </select>
          <Mono size={10} color="#404060">COMPARE:</Mono>
          <select value={compareStock || ''} onChange={e => setCompareStock(e.target.value || null)} style={{ background: '#0d0d16', border: '1px solid #1e1e35', color: compareStock ? '#e8e8f0' : '#404060', fontFamily: 'IBM Plex Mono', fontSize: 11, padding: '6px 10px', borderRadius: 3, cursor: 'pointer' }}>
            <option value="">None</option>
            {DEFAULT_SYMBOLS.filter(s => s !== selectedStock).map(sym => <option key={sym} value={sym}>{sym}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loading && signals.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: '#4466ff', fontFamily: 'IBM Plex Mono', fontSize: 11 }}>Running 9-layer pipeline…</div>
          )}
          {error && signals.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: '#ff3355', fontFamily: 'IBM Plex Mono', fontSize: 11 }}>{error}</div>
          )}
          {signals.map(layer => <LayerDetailPanel key={layer.id} layer={layer} />)}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {prediction && (
            <div style={{ background: '#0d0d16', border: '1px solid #1e1e35', borderRadius: 4, padding: 16 }}>
              <SectionLabel>PREDICTION SUMMARY — {selectedStock}</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: 'DIRECTION',   value: prediction.direction,  color: prediction.direction === 'BULLISH' ? '#00ff88' : prediction.direction === 'BEARISH' ? '#ff3355' : '#ffcc00' },
                  { label: 'PROBABILITY', value: `${(prediction.probability * 100).toFixed(1)}%`, color: '#e8e8f0' },
                  { label: 'TARGET MOVE', value: `${prediction.targetMove > 0 ? '+' : ''}${prediction.targetMove}%`, color: prediction.targetMove > 0 ? '#00ff88' : '#ff3355' },
                  { label: 'CONFIDENCE',  value: `${(prediction.confidence * 100).toFixed(0)}%`, color: '#4466ff' },
                ].map(item => (
                  <div key={item.label} style={{ background: '#111120', padding: 10, borderRadius: 3, border: '1px solid #1e1e35' }}>
                    <Mono size={9} color="#404060" style={{ display: 'block', marginBottom: 4 }}>{item.label}</Mono>
                    <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 18, fontWeight: 600, color: item.color }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{ background: '#0d0d16', border: '1px solid #1e1e35', borderRadius: 4, padding: 16 }}>
            <SectionLabel>LAYER SCORES {compareStock ? `— ${selectedStock} vs ${compareStock}` : `— ${selectedStock}`}</SectionLabel>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barData} layout="vertical" margin={{ top: 0, right: 20, left: 40, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e35" horizontal={false} />
                <XAxis type="number" domain={[-1, 1]} tick={{ fill: '#404060', fontSize: 9, fontFamily: 'IBM Plex Mono' }} tickLine={false} axisLine={{ stroke: '#1e1e35' }} />
                <YAxis dataKey="name" type="category" tick={{ fill: '#7070a0', fontSize: 9, fontFamily: 'IBM Plex Mono' }} tickLine={false} axisLine={false} width={40} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="score" name={selectedStock} radius={[0, 2, 2, 0]}>
                  {barData.map((e, i) => <Cell key={i} fill={e.score > 0 ? '#00ff88' : '#ff3355'} fillOpacity={0.8} />)}
                </Bar>
                {compareStock && (
                  <Bar dataKey="compareScore" name={compareStock} radius={[0, 2, 2, 0]} fillOpacity={0.4}>
                    {barData.map((e, i) => <Cell key={i} fill={e.compareScore > 0 ? '#00d4ff' : '#ff8855'} />)}
                  </Bar>
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ background: '#0d0d16', border: '1px solid #1e1e35', borderRadius: 4, padding: 16 }}>
            <SectionLabel>SIGNAL STRENGTH RADAR</SectionLabel>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                <PolarGrid stroke="#1e1e35" />
                <PolarAngleAxis dataKey="layer" tick={{ fill: '#7070a0', fontSize: 9, fontFamily: 'IBM Plex Mono' }} />
                <Radar name={selectedStock} dataKey="value" stroke="#4466ff" fill="#4466ff" fillOpacity={0.2} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ background: '#0d0d16', border: '1px solid #1e1e35', borderRadius: 4, padding: 16 }}>
            <SectionLabel>LAYER METHODOLOGY</SectionLabel>
            {LAYERS.map(layer => (
              <div key={layer.id} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
                <div style={{ width: 3, height: 3, borderRadius: '50%', background: layer.color, marginTop: 5, flexShrink: 0 }} />
                <div>
                  <Mono size={9} color={layer.color}>{layer.shortName} </Mono>
                  <Mono size={10} color="#7070a0">{layer.description}</Mono>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

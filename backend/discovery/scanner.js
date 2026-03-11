// backend/discovery/scanner.js
// Autonomous scanner: hunts the universe for high-convergence setups

const { fetchYFChart, fetchYFSummary, fetchYFNews } = require('../utils/fetcher')
const { computeMomentumScore, scoreText, clamp } = require('../utils/scorer')
const { buildVector } = require('../memory/vectorStore')

// Universe of tickers to monitor
const DEFAULT_UNIVERSE = (process.env.SCAN_UNIVERSE || 
  'NVDA,AAPL,MSFT,GOOGL,AMZN,META,TSLA,JPM,XOM,CVX,AMD,INTC,NFLX,CRM,BA,GS,WMT,JNJ,PFE,V,MA,PYPL,PLTR,COIN,SPY,QQQ'
).split(',').map(t => t.trim()).filter(Boolean)

const SECTOR_MAP = {
  NVDA:'Technology', AAPL:'Technology', MSFT:'Technology', GOOGL:'Technology',
  AMZN:'Consumer Disc', META:'Technology', TSLA:'Consumer Disc', JPM:'Financials',
  XOM:'Energy', CVX:'Energy', AMD:'Technology', INTC:'Technology',
  NFLX:'Communication', CRM:'Technology', BA:'Industrials', GS:'Financials',
  WMT:'Consumer Staples', JNJ:'Healthcare', PFE:'Healthcare', V:'Financials',
  MA:'Financials', PYPL:'Financials', PLTR:'Technology', COIN:'Financials',
  SPY:'Index', QQQ:'Index',
}

/**
 * Lightweight quick-score for a single ticker
 * Uses only price momentum + news sentiment (fast, ~2 API calls)
 * Returns a convergence estimate without running the full pipeline
 */
async function quickScore(ticker) {
  const t0 = Date.now()
  try {
    const [candles, news] = await Promise.all([
      fetchYFChart(ticker, '3mo', '1d'),
      fetchYFNews(ticker, 10),
    ])

    // ── Momentum ──────────────────────────────────────────────
    const momtScore = candles ? computeMomentumScore(candles) : 0

    // ── News sentiment ────────────────────────────────────────
    let sentScore = 0
    if (news?.length > 0) {
      const scores = news.map(n => scoreText(`${n.title || ''} ${n.summary || ''}`.toLowerCase()))
      sentScore = scores.reduce((a, b) => a + b, 0) / scores.length
    }

    // ── Price data ────────────────────────────────────────────
    const closes = candles?.map(d => d.close).filter(Boolean) || []
    const lastPrice = closes.at(-1) || 0
    const ret5 = closes.length >= 6
      ? (closes.at(-1) - closes.at(-6)) / closes.at(-6)
      : 0

    // ── Quick convergence estimate ────────────────────────────
    // Rough approximation of what a full pipeline would give
    const baseScore   = momtScore * 0.55 + sentScore * 0.30 + clamp(ret5 * 8) * 0.15
    const convergence = Math.abs(baseScore)  // how "decided" are the signals (0-1)
    const direction   = baseScore > 0 ? 'BULLISH' : baseScore < 0 ? 'BEARISH' : 'NEUTRAL'

    // ── Simple thesis classification ──────────────────────────
    let thesis = 'MONITOR'
    if (convergence > 0.45 && momtScore > 0.35 && sentScore > 0.2) thesis = 'MOMENTUM_BREAKOUT'
    else if (convergence > 0.40 && sentScore > 0.35 && momtScore < 0) thesis = 'CONTRARIAN_LONG'
    else if (convergence > 0.40 && baseScore < -0.35) thesis = 'HIGH_CONVICTION_SHORT'
    else if (convergence > 0.30) thesis = 'WATCH'

    return {
      ticker,
      sector:       SECTOR_MAP[ticker] || 'Unknown',
      score:        +baseScore.toFixed(3),
      convergence:  +convergence.toFixed(3),
      direction,
      thesis,
      lastPrice:    +lastPrice.toFixed(2),
      ret5d:        +(ret5 * 100).toFixed(2),
      momentumScore: +momtScore.toFixed(3),
      sentimentScore:+sentScore.toFixed(3),
      newsCount:    news?.length || 0,
      topHeadline:  news?.[0]?.title || null,
      dataAge:      Date.now() - t0,
      isLive:       !!candles,
    }
  } catch (err) {
    // Full mock fallback for this ticker
    const score = deterministicScore(ticker, 'scan')
    return {
      ticker,
      sector:       SECTOR_MAP[ticker] || 'Unknown',
      score,
      convergence:  Math.abs(score),
      direction:    score > 0.05 ? 'BULLISH' : score < -0.05 ? 'BEARISH' : 'NEUTRAL',
      thesis:       Math.abs(score) > 0.4 ? 'WATCH' : 'MONITOR',
      lastPrice:    0,
      ret5d:        0,
      momentumScore: score,
      sentimentScore: score * 0.8,
      newsCount:    0,
      topHeadline:  null,
      dataAge:      Date.now() - t0,
      isLive:       false,
    }
  }
}

/**
 * Scan the universe in parallel (with concurrency limit)
 * Returns top N results sorted by convergence score
 */
async function scanUniverse(limit = 10, universe = DEFAULT_UNIVERSE) {
  const CONCURRENCY = 6
  const results = []
  const tStart  = Date.now()

  // Process in batches
  for (let i = 0; i < universe.length; i += CONCURRENCY) {
    const batch = universe.slice(i, i + CONCURRENCY)
    const batchResults = await Promise.all(batch.map(ticker => quickScore(ticker)))
    results.push(...batchResults)
  }

  // Sort by convergence (highest first), then by absolute score
  const sorted = results
    .filter(r => r.convergence > 0.15)
    .sort((a, b) => b.convergence - a.convergence || Math.abs(b.score) - Math.abs(a.score))

  const elapsed = Date.now() - tStart
  console.log(`[scanner] Scanned ${universe.length} tickers in ${elapsed}ms`)

  return {
    timestamp: new Date().toISOString(),
    elapsed,
    scanned: universe.length,
    results: sorted.slice(0, limit),
    universe,
  }
}

/**
 * Get the scanner's full universe list
 */
function getUniverse() {
  return DEFAULT_UNIVERSE
}

module.exports = { scanUniverse, quickScore, getUniverse }

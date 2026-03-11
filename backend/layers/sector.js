// backend/layers/sector.js
// Stage 0B — Sector Rotation & Relative Strength
// MATH: ETF 20d return vs SPY → exact relative strength %
// SCRAPE: "[Sector ETF name] sector equity performance capital rotation trends"
// GEMINI: "The [Sector] ETF is outperforming market by X%. Are institutional flows supporting this?"

const { fetchYFChart }                         = require('../utils/fetcher')
const { normalise, buildSparkline, clamp } = require('../utils/scorer')
const { researchLayer, getCapabilities }       = require('../utils/scraper')

const LAYER_ID = 'sector'

const SECTOR_MAP = {
  NVDA:'XLK', AAPL:'XLK', MSFT:'XLK', AMD:'XLK', INTC:'XLK', GOOGL:'XLC',
  META:'XLC', NFLX:'XLC', AMZN:'XLY', TSLA:'XLY', JPM:'XLF', GS:'XLF',
  BAC:'XLF', V:'XLF', MA:'XLF', XOM:'XLE', CVX:'XLE', JNJ:'XLV', PFE:'XLV',
  WMT:'XLP', PYPL:'XLF', COIN:'XLF', CRM:'XLK', BA:'XLI', PLTR:'XLK',
  DEFAULT:'SPY',
}
const SECTOR_NAMES = {
  XLK:'Technology', XLC:'Communication', XLY:'Consumer Discretionary',
  XLF:'Financials', XLE:'Energy', XLV:'Healthcare', XLP:'Consumer Staples',
  XLI:'Industrials', XLB:'Materials', SPY:'Broad Market',
}

async function analyze(ticker, context = {}) {
  const sources = { live: false, serp: false, jina: false, gemini: false }
  const etf = SECTOR_MAP[ticker.toUpperCase()] || SECTOR_MAP.DEFAULT
  const sectorName = SECTOR_NAMES[etf] || etf

  let etfRet = 0, spyRet = 0, relPerf = 0, tickerRet = 0
  let score = 0
  let sparkline = Array(16).fill(0)

  try {
    const [etfData, spyData, tickerData] = await Promise.all([
      fetchYFChart(etf,     '3mo', '1d'),
      fetchYFChart('SPY',   '3mo', '1d'),
      fetchYFChart(ticker,  '3mo', '1d'),
    ])
    if (!etfData || !spyData) throw new Error('Sector data unavailable')
    sources.live = true

    const etfC  = etfData.map(d  => d.close).filter(Boolean)
    const spyC  = spyData.map(d  => d.close).filter(Boolean)
    const tickC = tickerData?.map(d => d.close).filter(Boolean) || []

    etfRet    = etfC.length  >= 21 ? (etfC.at(-1)  - etfC.at(-21))  / etfC.at(-21)  : 0
    spyRet    = spyC.length  >= 21 ? (spyC.at(-1)  - spyC.at(-21))  / spyC.at(-21)  : 0
    tickerRet = tickC.length >= 21 ? (tickC.at(-1) - tickC.at(-21)) / tickC.at(-21) : 0
    relPerf   = etfRet - spyRet

    const relPerfScore    = normalise(relPerf, -0.08, 0.08)
    const tickerVsEtf     = normalise(tickerRet - etfRet, -0.08, 0.08)
    const etfAbsScore     = normalise(etfRet, -0.10, 0.10)
    score = clamp(relPerfScore * 0.45 + etfAbsScore * 0.30 + tickerVsEtf * 0.25)
    sparkline = buildSparkline(etfC)
  } catch (err) { console.warn(`[sector] live fetch failed: ${err.message}`) }

  const mathData = {
    ticker, etf, sectorName,
    etf20dReturn:        +(etfRet  * 100).toFixed(2),
    spy20dReturn:        +(spyRet  * 100).toFixed(2),
    ticker20dReturn:     +(tickerRet * 100).toFixed(2),
    relativePerformance: +(relPerf * 100).toFixed(2),
    outperforming:       relPerf > 0,
    mathBasedScore:      +score.toFixed(3),
  }

  let articles = [], gemResult = null
  if (getCapabilities().serp) {
    try {
      const query = `${sectorName} sector ETF equity performance institutional capital rotation ${new Date().getFullYear()}`
      const r = await researchLayer('sector', ticker, query, mathData, { numArticles: 5, jinaLimit: 3 })
      articles = r.articles || []; gemResult = r.geminiResult
      sources.serp = r.sources.serp; sources.jina = r.sources.jina; sources.gemini = r.sources.gemini
    } catch (err) { console.warn(`[sector] scraper: ${err.message}`) }
  }

  const finalScore     = gemResult?.score != null ? clamp(score * 0.40 + gemResult.score * 0.60) : score
  const finalReasoning = gemResult?.reasoning || `${etf} sector ${relPerf > 0 ? 'outperforming' : 'underperforming'} SPY by ${(Math.abs(relPerf)*100).toFixed(1)}%.`

  return {
    id: LAYER_ID, score: +finalScore.toFixed(3),
    confidence: +Math.min(0.92, 0.5 + Math.abs(finalScore) * 0.4).toFixed(2),
    weight: 0.11, reasoning: finalReasoning,
    subSignals: [
      { name: `${etf} 20d Return`,    score: +normalise(etfRet, -0.10, 0.10).toFixed(2) },
      { name: 'Relative vs SPY',      score: +normalise(relPerf, -0.08, 0.08).toFixed(2) },
      { name: 'Ticker vs Sector',     score: +normalise(tickerRet - etfRet, -0.08, 0.08).toFixed(2) },
      { name: 'Sector Breadth',       score: +score.toFixed(2) },
    ],
    sparkline,
    rawData: {
      etf, sectorName, etfRet: +(etfRet*100).toFixed(2), spyRet: +(spyRet*100).toFixed(2),
      relPerf: +(relPerf*100).toFixed(2), tickerRet: +(tickerRet*100).toFixed(2),
      mathScore: +score.toFixed(3),
      articles: articles.map(a => ({ title: a.title, url: a.url, source: a.source, snippet: a.snippet, fullText: a.fullText })),
      geminiScore: gemResult?.score ?? null, geminiReasoning: gemResult?.reasoning ?? null,
      geminiKeyFactors: gemResult?.keyFactors || [], geminiFlowDirection: gemResult?.flowDirection ?? null,
      sources,
    },
    sources,
    _context: { sectorETF: etf, sectorScore: finalScore },
  }
}

module.exports = { analyze }

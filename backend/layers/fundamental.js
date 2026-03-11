// backend/layers/fundamental.js
// Stage 2A — Fundamental Health & Earnings Quality
// MATH: Forward P/E, revenue growth %, last 4 quarters EPS beats from YF
// SCRAPE: "[Ticker] earnings call transcript analysis forward guidance [year]"
// GEMINI: "This stock has Forward P/E of X and beat last EPS by Y%. Is management guidance supporting these numbers?"

const { fetchYFSummary }                       = require('../utils/fetcher')
const { normalise, clamp } = require('../utils/scorer')
const { researchLayer, getCapabilities }       = require('../utils/scraper')

const LAYER_ID = 'fundamental'

async function analyze(ticker, context = {}) {
  const sources = { live: false, serp: false, jina: false, gemini: false }

  let epsSurpriseScore = 0, revenueScore = 0, guidanceScore = 0
  let analystScore = 0, profitabilityScore = 0, mathScore = 0
  let forwardPE = null, revenueGrowth = null, epsSurprisePct = null
  let epsHistory = [], latestEarnings = null

  try {
    const summary = await fetchYFSummary(ticker, 'earnings,earningsTrend,defaultKeyStatistics,financialData,recommendationTrend')
    if (!summary) throw new Error('No fundamental data')
    sources.live = true

    const fd   = summary.financialData          || {}
    const ks   = summary.defaultKeyStatistics   || {}
    const et   = summary.earningsTrend          || {}
    const rec  = summary.recommendationTrend    || {}
    const earn = summary.earnings               || {}

    // EPS surprise (last quarter)
    const earningsHistory = earn.earningsChart?.quarterly || []
    latestEarnings        = earningsHistory.at(-1)
    epsHistory            = earningsHistory.slice(-4)
    if (latestEarnings?.actual?.raw != null && latestEarnings?.estimate?.raw != null) {
      const actual   = latestEarnings.actual.raw
      const estimate = latestEarnings.estimate.raw
      epsSurprisePct = estimate !== 0 ? (actual - estimate) / Math.abs(estimate) : 0
      epsSurpriseScore = normalise(epsSurprisePct, -0.30, 0.30)
    }

    revenueGrowth  = fd.revenueGrowth?.raw ?? 0
    revenueScore   = normalise(revenueGrowth, -0.15, 0.25)
    forwardPE      = ks.forwardPE?.raw ?? null

    const trend = et.trend || []
    const next  = trend.find(t => t.period === '0q') || trend[0]
    if (next?.earningsEstimate) {
      const low   = next.earningsEstimate.low?.raw  ?? 0
      const high  = next.earningsEstimate.high?.raw ?? 0
      const mean  = next.earningsEstimate.avg?.raw  ?? 0
      guidanceScore = clamp(mean > 0 ? normalise(mean, low * 0.9, high * 1.1) : 0)
    }

    const recs    = rec.trend?.[0] || {}
    const buy     = (recs.strongBuy || 0) + (recs.buy || 0)
    const sell    = (recs.sell      || 0) + (recs.strongSell || 0)
    const total   = buy + sell + (recs.hold || 0)
    analystScore  = total > 0 ? normalise(buy / total, 0.2, 0.8) : 0

    const margins = fd.grossMargins?.raw ?? 0
    profitabilityScore = normalise(margins, 0, 0.5)

    mathScore = clamp(epsSurpriseScore*0.30 + revenueScore*0.25 + guidanceScore*0.20 + analystScore*0.15 + profitabilityScore*0.10)
  } catch (err) {
    console.warn(`[fundamental] live fetch failed: ${err.message}`)
    mathScore = 0
  }

  const mathData = {
    ticker, forwardPE, revenueGrowthPct: revenueGrowth != null ? +(revenueGrowth*100).toFixed(1) : null,
    epsSurprisePct: epsSurprisePct != null ? +(epsSurprisePct*100).toFixed(1) : null,
    epsSurpriseScore: +epsSurpriseScore.toFixed(3),
    guidanceScore: +guidanceScore.toFixed(3), analystScore: +analystScore.toFixed(3),
    revenueScore: +revenueScore.toFixed(3), mathBasedScore: +mathScore.toFixed(3),
    lastQuarterEPS: latestEarnings ? { actual: latestEarnings.actual?.raw, estimate: latestEarnings.estimate?.raw } : null,
    epsHistoryBeats: epsHistory.filter(e => e.actual?.raw > e.estimate?.raw).length,
    epsHistoryTotal: epsHistory.length,
  }

  let articles = [], gemResult = null
  if (getCapabilities().serp) {
    try {
      const query = `${ticker} earnings call transcript forward guidance analyst notes ${new Date().getFullYear()}`
      const r = await researchLayer('fundamental', ticker, query, mathData, { numArticles: 5, jinaLimit: 3 })
      articles = r.articles || []; gemResult = r.geminiResult
      sources.serp = r.sources.serp; sources.jina = r.sources.jina; sources.gemini = r.sources.gemini
    } catch (err) { console.warn(`[fundamental] scraper: ${err.message}`) }
  }

  const finalScore     = gemResult?.score != null ? clamp(mathScore * 0.40 + gemResult.score * 0.60) : mathScore
  const finalReasoning = gemResult?.reasoning || `EPS surprise: ${epsSurprisePct != null ? (epsSurprisePct*100).toFixed(1)+'%' : 'N/A'}. Revenue growth: ${revenueGrowth != null ? (revenueGrowth*100).toFixed(1)+'%' : 'N/A'}. ${forwardPE ? `Fwd P/E: ${forwardPE.toFixed(1)}x.` : ''}`

  return {
    id: LAYER_ID, score: +finalScore.toFixed(3),
    confidence: +Math.min(0.92, 0.5 + Math.abs(finalScore) * 0.4).toFixed(2),
    weight: 0.12, reasoning: finalReasoning,
    subSignals: [
      { name: 'EPS Surprise',      score: +epsSurpriseScore.toFixed(2) },
      { name: 'Revenue Growth',    score: +revenueScore.toFixed(2) },
      { name: 'Analyst Revisions', score: +guidanceScore.toFixed(2) },
      { name: 'Analyst Consensus', score: +analystScore.toFixed(2) },
      { name: 'Profitability',     score: +profitabilityScore.toFixed(2) },
    ],
    sparkline: Array(16).fill(0).map((_, i) => finalScore * (i / 15)),
    rawData: {
      forwardPE, revenueGrowth: revenueGrowth != null ? +(revenueGrowth*100).toFixed(1) : null,
      epsSurprisePct: epsSurprisePct != null ? +(epsSurprisePct*100).toFixed(1) : null,
      epsBeats: `${epsHistory.filter(e => e.actual?.raw > e.estimate?.raw).length}/${epsHistory.length} quarters`,
      mathScore: +mathScore.toFixed(3),
      articles: articles.map(a => ({ title: a.title, url: a.url, source: a.source, snippet: a.snippet, fullText: a.fullText })),
      geminiScore: gemResult?.score ?? null, geminiReasoning: gemResult?.reasoning ?? null,
      geminiEarningsQuality: gemResult?.earningsQuality ?? null,
      geminiGuidanceTone: gemResult?.guidanceTone ?? null,
      geminiKeyFactors: gemResult?.keyFactors || [],
      sources,
    },
    sources,
    _context: { fundamentalScore: finalScore },
  }
}

module.exports = { analyze }

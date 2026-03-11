// backend/layers/macro.js
// Stage 0A — Macroeconomic Risk Regime
// MATH: VIX, 10Y yield, yield curve, S&P trend, FRED CPI
// SCRAPE: "current macroeconomic environment inflation fed interest rates"
// GEMINI: "Here are Treasury yields, VIX, CPI, and macro news. Score systemic market risk -1.0 to +1.0."

const { fetchYFChart, fetchFRED }              = require('../utils/fetcher')
const { normalise, buildSparkline, clamp } = require('../utils/scorer')
const { researchLayer, getCapabilities }       = require('../utils/scraper')

const LAYER_ID = 'macro'
const MACRO_TICKERS = { vix: '^VIX', tnx: '^TNX', irx: '^IRX', sp500: '^GSPC' }

async function analyze(ticker, context = {}) {
  const sources = { live: false, serp: false, jina: false, gemini: false }

  let vixLast = 20, tnxLast = 4.5, irxLast = 5.0, spread = -0.5, sp20dRet = 0
  let vixScore = 0, vixTrend = 0, yieldScore = 0, spScore = 0, rateScore = 0
  let sparkline = Array(16).fill(0)

  try {
    const [vixData, tnxData, irxData, spData] = await Promise.all([
      fetchYFChart(MACRO_TICKERS.vix,   '1mo', '1d'),
      fetchYFChart(MACRO_TICKERS.tnx,   '1mo', '1d'),
      fetchYFChart(MACRO_TICKERS.irx,   '1mo', '1d'),
      fetchYFChart(MACRO_TICKERS.sp500, '3mo', '1d'),
    ])
    if (!vixData || !tnxData || !spData) throw new Error('Macro data unavailable')
    sources.live = true

    vixLast   = vixData.at(-1)?.close ?? 20
    const vix5dAvg = vixData.slice(-5).reduce((s, d) => s + d.close, 0) / 5
    vixScore  = normalise(vixLast, 40, 12, true)
    vixTrend  = normalise(vixLast - vix5dAvg, 5, -5, true)
    tnxLast   = tnxData.at(-1)?.close ?? 4.5
    irxLast   = irxData?.at(-1)?.close ?? 5.0
    spread    = tnxLast - irxLast
    yieldScore = normalise(spread, -2, 2)
    const spCloses = spData.map(d => d.close)
    sp20dRet  = spCloses.length >= 21 ? (spCloses.at(-1) - spCloses.at(-21)) / spCloses.at(-21) : 0
    spScore   = normalise(sp20dRet, -0.08, 0.08)
    rateScore = normalise(tnxLast, 6, 1, true)
    sparkline = buildSparkline(vixData.map(d => 40 - d.close))
  } catch (err) {
    console.warn(`[macro] live fetch failed: ${err.message}`)
  }

  // Optional FRED CPI
  let cpiLatest = null
  try {
    const obs = await fetchFRED('CPIAUCSL')
    cpiLatest = obs?.[0]?.value ? parseFloat(obs[0].value) : null
  } catch (_) {}

  const mathScore = clamp(vixScore*0.30 + vixTrend*0.15 + yieldScore*0.25 + spScore*0.20 + rateScore*0.10)
  const isHighVol = vixLast > 25

  // Math payload for Gemini
  const mathData = {
    ticker, vixLevel: +vixLast.toFixed(2), vixScore: +vixScore.toFixed(3),
    tenYearYield: +tnxLast.toFixed(2), threeMonthYield: +irxLast.toFixed(2),
    yieldCurveSpread: +spread.toFixed(2), yieldCurveInverted: spread < 0,
    sp500_20dReturn: +(sp20dRet * 100).toFixed(2),
    cpiLatest, isHighVolatilityRegime: isHighVol,
    mathBasedScore: +mathScore.toFixed(3),
    regime: mathScore > 0.3 ? 'BULL' : mathScore < -0.3 ? 'BEAR' : mathScore < -0.1 ? 'HIGH_VOL' : 'NEUTRAL',
  }

  // Scrape + Gemini
  let articles = [], gemResult = null
  if (getCapabilities().serp) {
    try {
      const query = `current macroeconomic environment inflation federal reserve interest rates ${new Date().getFullYear()}`
      const r = await researchLayer('macro', ticker, query, mathData, { numArticles: 5, jinaLimit: 3 })
      articles = r.articles || []; gemResult = r.geminiResult
      sources.serp = r.sources.serp; sources.jina = r.sources.jina; sources.gemini = r.sources.gemini
    } catch (err) { console.warn(`[macro] scraper: ${err.message}`) }
  }

  let finalScore     = gemResult?.score != null ? clamp(mathScore * 0.40 + gemResult.score * 0.60) : mathScore
  let finalReasoning = gemResult?.reasoning || buildReasoning(vixLast, spread, tnxLast, sp20dRet, mathScore)

  return {
    id: LAYER_ID, score: +finalScore.toFixed(3),
    confidence: +Math.min(0.92, 0.6 + Math.abs(finalScore) * 0.35).toFixed(2),
    weight: 0.12, reasoning: finalReasoning,
    subSignals: [
      { name: 'VIX Level',        score: +vixScore.toFixed(2) },
      { name: 'VIX Trend',        score: +vixTrend.toFixed(2) },
      { name: 'Yield Curve',      score: +yieldScore.toFixed(2) },
      { name: 'S&P 500 Trend',    score: +spScore.toFixed(2) },
      { name: 'Rate Environment', score: +rateScore.toFixed(2) },
    ],
    sparkline,
    rawData: {
      vixLast: +vixLast.toFixed(2), tnxLast: +tnxLast.toFixed(2),
      yieldSpread: +spread.toFixed(2), sp20dRet: +(sp20dRet*100).toFixed(2),
      isHighVol, cpiLatest, mathScore: +mathScore.toFixed(3),
      articles: articles.map(a => ({ title: a.title, url: a.url, source: a.source, snippet: a.snippet, fullText: a.fullText })),
      geminiScore: gemResult?.score ?? null, geminiReasoning: gemResult?.reasoning ?? null,
      geminiKeyFactors: gemResult?.keyFactors || [], geminiRegime: gemResult?.regime ?? null,
      sources,
    },
    sources,
    _context: { isHighVol, regimeScore: finalScore, vixLevel: vixLast, regimeType: gemResult?.regime || (mathScore > 0.3 ? 'BULL' : mathScore < -0.3 ? 'BEAR' : 'NEUTRAL') },
  }
}

function buildReasoning(vix, spread, tnx, spRet, score) {
  const vixStr   = vix > 30 ? `VIX at ${vix.toFixed(0)} signals extreme fear.` : vix > 20 ? `VIX elevated at ${vix.toFixed(0)} — caution warranted.` : `VIX low at ${vix.toFixed(0)} — calm market.`
  const curveStr = spread < 0 ? `Inverted yield curve (${spread.toFixed(2)}%) — recession signal.` : `Yield spread: ${spread.toFixed(2)}% — ${spread > 1 ? 'healthy.' : 'relatively flat.'}`
  const spStr    = `S&P 500 20d: ${(spRet*100).toFixed(1)}%. ${spRet > 0.03 ? 'Risk-on.' : spRet < -0.03 ? 'Risk-off.' : 'Neutral.'}`
  return `${vixStr} ${curveStr} 10Y at ${tnx.toFixed(2)}%. ${spStr}`
}

module.exports = { analyze }

// backend/layers/momentum.js
// Stage 4A — Price Momentum & Entry Timing
// MATH: RSI (14), MACD, 20/50-day MA crossover, volume trend from YF OHLCV
// SCRAPE: "[Ticker] technical analysis chart setup support resistance [year]"
// GEMINI: "RSI is 78 (Overbought) and MACD is bullish. Is this a breakout or approaching resistance?"

const { fetchYFChart }                         = require('../utils/fetcher')
const { computeRSI, normalise, buildSparkline, clamp } = require('../utils/scorer')
const { researchLayer, getCapabilities }       = require('../utils/scraper')

const LAYER_ID = 'momentum'

async function analyze(ticker, context = {}) {
  const sources = { live: false, serp: false, jina: false, gemini: false }

  let ret5=0, ret20=0, ret50=0, rsi=50, macdH=0, ma20=0, ma50=0
  let retScore=0, rsiScore=0, macdScore=0, maScore=0, volScore=0
  let price=0, mathScore=0
  let sparkline = Array(16).fill(0)

  try {
    const candles = await fetchYFChart(ticker, '6mo', '1d')
    if (!candles || candles.length < 30) throw new Error('Insufficient price data')
    sources.live = true

    const closes  = candles.map(d => d.close).filter(Boolean)
    const volumes = candles.map(d => d.volume).filter(Boolean)
    price = closes.at(-1)

    ret5  = (closes.at(-1) - closes.at(-6))  / closes.at(-6)
    ret20 = (closes.at(-1) - closes.at(-21)) / closes.at(-21)
    ret50 = closes.length >= 51 ? (closes.at(-1) - closes.at(-51)) / closes.at(-51) : ret20 * 2

    retScore = normalise(ret20, -0.12, 0.12)
    rsi      = computeRSI(closes, 14)
    rsiScore = rsi > 80 ? -0.4 : rsi > 70 ? -0.15 : rsi < 20 ? 0.4 : rsi < 30 ? 0.15 : normalise(rsi, 30, 70)

    // Simple MACD (12/26 EMA crossover via price approximation)
    const ema12 = emaLast(closes, 12)
    const ema26 = emaLast(closes, 26)
    const macdLine   = ema12 - ema26
    const signalLine = macdLine * 0.85  // approximate
    macdH    = macdLine - signalLine
    macdScore = normalise(macdH / (price * 0.005 || 1), -1, 1)

    // MA crossover
    ma20 = closes.slice(-20).reduce((a,b) => a+b, 0) / 20
    ma50 = closes.length >= 50 ? closes.slice(-50).reduce((a,b) => a+b, 0) / 50 : ma20 * 0.98
    maScore = normalise((price - ma20) / ma20, -0.05, 0.05)

    // Volume trend
    const vol5avg  = volumes.slice(-5).reduce((a,b) => a+b, 0)  / 5
    const vol20avg = volumes.slice(-20).reduce((a,b) => a+b, 0) / 20
    const volRatio = vol20avg > 0 ? vol5avg / vol20avg : 1
    volScore = clamp((volRatio - 1) * (ret20 > 0 ? 1 : -1))

    mathScore = clamp(retScore*0.30 + rsiScore*0.25 + macdScore*0.20 + maScore*0.15 + volScore*0.10)
    sparkline = buildSparkline(closes)
  } catch (err) {
    console.warn(`[momentum] live fetch failed: ${err.message}`)
    mathScore = 0
  }

  const mathData = {
    ticker, price: +price.toFixed(2),
    rsi14: +rsi.toFixed(1), rsiSignal: rsi > 70 ? 'OVERBOUGHT' : rsi < 30 ? 'OVERSOLD' : 'NEUTRAL',
    macdHistogram: +macdH.toFixed(4), macdBullish: macdH > 0,
    ma20: +ma20.toFixed(2), ma50: +ma50.toFixed(2),
    priceVsMa20Pct: ma20 > 0 ? +((price-ma20)/ma20*100).toFixed(2) : 0,
    return5d: +(ret5*100).toFixed(2), return20d: +(ret20*100).toFixed(2), return50d: +(ret50*100).toFixed(2),
    mathBasedScore: +mathScore.toFixed(3),
    entryQuality: mathScore > 0.5 ? 'BREAKOUT' : mathScore > 0.2 ? 'PULLBACK_ENTRY' : mathScore < -0.3 ? 'OVERBOUGHT' : 'NEUTRAL',
  }

  let articles = [], gemResult = null
  if (getCapabilities().serp) {
    try {
      const query = `${ticker} stock technical analysis chart setup support resistance price target ${new Date().getFullYear()}`
      const r = await researchLayer('momentum', ticker, query, mathData, { numArticles: 5, jinaLimit: 3 })
      articles = r.articles || []; gemResult = r.geminiResult
      sources.serp = r.sources.serp; sources.jina = r.sources.jina; sources.gemini = r.sources.gemini
    } catch (err) { console.warn(`[momentum] scraper: ${err.message}`) }
  }

  const finalScore     = gemResult?.score != null ? clamp(mathScore * 0.45 + gemResult.score * 0.55) : mathScore
  const finalReasoning = gemResult?.reasoning || `${ticker} RSI: ${rsi.toFixed(0)} (${rsi > 70 ? 'OVERBOUGHT' : rsi < 30 ? 'OVERSOLD' : 'NEUTRAL'}). 20d return: ${(ret20*100).toFixed(1)}%. Price ${price > ma20 ? 'above' : 'below'} 20d MA.`

  return {
    id: LAYER_ID, score: +finalScore.toFixed(3),
    confidence: +Math.min(0.92, 0.55 + Math.abs(finalScore) * 0.35).toFixed(2),
    weight: 0.11, reasoning: finalReasoning,
    subSignals: [
      { name: 'RSI (14)',        score: +rsiScore.toFixed(2) },
      { name: 'MACD Signal',     score: +macdScore.toFixed(2) },
      { name: 'Price vs 20d MA', score: +maScore.toFixed(2) },
      { name: '20d Return',      score: +retScore.toFixed(2) },
      { name: 'Volume Trend',    score: +volScore.toFixed(2) },
    ],
    sparkline,
    rawData: {
      price: +price.toFixed(2), rsi: +rsi.toFixed(1), ma20: +ma20.toFixed(2), ma50: +ma50.toFixed(2),
      ret5d: +(ret5*100).toFixed(2), ret20d: +(ret20*100).toFixed(2), ret50d: +(ret50*100).toFixed(2),
      macdBullish: macdH > 0, mathScore: +mathScore.toFixed(3),
      articles: articles.map(a => ({ title: a.title, url: a.url, source: a.source, snippet: a.snippet, fullText: a.fullText })),
      geminiScore: gemResult?.score ?? null, geminiReasoning: gemResult?.reasoning ?? null,
      geminiEntryQuality: gemResult?.entryQuality ?? null, geminiKeyLevel: gemResult?.keyLevel ?? null,
      geminiKeyFactors: gemResult?.keyFactors || [],
      sources,
    },
    sources,
    _context: { momentumScore: finalScore, rsi },
  }
}

function emaLast(data, period) {
  const k = 2 / (period + 1)
  let e = data[0]
  for (let i = 1; i < data.length; i++) e = data[i] * k + e * (1 - k)
  return e
}

module.exports = { analyze }

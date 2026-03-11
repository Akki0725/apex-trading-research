// backend/layers/options.js
// Stage 4B — Options Flow & Smart Money
// MATH: Put/Call ratio (volume + OI), IV skew from YF options chain
// SCRAPE: "[Ticker] unusual options activity dark pool whale trades [year]"
// GEMINI: "PCR is 1.2 (Bearish) and IV is extremely high. Are institutions hedging or speculating on a squeeze?"

const { fetchYFOptions }                       = require('../utils/fetcher')
const { normalise, clamp } = require('../utils/scorer')
const { researchLayer, getCapabilities }       = require('../utils/scraper')

const LAYER_ID = 'options'

async function analyze(ticker, context = {}) {
  const sources = { live: false, serp: false, jina: false, gemini: false }
  const isHighVol = context.isHighVol || false

  let pcrScore=0, oiScore=0, ivScore=0, unusualCallsScore=0, unusualPutsScore=0
  let pcRatio=1, avgIV=0.3, mathScore=0
  let unusualCalls=0, unusualPuts=0

  try {
    const chain = await fetchYFOptions(ticker)
    if (!chain) throw new Error('No options data')
    sources.live = true

    const options = chain.options?.[0]
    if (!options) throw new Error('No near-term options')

    const calls = options.calls || [], puts = options.puts || []
    const callVol = calls.reduce((s,c) => s + (c.volume || 0), 0)
    const putVol  = puts.reduce((s,p)  => s + (p.volume || 0), 0)
    pcRatio       = callVol > 0 ? putVol / callVol : 1
    pcrScore      = normalise(pcRatio, 2.0, 0.4, true)

    const callOI = calls.reduce((s,c) => s + (c.openInterest || 0), 0)
    const putOI  = puts.reduce((s,p)  => s + (p.openInterest || 0), 0)
    oiScore = normalise(callOI > 0 ? putOI / callOI : 1, 1.8, 0.5, true)

    const allIVs = [...calls, ...puts].map(o => o.impliedVolatility).filter(Boolean)
    avgIV = allIVs.length > 0 ? allIVs.reduce((a,b) => a+b, 0) / allIVs.length : 0.3
    ivScore = normalise(avgIV, 1.5, 0.05, true)

    // Unusual activity: options with volume > 5x OI
    unusualCalls = calls.filter(c => c.openInterest > 10 && c.volume > c.openInterest * 5).length
    unusualPuts  = puts.filter(p  => p.openInterest > 10 && p.volume > p.openInterest * 5).length
    unusualCallsScore = clamp(unusualCalls / 3)
    unusualPutsScore  = clamp(-unusualPuts  / 3)

    const volW = isHighVol ? 0.16 : 0.12
    mathScore = clamp(
      pcrScore * (isHighVol ? 0.28 : 0.32) +
      oiScore  * (isHighVol ? 0.22 : 0.28) +
      ivScore  * (isHighVol ? 0.18 : 0.12) +
      (unusualCallsScore + unusualPutsScore) * (isHighVol ? 0.32 : 0.28)
    )
  } catch (err) {
    console.warn(`[options] live fetch failed: ${err.message}`)
    mathScore = 0
  }

  const mathData = {
    ticker, putCallRatioVolume: +pcRatio.toFixed(2),
    putCallSignal: pcRatio < 0.7 ? 'BULLISH_CALLS' : pcRatio > 1.5 ? 'BEARISH_PUTS' : 'NEUTRAL',
    avgImpliedVolatility: +(avgIV * 100).toFixed(1),
    ivHighVol: avgIV > 0.5, unusualCallStrikes: unusualCalls, unusualPutStrikes: unusualPuts,
    isHighVolatilityRegime: isHighVol, optionsWeightElevated: isHighVol,
    mathBasedScore: +mathScore.toFixed(3),
    institutionalBias: pcRatio < 0.7 ? 'LONG' : pcRatio > 1.5 ? 'HEDGING' : 'NEUTRAL',
  }

  let articles = [], gemResult = null
  if (getCapabilities().serp) {
    try {
      const query = `${ticker} stock unusual options activity dark pool whale trades institutional positioning ${new Date().getFullYear()}`
      const r = await researchLayer('options', ticker, query, mathData, { numArticles: 5, jinaLimit: 3 })
      articles = r.articles || []; gemResult = r.geminiResult
      sources.serp = r.sources.serp; sources.jina = r.sources.jina; sources.gemini = r.sources.gemini
    } catch (err) { console.warn(`[options] scraper: ${err.message}`) }
  }

  const finalScore     = gemResult?.score != null ? clamp(mathScore * 0.45 + gemResult.score * 0.55) : mathScore
  const finalReasoning = gemResult?.reasoning || `PCR: ${pcRatio.toFixed(2)} (${pcRatio < 0.7 ? 'heavy CALL buying' : pcRatio > 1.5 ? 'heavy PUT buying' : 'balanced'}). Avg IV: ${(avgIV*100).toFixed(0)}%. ${isHighVol ? '⚡ High-vol: options weight elevated.' : ''}${unusualCalls > 0 ? ` Unusual call activity on ${unusualCalls} strikes.` : ''}`

  return {
    id: LAYER_ID, score: +finalScore.toFixed(3),
    confidence: +Math.min(0.90, 0.45 + Math.abs(finalScore) * 0.4).toFixed(2),
    weight: isHighVol ? 0.16 : 0.10, reasoning: finalReasoning,
    subSignals: [
      { name: 'Put/Call Ratio',          score: +pcrScore.toFixed(2) },
      { name: 'OI Skew',                 score: +oiScore.toFixed(2) },
      { name: isHighVol ? 'IV Level ⚡' : 'IV Level', score: +ivScore.toFixed(2) },
      { name: 'Unusual Call Activity',   score: +unusualCallsScore.toFixed(2) },
      { name: 'Unusual Put Activity',    score: +unusualPutsScore.toFixed(2) },
    ],
    sparkline: Array(16).fill(0).map((_, i) => finalScore * (i / 15)),
    rawData: {
      putCallRatio: +pcRatio.toFixed(2), avgIV: +(avgIV*100).toFixed(1),
      unusualCalls, unusualPuts, isHighVol, mathScore: +mathScore.toFixed(3),
      articles: articles.map(a => ({ title: a.title, url: a.url, source: a.source, snippet: a.snippet, fullText: a.fullText })),
      geminiScore: gemResult?.score ?? null, geminiReasoning: gemResult?.reasoning ?? null,
      geminiInstitutionalBias: gemResult?.institutionalBias ?? null,
      geminiUnusualActivity: gemResult?.unusualActivity ?? null,
      geminiKeyFactors: gemResult?.keyFactors || [],
      sources,
    },
    sources,
    _context: { optionsScore: finalScore, isHighVol, putCallRatio: pcRatio },
  }
}

module.exports = { analyze }

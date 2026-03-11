// backend/layers/commodity.js
// Stage 2B — Supply Chain & Input Cost Analysis
// MATH: 20-day return of sector-specific commodity futures (e.g. CL=F, HG=F)
// SCRAPE: "[Ticker] supply chain input costs raw materials shortage [year]"
// GEMINI: "Copper futures up X% this month. Are these rising costs squeezing this company's margins?"

const { fetchYFChart }                         = require('../utils/fetcher')
const { normalise, clamp } = require('../utils/scorer')
const { researchLayer, getCapabilities }       = require('../utils/scraper')

const LAYER_ID = 'commodity'

const COMMODITY_PROFILE = {
  XLE: { tickers:['CL=F','NG=F'],     directions:[1,1],      label:'Oil & Gas',          primaryName:'Crude Oil' },
  XLK: { tickers:['HG=F','SI=F'],     directions:[-1,-1],    label:'Metals/Semis',       primaryName:'Copper' },
  XLY: { tickers:['CL=F','ALI=F'],    directions:[-1,-1],    label:'Consumer Disc',      primaryName:'Crude Oil' },
  XLF: { tickers:['GC=F','^TNX'],     directions:[0.3,1],    label:'Financials',         primaryName:'Gold' },
  XLV: { tickers:['HG=F'],            directions:[-0.5],     label:'Healthcare',         primaryName:'Copper' },
  XLP: { tickers:['CL=F','ZC=F'],     directions:[-1,-1],    label:'Staples',            primaryName:'Crude Oil' },
  XLC: { tickers:['HG=F'],            directions:[-0.3],     label:'Comm Svcs',          primaryName:'Copper' },
  XLB: { tickers:['HG=F','GC=F','CL=F'], directions:[1,1,0.5], label:'Materials',        primaryName:'Copper' },
  DEFAULT: { tickers:['CL=F','GC=F'], directions:[-0.5,0.2], label:'General',            primaryName:'Crude Oil' },
}

async function analyze(ticker, context = {}) {
  const sources = { live: false, serp: false, jina: false, gemini: false }
  const profile = COMMODITY_PROFILE[context.sectorETF || 'DEFAULT'] || COMMODITY_PROFILE.DEFAULT

  let commodityReturns = [], mathScore = 0
  const geoBoost = context.isGeopolitical ? 0.25 : 0

  try {
    const results = await Promise.all(profile.tickers.map(t => fetchYFChart(t, '1mo', '1d')))
    if (!results.some(r => r?.length > 1)) throw new Error('No commodity data')
    sources.live = true

    commodityReturns = results.map((data, i) => {
      if (!data || data.length < 2) return { ticker: profile.tickers[i], ret20d: 0, direction: profile.directions[i] }
      const closes = data.map(d => d.close).filter(Boolean)
      const ret = closes.length >= 21 ? (closes.at(-1) - closes.at(-21)) / closes.at(-21) : 0
      return { ticker: profile.tickers[i], ret20d: +ret.toFixed(4), direction: profile.directions[i], price: closes.at(-1) }
    })

    const weightedScore = commodityReturns.reduce((sum, c) => {
      return sum + normalise(c.ret20d, -0.10, 0.10) * c.direction
    }, 0) / commodityReturns.length

    mathScore = clamp(weightedScore + geoBoost * Math.sign(-weightedScore))
  } catch (err) {
    console.warn(`[commodity] live fetch failed: ${err.message}`)
    mathScore = 0
  }

  const mathData = {
    ticker, sectorProfile: profile.label, primaryCommodity: profile.primaryName,
    commodityTickers: profile.tickers,
    commodityReturns: commodityReturns.map(c => ({
      symbol: c.ticker, return20d: +(c.ret20d * 100).toFixed(2) + '%',
      impactDirection: c.direction > 0 ? 'POSITIVE' : 'NEGATIVE',
    })),
    geopoliticalRiskBoost: geoBoost > 0,
    mathBasedScore: +mathScore.toFixed(3),
    supplyChainPressure: mathScore < -0.3 ? 'HIGH' : mathScore < -0.1 ? 'MODERATE' : 'LOW',
    primaryCommodityReturn: commodityReturns[0] ? +(commodityReturns[0].ret20d * 100).toFixed(2) : null,
  }

  let articles = [], gemResult = null
  if (getCapabilities().serp) {
    try {
      const query = `${ticker} supply chain ${profile.primaryName} input costs raw materials ${new Date().getFullYear()}`
      const r = await researchLayer('commodity', ticker, query, mathData, { numArticles: 5, jinaLimit: 3 })
      articles = r.articles || []; gemResult = r.geminiResult
      sources.serp = r.sources.serp; sources.jina = r.sources.jina; sources.gemini = r.sources.gemini
    } catch (err) { console.warn(`[commodity] scraper: ${err.message}`) }
  }

  const finalScore     = gemResult?.score != null ? clamp(mathScore * 0.40 + gemResult.score * 0.60) : mathScore
  const finalReasoning = gemResult?.reasoning || `${profile.primaryName} 20d: ${commodityReturns[0] ? (commodityReturns[0].ret20d*100).toFixed(1)+'%' : 'N/A'}. Impact on ${ticker} margins: ${finalScore > 0 ? 'TAILWIND' : finalScore < 0 ? 'HEADWIND' : 'NEUTRAL'}.`

  return {
    id: LAYER_ID, score: +finalScore.toFixed(3),
    confidence: +Math.min(0.88, 0.45 + Math.abs(finalScore) * 0.4).toFixed(2),
    weight: context.isGeopolitical ? 0.16 : 0.10, reasoning: finalReasoning,
    subSignals: commodityReturns.slice(0, 4).map((c, i) => ({
      name: `${c.ticker} Impact`, score: +clamp(normalise(c.ret20d, -0.10, 0.10) * c.direction).toFixed(2)
    })),
    sparkline: Array(16).fill(0).map((_, i) => finalScore * (i / 15)),
    rawData: {
      profile: profile.label, primaryCommodity: profile.primaryName,
      commodityReturns: commodityReturns.map(c => ({ symbol: c.ticker, ret20dPct: +(c.ret20d*100).toFixed(2), price: c.price, direction: c.direction })),
      mathScore: +mathScore.toFixed(3), geoBoost,
      articles: articles.map(a => ({ title: a.title, url: a.url, source: a.source, snippet: a.snippet, fullText: a.fullText })),
      geminiScore: gemResult?.score ?? null, geminiReasoning: gemResult?.reasoning ?? null,
      geminiMarginImpact: gemResult?.marginImpact ?? null,
      geminiSupplyChainHealth: gemResult?.supplyChainHealth ?? null,
      geminiKeyFactors: gemResult?.keyFactors || [],
      sources,
    },
    sources,
    _context: { commodityScore: finalScore, supplyChainHealth: gemResult?.supplyChainHealth || 'UNKNOWN' },
  }
}

module.exports = { analyze }

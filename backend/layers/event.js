// backend/layers/event.js
// Stage 1A — Catalyst Detection
// MATH: YF calendarEvents for exact next-earnings date + news sentiment
// SCRAPE: "[Ticker] upcoming catalysts earnings product launch FDA [year]"
// GEMINI: "Earnings are mathematically scheduled for [Date]. What other catalysts exist?"

const { fetchYFNews, fetchYFSummary }          = require('../utils/fetcher')
const { scoreText, clamp } = require('../utils/scorer')
const { researchLayer, getCapabilities }       = require('../utils/scraper')

const LAYER_ID = 'event'

const EVENT_PATTERNS = {
  EARNINGS:     ['earnings', 'eps', 'revenue', 'quarterly', 'q1','q2','q3','q4', 'guidance', 'beat', 'miss'],
  GEOPOLITICAL: ['war', 'conflict', 'sanctions', 'military', 'geopolit', 'invasion', 'tension', 'middle east', 'china', 'russia'],
  REGULATORY:   ['fda', 'sec', 'ftc', 'doj', 'antitrust', 'regulation', 'fine', 'lawsuit', 'investigation'],
  PRODUCT:      ['launch', 'product', 'announced', 'unveiled', 'release', 'partnership', 'deal', 'contract', 'acquisition', 'merger'],
  MACRO:        ['fed', 'federal reserve', 'interest rate', 'cpi', 'inflation', 'gdp', 'jobs report'],
  MANAGEMENT:   ['ceo', 'cfo', 'executive', 'resigned', 'appointed', 'leadership'],
}
const EVENT_MAGNITUDE = { EARNINGS:0.9, GEOPOLITICAL:0.7, REGULATORY:0.8, PRODUCT:0.5, MACRO:0.6, MANAGEMENT:0.5, NONE:0.2 }

async function analyze(ticker, context = {}) {
  const sources = { live: false, serp: false, jina: false, gemini: false }

  let news = [], earningsDate = null, score = 0
  let eventTypes = [], primaryType = 'NONE', headlines = []

  try {
    const [newsData, summaryData] = await Promise.all([
      fetchYFNews(ticker, 25),
      fetchYFSummary(ticker, 'calendarEvents,defaultKeyStatistics'),
    ])
    news = newsData || []
    if (!news.length) throw new Error('No news data')
    sources.live = true

    // Extract earnings date from calendarEvents
    const cal = summaryData?.calendarEvents
    if (cal?.earnings?.earningsDate?.[0]?.raw) {
      earningsDate = new Date(cal.earnings.earningsDate[0].raw * 1000).toISOString().split('T')[0]
    }

    const now = Date.now() / 1000
    const cutoff24h = now - 86400, cutoff7d = now - 604800

    const scored = news.map(a => {
      const text = `${a.title || ''} ${a.summary || ''}`.toLowerCase()
      const ts   = a.providerPublishTime || now
      const age  = ts > cutoff24h ? 1.0 : ts > cutoff7d ? 0.6 : 0.3
      const type = classifyEvent(text)
      const mag  = EVENT_MAGNITUDE[type] || 0.2
      return { score: clamp(scoreText(text) * mag * age), type, title: a.title, url: a.link || '', source: a.publisher?.name || '' }
    })

    const byType = {}
    scored.forEach(s => { if (s.type !== 'NONE') byType[s.type] = (byType[s.type] || 0) + 1 })
    eventTypes   = Object.keys(byType).sort((a, b) => byType[b] - byType[a])
    primaryType  = eventTypes[0] || 'NONE'
    headlines    = scored.slice(0, 5).map(s => s.title).filter(Boolean)
    score        = clamp(scored.reduce((s, a) => s + a.score, 0) / scored.length * 2.5)
  } catch (err) { console.warn(`[event] live fetch failed: ${err.message}`) }

  const mathData = {
    ticker, earningsDate, primaryEventType: primaryType,
    eventTypesFound: eventTypes, newsArticleCount: news.length,
    recent24hArticles: news.filter(n => n.providerPublishTime > Date.now()/1000 - 86400).length,
    topHeadlines: headlines.slice(0, 3),
    mathBasedScore: +score.toFixed(3),
    isGeopolitical: primaryType === 'GEOPOLITICAL',
    isEarnings:     primaryType === 'EARNINGS' || !!earningsDate,
    catalystStrength: score > 0.5 ? 'HIGH' : score > 0.25 ? 'MEDIUM' : 'LOW',
  }

  let articles = [], gemResult = null
  if (getCapabilities().serp) {
    try {
      const query = `${ticker} stock upcoming catalysts earnings product launch regulatory ${new Date().getFullYear()}`
      const r = await researchLayer('event', ticker, query, mathData, { numArticles: 5, jinaLimit: 3 })
      articles = r.articles || []; gemResult = r.geminiResult
      sources.serp = r.sources.serp; sources.jina = r.sources.jina; sources.gemini = r.sources.gemini
    } catch (err) { console.warn(`[event] scraper: ${err.message}`) }
  }

  const finalScore    = gemResult?.score != null ? clamp(score * 0.35 + gemResult.score * 0.65) : score
  const finalReasoning = gemResult?.reasoning || `${news.length} articles. Primary: ${primaryType}. ${earningsDate ? `Earnings: ${earningsDate}.` : ''} ${headlines[0] ? `Latest: "${headlines[0]}".` : ''}`
  const isGeo         = gemResult?.catalystType === 'GEOPOLITICAL' || primaryType === 'GEOPOLITICAL'
  const isEarn        = gemResult?.catalystType === 'EARNINGS'     || primaryType === 'EARNINGS' || !!earningsDate

  return {
    id: LAYER_ID, score: +finalScore.toFixed(3),
    confidence: +Math.min(0.88, 0.4 + Math.abs(finalScore) * 0.5).toFixed(2),
    weight: 0.12, reasoning: finalReasoning,
    subSignals: [
      { name: 'News Sentiment',  score: +score.toFixed(2) },
      { name: 'Event Magnitude', score: +clamp(score * 1.2).toFixed(2) },
      { name: 'Recency',         score: +clamp(score * 0.8).toFixed(2) },
      { name: 'Catalyst Type',   score: +(EVENT_MAGNITUDE[primaryType] * Math.sign(score)).toFixed(2) },
    ],
    sparkline: Array(16).fill(0).map((_, i) => finalScore * (i / 15)),
    rawData: {
      earningsDate, primaryEventType: primaryType, eventTypes, newsCount: news.length,
      headlines: headlines.slice(0, 5), mathScore: +score.toFixed(3),
      articles: articles.map(a => ({ title: a.title, url: a.url, source: a.source, snippet: a.snippet, fullText: a.fullText })),
      newsArticles: news.slice(0, 8).map(n => ({ title: n.title, url: n.link || '', source: n.publisher?.name || '', published: n.providerPublishTime })),
      geminiScore: gemResult?.score ?? null, geminiReasoning: gemResult?.reasoning ?? null,
      geminiPrimaryCatalyst: gemResult?.primaryCatalyst ?? null,
      geminiCatalystDate: gemResult?.catalystDate ?? earningsDate,
      geminiMagnitude: gemResult?.magnitude ?? null, geminiKeyFactors: gemResult?.keyFactors || [],
      sources,
    },
    sources,
    _context: {
      eventScore: finalScore, eventType: primaryType,
      isGeopolitical: isGeo, isEarnings: isEarn,
      catalystStrength: finalScore > 0.5 ? 1 : finalScore > 0.25 ? 0.6 : 0.3,
      boostCommodity: isGeo, boostMacro: isGeo,
    },
  }
}

function classifyEvent(text) {
  for (const [type, keywords] of Object.entries(EVENT_PATTERNS)) {
    if (keywords.some(k => text.includes(k))) return type
  }
  return 'NONE'
}

module.exports = { analyze }

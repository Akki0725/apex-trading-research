// backend/layers/sentiment.js
// Stage 1B — Crowd Sentiment: Reddit volume math → SerpApi → Jina → Gemini
// Pipeline: MATH first, AI second — Gemini never invents numbers.

const { fetchYFNews, fetchReddit }             = require('../utils/fetcher')
const { scoreText, clamp } = require('../utils/scorer')
const { researchLayer, getCapabilities }       = require('../utils/scraper')

const LAYER_ID = 'sentiment'

const FOMO_SIGNALS = ['to the moon', 'squeeze', 'short squeeze', 'yolo', 'calls',
                      'loading up', 'all in', '🚀', '💎', '🙌', 'gamma squeeze']
const FEAR_SIGNALS = ['puts', 'short', 'going to zero', 'bubble', 'overvalued',
                      'crash', 'dump', '🌈🐻', 'bagholders', 'rekt', 'margin call']

async function analyze(ticker, context = {}) {
  const sources = { live: false, reddit: false, serp: false, jina: false, gemini: false }

  // ── Step 1: Hard Reddit + YF math ─────────────────────────────────────────
  let wsbPosts = [], stocksPosts = [], news = []
  try {
    ;[wsbPosts, stocksPosts, news] = await Promise.all([
      fetchReddit(ticker, 'wallstreetbets', 'new', 'week'),
      fetchReddit(ticker, 'stocks',         'new', 'week'),
      fetchYFNews(ticker, 15),
    ])
    sources.live   = wsbPosts.length > 0 || stocksPosts.length > 0 || !!news?.length
    sources.reddit = wsbPosts.length > 0 || stocksPosts.length > 0
  } catch (_) {}

  // Weighted WSB score
  let wsbScore = 0, wsbConfidence = 0
  if (wsbPosts.length > 0) {
    const scored = wsbPosts.map(p => {
      const text = `${p.title || ''} ${p.selftext || ''}`.toLowerCase()
      const fomo = FOMO_SIGNALS.filter(s => text.includes(s)).length
      const fear = FEAR_SIGNALS.filter(s => text.includes(s)).length
      const votes = Math.log1p(p.ups || 0) / Math.log(1000)
      return { score: clamp(scoreText(text) + fomo * 0.12 - fear * 0.12), weight: 0.3 + votes * 0.7 }
    })
    const totalW   = scored.reduce((s, p) => s + p.weight, 0)
    wsbScore       = totalW > 0 ? scored.reduce((s, p) => s + p.score * p.weight, 0) / totalW : 0
    wsbConfidence  = Math.min(0.9, wsbPosts.length / 15 * 0.8)
  }

  let stocksScore = stocksPosts.length > 0
    ? stocksPosts.map(p => scoreText(`${p.title} ${p.selftext || ''}`.toLowerCase()))
        .reduce((a, b) => a + b, 0) / stocksPosts.length
    : 0

  let newsSentScore = news?.length > 0
    ? news.map(n => scoreText(`${n.title || ''} ${n.summary || ''}`.toLowerCase()))
        .reduce((a, b) => a + b, 0) / news.length
    : 0

  const eventScore        = context.eventScore || 0
  const rawSentiment      = wsbScore * 0.45 + stocksScore * 0.25 + newsSentScore * 0.30
  const crowdGap          = rawSentiment - eventScore
  const divergencePenalty = Math.abs(crowdGap) > 0.5 ? 0.15 : 0
  const adjustedScore     = clamp(rawSentiment - divergencePenalty * Math.sign(rawSentiment))
  const totalPosts        = wsbPosts.length + stocksPosts.length
  const volumeSignal      = clamp(totalPosts / 30 - 0.3)
  const mathScore         = clamp(adjustedScore * 0.75 + volumeSignal * 0.25)

  // ── Step 2: Build math payload for Gemini (hard numbers only) ──────────────
  const mathData = {
    ticker,
    wsbPostCount:       wsbPosts.length,
    stocksPostCount:    stocksPosts.length,
    totalSocialPosts:   totalPosts,
    wsbWeightedScore:   +wsbScore.toFixed(3),
    stocksScore:        +stocksScore.toFixed(3),
    newsSentimentScore: +newsSentScore.toFixed(3),
    rawSentimentMath:   +rawSentiment.toFixed(3),
    crowdVsEventGap:    +crowdGap.toFixed(3),
    divergenceDetected: Math.abs(crowdGap) > 0.5,
    socialVolumeSignal: +volumeSignal.toFixed(3),
    mathBasedScore:     +mathScore.toFixed(3),
    fomoSignalsDetected: wsbPosts.reduce((n, p) => {
      const t = `${p.title} ${p.selftext || ''}`.toLowerCase()
      return n + FOMO_SIGNALS.filter(s => t.includes(s)).length
    }, 0),
    fearSignalsDetected: wsbPosts.reduce((n, p) => {
      const t = `${p.title} ${p.selftext || ''}`.toLowerCase()
      return n + FEAR_SIGNALS.filter(s => t.includes(s)).length
    }, 0),
    topWsbHeadlines:  wsbPosts.slice(0, 3).map(p => ({ title: p.title, ups: p.ups || 0 })),
    topNewsHeadlines: (news || []).slice(0, 3).map(n => ({ title: n.title, source: n.publisher?.name || 'YF' })),
  }

  // ── Step 3: SerpApi + Jina + Gemini ───────────────────────────────────────
  let articles = [], gemResult = null
  if (getCapabilities().serp) {
    try {
      const query    = `${ticker} stock retail investor sentiment reddit wsb discussion ${new Date().getFullYear()}`
      const research = await researchLayer('sentiment', ticker, query, mathData, { numArticles: 5, jinaLimit: 3 })
      articles            = research.articles       || []
      gemResult           = research.geminiResult
      sources.serp        = research.sources.serp
      sources.jina        = research.sources.jina
      sources.gemini      = research.sources.gemini
    } catch (err) { console.warn(`[sentiment] scraper: ${err.message}`) }
  }

  // ── Step 4: Blend — math is anchor, Gemini adds contextual refinement ──────
  let finalScore       = mathScore
  let finalConfidence  = clamp(0.35 + wsbConfidence * 0.5 + (sources.live ? 0.1 : 0))
  let finalReasoning   = buildMathReasoning(ticker, wsbPosts.length, stocksPosts.length, wsbScore, stocksScore, newsSentScore, crowdGap, mathScore)
  let geminiKeyFactors = []
  let crowdEmotion     = 'MIXED'

  if (gemResult?.score != null) {
    finalScore       = clamp(mathScore * 0.40 + gemResult.score * 0.60)
    finalConfidence  = clamp(finalConfidence * 0.5 + (gemResult.confidence || 0.5) * 0.5)
    finalReasoning   = gemResult.reasoning   || finalReasoning
    geminiKeyFactors = gemResult.keyFactors  || []
    crowdEmotion     = gemResult.crowdEmotion || 'MIXED'
  }

  return {
    id:         LAYER_ID,
    score:      +finalScore.toFixed(3),
    confidence: +finalConfidence.toFixed(2),
    weight:     0.11,
    reasoning:  finalReasoning,
    subSignals: [
      { name: 'WSB Sentiment',       score: +clamp(wsbScore).toFixed(2) },
      { name: '/r/stocks Sentiment', score: +clamp(stocksScore).toFixed(2) },
      { name: 'News Sentiment',      score: +clamp(newsSentScore).toFixed(2) },
      { name: 'Social Volume',       score: +volumeSignal.toFixed(2) },
    ],
    sparkline: Array(16).fill(0).map((_, i) => Math.sin(i * 0.6) * 0.2 + finalScore * (i / 15)),
    rawData: {
      // Hard math
      wsbPostCount: wsbPosts.length, stocksPostCount: stocksPosts.length, totalPosts,
      wsbWeightedScore: +wsbScore.toFixed(3), crowdGap: +crowdGap.toFixed(2),
      rawSentiment: +rawSentiment.toFixed(2), divergenceWarning: Math.abs(crowdGap) > 0.5,
      crowdEmotion, mathScore: +mathScore.toFixed(3),
      // Reddit posts for source cards
      redditPosts: [
        ...wsbPosts.slice(0, 5).map(p => ({
          title: p.title, subreddit: 'r/wallstreetbets', ups: p.ups || 0,
          numComments: p.num_comments || 0,
          sentiment: scoreText(`${p.title} ${p.selftext || ''}`.toLowerCase()),
          url: `https://reddit.com${p.permalink || ''}`,
          selftext: (p.selftext || '').slice(0, 300),
          created: p.created_utc ? new Date(p.created_utc * 1000).toISOString() : null,
        })),
        ...stocksPosts.slice(0, 3).map(p => ({
          title: p.title, subreddit: 'r/stocks', ups: p.ups || 0,
          numComments: p.num_comments || 0,
          sentiment: scoreText(`${p.title} ${p.selftext || ''}`.toLowerCase()),
          url: `https://reddit.com${p.permalink || ''}`,
          selftext: (p.selftext || '').slice(0, 300),
          created: p.created_utc ? new Date(p.created_utc * 1000).toISOString() : null,
        })),
      ],
      // Scraped web articles (SerpApi + Jina)
      articles: articles.map(a => ({ title: a.title, url: a.url, source: a.source, snippet: a.snippet, fullText: a.fullText, position: a.position })),
      // Gemini AI synthesis
      geminiScore: gemResult?.score ?? null, geminiReasoning: gemResult?.reasoning ?? null,
      geminiKeyFactors, geminiCrowdEmotion: gemResult?.crowdEmotion ?? null,
      geminiDivergence: gemResult?.divergence ?? null,
      geminiDivergenceNote: gemResult?.divergenceNote ?? null,
      sources,
    },
    sources,
    _context: { sentimentScore: finalScore, crowdDivergence: crowdGap },
  }
}

function buildMathReasoning(ticker, wsb, stocks, wsbS, stocksS, newsS, gap, score) {
  const gapStr = Math.abs(gap) > 0.4
    ? ` ⚠ CROWD DIVERGENCE: sentiment ${gap > 0 ? 'significantly more bullish' : 'more bearish'} than events warrant (gap: ${gap.toFixed(2)}).`
    : ' Crowd aligns with underlying events.'
  return `Found ${wsb} WSB posts and ${stocks} /r/stocks posts about ${ticker} this week. WSB: ${wsbS > 0.2 ? 'BULLISH' : wsbS < -0.2 ? 'BEARISH' : 'NEUTRAL'} (${wsbS.toFixed(2)}). News: ${newsS.toFixed(2)}.${gapStr}`
}

module.exports = { analyze }

// backend/layers/historical.js
// Stage 3 — Historical Analog & Pattern Memory
// MATH: cosine similarity search in SQLite vector DB against current 6-layer partial vector
// GEMINI: "The setup mathematically matches Oct 2023 with 92% similarity — write a concise validation summary."
// No SerpApi scraping — this layer only reads internal memory.

const { clamp } = require('../utils/scorer')
const { askGemini, GEMINI_SYSTEM }  = require('../utils/scraper')

const LAYER_ID = 'historical'

let _vectorStore = null
function getVectorStore() {
  if (!_vectorStore) _vectorStore = require('../memory/vectorStore')
  return _vectorStore
}

const STATIC_ANALOGS = [
  { date: '2021-03-12', similarity: 0.87, outcome: null, context: 'Post-stimulus rally setup' },
  { date: '2020-11-04', similarity: 0.79, outcome: null, context: 'Post-election tech surge' },
  { date: '2022-06-16', similarity: 0.72, outcome: null, context: 'Fed pivot expectations' },
]

async function analyze(ticker, context = {}) {
  const sources = { live: false, dbMatches: 0, gemini: false }

  const partialVector = [
    context.regimeScore      || 0,
    context.sectorScore      || 0,
    context.eventScore       || 0,
    context.sentimentScore   || 0,
    context.fundamentalScore || 0,
    context.commodityScore   || 0,
    0, 0, 0,
  ]

  try {
    const vectorStore = getVectorStore()
    const matches     = vectorStore.findSimilarByPartial(partialVector, ticker, 0.72, 5)
    sources.dbMatches = matches.length

    if (matches.length > 0) {
      sources.live = true
      const withOutcomes = matches.filter(m => m.outcome_pct != null)
      const winRate      = withOutcomes.length > 0
        ? Math.round(withOutcomes.filter(m => m.outcome_pct > 0).length / withOutcomes.length * 100)
        : null
      const avgOutcome   = withOutcomes.length > 0
        ? withOutcomes.reduce((s, m) => s + m.outcome_pct, 0) / withOutcomes.length
        : null

      let score = avgOutcome != null
        ? clamp(avgOutcome / 10)
        : clamp((partialVector.slice(0,6).reduce((a,b) => a+b, 0) / 6) * 0.75 + matches[0].similarity * 0.25 * Math.sign(partialVector[0]))

      const analogs = matches.map(m => ({
        date: m.timestamp.split('T')[0], ticker: m.ticker,
        similarity: +m.similarity.toFixed(2),
        outcome: m.outcome_pct != null ? `${m.outcome_pct > 0 ? '+' : ''}${m.outcome_pct.toFixed(1)}%` : null,
        thesis: m.thesis_label,
      }))

      // Gemini validation summary — grounded in DB math
      let geminiSummary = null
      const topMatch = matches[0]
      if (process.env.GEMINI_API_KEY && topMatch) {
        try {
          const mathPayload = {
            currentTicker: ticker, topMatchTicker: topMatch.ticker,
            topMatchDate: topMatch.timestamp.split('T')[0],
            similarityScore: +(topMatch.similarity * 100).toFixed(1),
            topMatchOutcome: topMatch.outcome_pct,
            topMatchThesis: topMatch.thesis_label,
            totalMatches: matches.length, winRate, avgOutcome,
            partialVector: partialVector.slice(0, 6).map(v => +v.toFixed(3)),
            vectorLabels: ['macro','sector','event','sentiment','fundamental','commodity'],
          }
          const prompt = `
CURRENT TICKER: ${ticker}
HISTORICAL PATTERN ANALYSIS — HARD DATABASE RESULTS:
${JSON.stringify(mathPayload, null, 2)}

TASK: Write a concise, factual validation summary (2-3 sentences) that tells the user:
1. Exactly how similar the current setup is to the historical match
2. What happened last time (if outcome data exists)
3. What this precedent implies for the current trade

Respond ONLY with this JSON:
{
  "summary": "<2-3 sentence factual summary using the exact numbers above>",
  "confidence": <float 0.0-1.0>,
  "precedentStrength": "<STRONG|MODERATE|WEAK>"
}`
          const r = await askGemini(GEMINI_SYSTEM.scorer, prompt, { temperature: 0.2, maxTokens: 400 })
          if (r?.parsed?.summary) {
            geminiSummary = r.parsed.summary
            sources.gemini = true
          }
        } catch (_) {}
      }

      return {
        id: LAYER_ID, score: +score.toFixed(3),
        confidence: +Math.min(0.92, 0.40 + matches[0].similarity * 0.55).toFixed(2),
        weight: 0.14,
        reasoning: geminiSummary || `Found ${matches.length} historical analogs. Best match: ${(matches[0].similarity*100).toFixed(0)}% similarity to ${matches[0].ticker} on ${matches[0].timestamp.split('T')[0]}. ${winRate != null ? `Win rate: ${winRate}%.` : ''} ${avgOutcome != null ? `Avg outcome: ${avgOutcome.toFixed(1)}%.` : ''}`,
        subSignals: [
          { name: 'Best Analog Match', score: +(matches[0].similarity * 2 - 1).toFixed(2) },
          { name: 'Win Rate',          score: winRate != null ? clamp((winRate - 50) / 45) : 0 },
          { name: 'Avg Outcome',       score: avgOutcome != null ? clamp(avgOutcome / 8) : 0 },
          { name: 'Pattern Count',     score: clamp(matches.length / 5) },
        ],
        sparkline: Array(16).fill(0).map((_, i) => score * (i / 15) + Math.sin(i * 0.8) * 0.15),
        rawData: {
          analogCount: matches.length, topSimilarity: matches[0].similarity,
          winRate, avgOutcome, analogs, mathScore: +score.toFixed(3),
          geminiSummary, articles: [],  // No web articles for historical layer
          sources,
        },
        sources,
        _context: { historicalScore: score, winRate, analogCount: matches.length },
      }
    }
  } catch (err) { console.warn(`[historical] DB search failed: ${err.message}`) }

  // No DB matches — neutral score, no synthetic data
  const partialDir = partialVector.slice(0, 6).reduce((a, b) => a + b, 0) / 6

  return {
    id: LAYER_ID, score: 0, confidence: 0.42, weight: 0.14,
    reasoning: `No close historical analogs in APEX memory for ${ticker}. Run more analyses to build the pattern database.`,
    subSignals: [
      { name: 'Pattern Similarity', score: 0 },
      { name: 'Directional Match',  score: +clamp(partialDir).toFixed(2) },
      { name: 'Historical Win Rate', score: 0 },
      { name: 'Analog Confidence',  score: 0 },
    ],
    sparkline: Array(16).fill(0),
    rawData: { analogCount: 0, topSimilarity: null, winRate: null, analogs: [], articles: [], sources },
    sources,
    _context: { historicalScore: 0, winRate: null, analogCount: 0 },
  }
}

module.exports = { analyze }

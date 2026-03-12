// backend/utils/scraper.js
// ─────────────────────────────────────────────────────────────────────────────
// Universal Research Utility
//   1. searchSerpApi()   — Google search results via SerpApi
//   2. fetchJinaReader() — Clean article text extraction via Jina AI Reader
//   3. fetchArticlesForQuery() — Combine both into enriched article objects
//   4. askGemini()       — Ground a prompt in hard data using Gemini 2.5 Flash
// ─────────────────────────────────────────────────────────────────────────────

const axios = require('axios')

const SERP_KEY   = process.env.SERP_API_KEY    || ''
const GEMINI_KEY = process.env.GEMINI_API_KEY  || ''

const SERP_BASE   = 'https://serpapi.com/search.json'
const JINA_BASE   = 'https://r.jina.ai/'
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

const FETCH_TIMEOUT = parseInt(process.env.FETCH_TIMEOUT || '10000')

// ── Capability flags ──────────────────────────────────────────────────────────
const hasSerpKey   = () => !!SERP_KEY   && SERP_KEY   !== 'your_serp_key_here'
const hasGeminiKey = () => !!GEMINI_KEY && GEMINI_KEY !== 'your_gemini_key_here'

// ─────────────────────────────────────────────────────────────────────────────
// 1. SerpApi — Google search results
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Search Google via SerpApi. Returns up to `numResults` organic results.
 *
 * @param {string} query     - Search query
 * @param {number} numResults - Max results (1-10)
 * @returns {Array<{title, url, snippet, source, position}>}
 */
async function searchSerpApi(query, numResults = 5) {
  if (!hasSerpKey()) {
    console.warn('[scraper] SERP_API_KEY not set — skipping web search')
    return []
  }

  try {
    const res = await axios.get(SERP_BASE, {
      timeout: FETCH_TIMEOUT,
      params: {
        q:       query,
        api_key: SERP_KEY,
        engine:  'google',
        num:     Math.min(numResults, 10),
        hl:      'en',
        gl:      'us',
        // Recent results only (past week for financial data)
        tbs:     'qdr:w',
      },
    })

    const organic = res.data?.organic_results || []
    return organic.slice(0, numResults).map((r, i) => ({
      title:    r.title    || '',
      url:      r.link     || '',
      snippet:  r.snippet  || '',
      source:   r.source   || extractDomain(r.link),
      position: i + 1,
    }))
  } catch (err) {
    const status = err?.response?.status
    if (status === 401) console.error('[scraper] SerpApi: Invalid API key')
    else if (status === 429) console.warn('[scraper] SerpApi: Rate limit hit')
    else console.warn(`[scraper] SerpApi error (${status || err.code}): ${query.slice(0, 50)}`)
    return []
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Jina AI Reader — Clean article text extraction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract clean, readable text from any URL using Jina AI Reader.
 * Returns a truncated excerpt suitable for an LLM prompt.
 *
 * No API key required — Jina Reader is free at r.jina.ai
 *
 * @param {string} url        - Article URL to extract
 * @param {number} maxChars   - Max characters to return (default 2500)
 * @returns {string|null}     - Clean article text or null on failure
 */
async function fetchJinaReader(url, maxChars = 2500) {
  if (!url || !url.startsWith('http')) return null

  // Block paywalled / login-required domains that Jina can't access
  const BLOCKED = ['wsj.com', 'ft.com', 'bloomberg.com', 'barrons.com', 'seekingalpha.com']
  if (BLOCKED.some(d => url.includes(d))) {
    console.warn(`[scraper] Jina: skipping paywalled domain — ${extractDomain(url)}`)
    return null
  }

  try {
    const jinaUrl = `${JINA_BASE}${url}`
    const res = await axios.get(jinaUrl, {
      timeout: FETCH_TIMEOUT,
      headers: {
        'Accept': 'text/plain',
        'X-Return-Format': 'markdown',
        'X-Timeout': '8',
      },
    })

    const text = typeof res.data === 'string' ? res.data : ''
    if (!text || text.length < 100) return null

    // Strip markdown headers, excess whitespace, and navigation boilerplate
    const cleaned = text
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')   // unwrap links
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^\s*(nav|menu|header|footer|cookie|subscribe)[^\n]*/gim, '')
      .trim()

    return cleaned.slice(0, maxChars) + (cleaned.length > maxChars ? '...' : '')
  } catch (err) {
    console.warn(`[scraper] Jina failed for ${url.slice(0, 60)}: ${err.code || err.message}`)
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Combined Research Helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Search SerpApi and enrich top results with Jina-extracted full text.
 * Returns articles array with: title, url, source, snippet, fullText (or null)
 *
 * @param {string} query
 * @param {number} numArticles  - How many to search (will attempt Jina on all)
 * @param {number} jinaLimit    - Max articles to run Jina on (slower, rate-limited)
 * @returns {Array<ArticleObject>}
 */
async function fetchArticlesForQuery(query, numArticles = 5, jinaLimit = 3) {
  const results = await searchSerpApi(query, numArticles)
  if (results.length === 0) return []

  // Fetch full text for the top `jinaLimit` articles in parallel
  const toFetch = results.slice(0, jinaLimit)
  const fullTexts = await Promise.all(toFetch.map(r => fetchJinaReader(r.url)))

  return results.map((r, i) => ({
    ...r,
    fullText: i < jinaLimit ? fullTexts[i] : null,
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Gemini AI — Grounded analysis
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Call Gemini 2.5 Flash with a structured prompt.
 * The prompt MUST include hard numerical data first, then ask Gemini to
 * synthesize it with the provided context — this prevents hallucination.
 *
 * @param {string} systemInstruction  - Role & output format instructions
 * @param {string} userPrompt         - The grounded prompt with hard data + articles
 * @param {object} options
 * @param {number} options.temperature - 0.0-1.0 (default 0.3 — factual/deterministic)
 * @param {number} options.maxTokens   - Max output tokens (default 800)
 * @returns {{ text: string, raw: object }|null}
 */
async function askGemini(systemInstruction, userPrompt, options = {}) {
  if (!hasGeminiKey()) {
    console.warn('[scraper] GEMINI_API_KEY not set — skipping AI synthesis')
    return null
  }

  const { temperature = 0.3, maxTokens = 800 } = options

  const body = {
    system_instruction: {
      parts: [{ text: systemInstruction }],
    },
    contents: [{
      role: 'user',
      parts: [{ text: userPrompt }],
    }],
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
      responseMimeType: 'application/json',
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ],
  }

  try {
    const res = await axios.post(
      `${GEMINI_BASE}?key=${GEMINI_KEY}`,
      body,
      {
        timeout: FETCH_TIMEOUT * 2,
        headers: { 'Content-Type': 'application/json' },
      }
    )

    const candidate = res.data?.candidates?.[0]
    const rawText   = candidate?.content?.parts?.[0]?.text || ''

    if (!rawText) {
      console.warn('[scraper] Gemini returned empty response')
      return null
    }

    // Try to parse as JSON (since we requested JSON response)
    try {
      const parsed = JSON.parse(rawText)
      return { text: rawText, parsed, raw: res.data }
    } catch {
      // Gemini sometimes wraps JSON in backticks
      const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/)
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1])
          return { text: jsonMatch[1], parsed, raw: res.data }
        } catch { /* fall through */ }
      }
      return { text: rawText, parsed: null, raw: res.data }
    }
  } catch (err) {
    const status = err?.response?.status
    if (status === 400) console.error('[scraper] Gemini 400 Bad Request — check prompt format')
    else if (status === 403) console.error('[scraper] Gemini 403 — check GEMINI_API_KEY')
    else if (status === 429) console.warn('[scraper] Gemini rate limited')
    else console.warn(`[scraper] Gemini error (${status || err.code})`)
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt builders — one per layer. Each enforces the "math first" principle:
//   hard data is passed numerically, context articles added AFTER, so Gemini
//   cannot invent facts — it can only interpret what the math already shows.
// ─────────────────────────────────────────────────────────────────────────────

const GEMINI_SYSTEM = {
  scorer: `You are APEX, an institutional-grade quantitative equity research system.
Your role is to synthesize HARD NUMERICAL DATA with qualitative news context.
CRITICAL RULES:
  - Never invent or guess numerical values. Only use values explicitly provided.
  - If news context contradicts the math, flag it as a divergence.
  - Always respond with valid JSON matching the requested schema exactly.
  - Scores must be between -1.0 (maximally bearish) and +1.0 (maximally bullish).
  - Be concise and precise. No filler phrases.`,
}

/**
 * Build a layer-specific Gemini prompt.
 * Each prompt leads with the hard math, then appends the scraped article excerpts.
 */
function buildLayerPrompt(layerType, mathData, articles, ticker) {
  const articleContext = articles.length > 0
    ? articles
        .filter(a => a.fullText || a.snippet)
        .map((a, i) =>
          `--- ARTICLE ${i + 1}: "${a.title}" (${a.source})\nURL: ${a.url}\n${a.fullText || a.snippet}`
        )
        .join('\n\n')
    : 'No scraped articles available — score based on hard data only.'

  const prompts = {
    sentiment: `
TICKER: ${ticker}
LAYER: News Sentiment & Crowd Behavior

HARD MATHEMATICAL DATA (use these exact numbers):
${JSON.stringify(mathData, null, 2)}

SCRAPED ARTICLES & FORUM POSTS:
${articleContext}

TASK:
1. Analyze whether the crowd emotion (Reddit volume, upvote counts) is supported by the news narratives.
2. Detect FOMO vs panic patterns in the social data.
3. Flag any divergence between crowd sentiment and the actual news content.
4. Score overall sentiment from -1.0 to +1.0.

Respond ONLY with this JSON (no other text):
{
  "score": <float -1.0 to 1.0>,
  "confidence": <float 0.0 to 1.0>,
  "direction": "<BULLISH|BEARISH|NEUTRAL>",
  "crowdEmotion": "<FOMO|PANIC|EUPHORIA|RATIONAL|MIXED>",
  "divergence": <true|false>,
  "divergenceNote": "<string or null>",
  "reasoning": "<2-3 sentence synthesis grounded in the numbers above>",
  "keyFactors": ["<factor 1>", "<factor 2>", "<factor 3>"]
}`,

    macro: `
TICKER: ${ticker} (context for macro environment assessment)
LAYER: Macroeconomic Risk Regime

HARD MATHEMATICAL DATA:
${JSON.stringify(mathData, null, 2)}

SCRAPED MACRO NEWS:
${articleContext}

TASK:
1. Evaluate systemic market risk based on the yield, VIX, and SP500 trend numbers.
2. Check if the scraped news narrative aligns with or contradicts the hard data.
3. Score the macro environment: +1.0 = ideal risk-on, -1.0 = severe risk-off.

Respond ONLY with this JSON:
{
  "score": <float -1.0 to 1.0>,
  "confidence": <float 0.0 to 1.0>,
  "regime": "<BULL|BEAR|NEUTRAL|HIGH_VOL|RISK_OFF>",
  "keyRisk": "<primary risk identified>",
  "reasoning": "<2-3 sentence synthesis>",
  "keyFactors": ["<factor 1>", "<factor 2>", "<factor 3>"]
}`,

    sector: `
TICKER: ${ticker}
LAYER: Sector Rotation & Institutional Flows

HARD MATHEMATICAL DATA:
${JSON.stringify(mathData, null, 2)}

SCRAPED SECTOR ANALYSIS:
${articleContext}

TASK:
1. Evaluate if the mathematically computed ETF relative strength is confirmed by analyst commentary.
2. Determine if institutional capital flows support or contradict the price trend.
3. Score the sector tailwind: +1.0 = strong rotation IN, -1.0 = strong rotation OUT.

Respond ONLY with this JSON:
{
  "score": <float -1.0 to 1.0>,
  "confidence": <float 0.0 to 1.0>,
  "flowDirection": "<INTO|OUT|NEUTRAL>",
  "institutionalConfirmation": <true|false>,
  "reasoning": "<2-3 sentence synthesis>",
  "keyFactors": ["<factor 1>", "<factor 2>", "<factor 3>"]
}`,

    event: `
TICKER: ${ticker}
LAYER: Catalyst & Event Detection

HARD MATHEMATICAL DATA:
${JSON.stringify(mathData, null, 2)}

SCRAPED EVENT NEWS:
${articleContext}

TASK:
1. Identify the primary near-term catalyst (earnings date, product launch, regulatory decision).
2. Assess the magnitude and market impact potential of each event identified.
3. Score the event layer: +1.0 = high-probability positive catalyst, -1.0 = high-probability negative.

Respond ONLY with this JSON:
{
  "score": <float -1.0 to 1.0>,
  "confidence": <float 0.0 to 1.0>,
  "primaryCatalyst": "<string describing the main event>",
  "catalystDate": "<YYYY-MM-DD or 'Unknown'>",
  "catalystType": "<EARNINGS|PRODUCT|REGULATORY|GEOPOLITICAL|MACRO|MANAGEMENT|NONE>",
  "magnitude": "<HIGH|MEDIUM|LOW>",
  "reasoning": "<2-3 sentence synthesis>",
  "keyFactors": ["<factor 1>", "<factor 2>", "<factor 3>"]
}`,

    fundamental: `
TICKER: ${ticker}
LAYER: Fundamental Health & Earnings Quality

HARD MATHEMATICAL DATA:
${JSON.stringify(mathData, null, 2)}

SCRAPED EARNINGS ANALYSIS:
${articleContext}

TASK:
1. Assess whether management's forward guidance actually supports the EPS and P/E numbers.
2. Evaluate quality of earnings: is revenue growth organic or one-time?
3. Score fundamental health: +1.0 = exceptional quality, -1.0 = deteriorating fundamentals.

Respond ONLY with this JSON:
{
  "score": <float -1.0 to 1.0>,
  "confidence": <float 0.0 to 1.0>,
  "earningsQuality": "<HIGH|MEDIUM|LOW>",
  "guidanceTone": "<BULLISH|NEUTRAL|CAUTIOUS|LOWERED>",
  "reasoning": "<2-3 sentence synthesis>",
  "keyFactors": ["<factor 1>", "<factor 2>", "<factor 3>"]
}`,

    commodity: `
TICKER: ${ticker}
LAYER: Supply Chain & Input Cost Analysis

HARD MATHEMATICAL DATA:
${JSON.stringify(mathData, null, 2)}

SCRAPED SUPPLY CHAIN NEWS:
${articleContext}

TASK:
1. Determine if the commodity price moves are actively squeezing THIS company's margins.
2. Check if supply chain disruptions are near-term (inventory shock) or structural.
3. Score: +1.0 = declining costs = margin expansion, -1.0 = rising costs = margin compression.

Respond ONLY with this JSON:
{
  "score": <float -1.0 to 1.0>,
  "confidence": <float 0.0 to 1.0>,
  "marginImpact": "<EXPAND|COMPRESS|NEUTRAL>",
  "supplyChainHealth": "<STRONG|MODERATE|DISRUPTED|CRITICAL>",
  "reasoning": "<2-3 sentence synthesis>",
  "keyFactors": ["<factor 1>", "<factor 2>", "<factor 3>"]
}`,

    momentum: `
TICKER: ${ticker}
LAYER: Technical Momentum & Entry Timing

HARD MATHEMATICAL DATA:
${JSON.stringify(mathData, null, 2)}

SCRAPED TECHNICAL ANALYSIS:
${articleContext}

TASK:
1. Confirm or challenge the mathematical RSI/MACD readings with analyst price targets and chart patterns.
2. Identify key support/resistance levels mentioned in the articles.
3. Score entry timing: +1.0 = ideal breakout entry, -1.0 = worst possible entry (overbought/distribution).

Respond ONLY with this JSON:
{
  "score": <float -1.0 to 1.0>,
  "confidence": <float 0.0 to 1.0>,
  "entryQuality": "<BREAKOUT|PULLBACK_ENTRY|NEUTRAL|OVERBOUGHT|BREAKDOWN>",
  "keyLevel": "<key support or resistance price mentioned>",
  "reasoning": "<2-3 sentence synthesis>",
  "keyFactors": ["<factor 1>", "<factor 2>", "<factor 3>"]
}`,

    options: `
TICKER: ${ticker}
LAYER: Options Flow & Smart Money Positioning

HARD MATHEMATICAL DATA:
${JSON.stringify(mathData, null, 2)}

SCRAPED OPTIONS / DARK POOL NEWS:
${articleContext}

TASK:
1. Determine if the Put/Call ratio and IV level indicate institutional hedging vs directional speculation.
2. Check if the unusual options activity described aligns with the mathematical PCR.
3. Score: +1.0 = smart money positioned long, -1.0 = smart money heavily hedged/short.

Respond ONLY with this JSON:
{
  "score": <float -1.0 to 1.0>,
  "confidence": <float 0.0 to 1.0>,
  "institutionalBias": "<LONG|SHORT|HEDGING|NEUTRAL>",
  "unusualActivity": <true|false>,
  "reasoning": "<2-3 sentence synthesis>",
  "keyFactors": ["<factor 1>", "<factor 2>", "<factor 3>"]
}`,
  }

  return prompts[layerType] || prompts.sentiment
}

// ─────────────────────────────────────────────────────────────────────────────
// Master analysis function — the full pipeline for one layer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run the full research pipeline for a single layer:
 *   SerpApi search → Jina extraction → Gemini synthesis
 *
 * @param {string} layerType  - One of the 9 layer IDs
 * @param {string} ticker     - Stock ticker
 * @param {string} query      - SerpApi search query
 * @param {object} mathData   - Hard numerical data to ground Gemini's response
 * @param {object} options    - { numArticles, jinaLimit, temperature }
 *
 * @returns {{
 *   geminiResult: object|null,   // Parsed Gemini JSON response
 *   articles: Array,             // Enriched articles with fullText
 *   sources: { serp, jina, gemini }
 * }}
 */
async function researchLayer(layerType, ticker, query, mathData, options = {}) {
  const { numArticles = 5, jinaLimit = 3, temperature = 0.3 } = options
  const sources = { serp: false, jina: false, gemini: false }

  // Step 1: Web search
  const articles = await fetchArticlesForQuery(query, numArticles, jinaLimit)
  if (articles.length > 0) sources.serp = true
  if (articles.some(a => a.fullText)) sources.jina = true

  // Step 2: Gemini synthesis (math data + article context)
  let geminiResult = null
  if (hasGeminiKey()) {
    const prompt = buildLayerPrompt(layerType, mathData, articles, ticker)
    const response = await askGemini(GEMINI_SYSTEM.scorer, prompt, { temperature })
    if (response?.parsed) {
      geminiResult = response.parsed
      sources.gemini = true
    }
  }

  return { geminiResult, articles, sources }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function extractDomain(url) {
  if (!url) return 'unknown'
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return 'unknown'
  }
}

/** Check if any AI research keys are configured */
function getCapabilities() {
  return {
    serp:   hasSerpKey(),
    gemini: hasGeminiKey(),
    jina:   true,  // always available (no key needed)
  }
}

module.exports = {
  searchSerpApi,
  fetchJinaReader,
  fetchArticlesForQuery,
  askGemini,
  researchLayer,
  buildLayerPrompt,
  getCapabilities,
  GEMINI_SYSTEM,
}

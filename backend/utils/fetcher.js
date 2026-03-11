// backend/utils/fetcher.js
// Resilient HTTP client with timeout, retry, and rate-limit protection

const axios = require('axios')

const TIMEOUT = parseInt(process.env.FETCH_TIMEOUT || '6000')

const YF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Origin': 'https://finance.yahoo.com',
  'Referer': 'https://finance.yahoo.com/',
}

const REDDIT_HEADERS = {
  'User-Agent': 'APEX-Research-Bot/1.0 (research tool; not commercial)',
  'Accept': 'application/json',
}

/**
 * Fetch with timeout — returns null on any error
 */
async function safeFetch(url, options = {}) {
  try {
    const res = await axios.get(url, {
      timeout: TIMEOUT,
      headers: options.headers || YF_HEADERS,
      ...options,
    })
    return res.data
  } catch (err) {
    const status = err?.response?.status
    const label  = options._label || url.slice(0, 60)
    if (status === 429) console.warn(`[fetcher] Rate limited: ${label}`)
    else if (status === 404) console.warn(`[fetcher] Not found: ${label}`)
    else console.warn(`[fetcher] Failed (${status || err.code}): ${label}`)
    return null
  }
}

/**
 * Yahoo Finance chart data — returns OHLCV array or null
 */
async function fetchYFChart(ticker, range = '3mo', interval = '1d') {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${range}&interval=${interval}&includePrePost=false`
  const data = await safeFetch(url, { _label: `YF chart ${ticker}` })
  if (!data?.chart?.result?.[0]) return null

  const result  = data.chart.result[0]
  const ts      = result.timestamp || []
  const quote   = result.indicators?.quote?.[0] || {}
  const closes  = quote.close || []
  const volumes = quote.volume || []
  const highs   = quote.high || []
  const lows    = quote.low || []

  return ts.map((t, i) => ({
    date:   new Date(t * 1000).toISOString().split('T')[0],
    close:  closes[i],
    high:   highs[i],
    low:    lows[i],
    volume: volumes[i],
  })).filter(d => d.close != null)
}

/**
 * Yahoo Finance quote summary — returns modules object or null
 * modules: financialData, defaultKeyStatistics, earnings, earningsTrend,
 *          recommendationTrend, price, summaryDetail
 */
async function fetchYFSummary(ticker, modules = 'financialData,defaultKeyStatistics,earnings,earningsTrend,recommendationTrend,price') {
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=${modules}`
  const data = await safeFetch(url, { _label: `YF summary ${ticker}` })
  return data?.quoteSummary?.result?.[0] || null
}

/**
 * Yahoo Finance news search
 */
async function fetchYFNews(ticker, count = 20) {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(ticker)}&newsCount=${count}&enableFuzzyQuery=false&quotesCount=0`
  const data = await safeFetch(url, { _label: `YF news ${ticker}` })
  return data?.news || []
}

/**
 * Yahoo Finance options chain
 */
async function fetchYFOptions(ticker) {
  const url = `https://query2.finance.yahoo.com/v7/finance/options/${encodeURIComponent(ticker)}`
  const data = await safeFetch(url, { _label: `YF options ${ticker}` })
  return data?.optionChain?.result?.[0] || null
}

/**
 * Reddit search — returns array of posts
 */
async function fetchReddit(query, subreddit = 'wallstreetbets', sort = 'new', time = 'week') {
  const url = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(query)}&sort=${sort}&t=${time}&limit=25&restrict_sr=1`
  const data = await safeFetch(url, { headers: REDDIT_HEADERS, _label: `Reddit ${subreddit} ${query}` })
  return data?.data?.children?.map(c => c.data) || []
}

/**
 * FRED API — returns latest observations or null
 */
async function fetchFRED(seriesId) {
  const key = process.env.FRED_API_KEY
  if (!key || key === 'your_fred_key_here') return null
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${key}&file_type=json&sort_order=desc&limit=10`
  const data = await safeFetch(url, { _label: `FRED ${seriesId}` })
  return data?.observations || null
}

module.exports = { safeFetch, fetchYFChart, fetchYFSummary, fetchYFNews, fetchYFOptions, fetchReddit, fetchFRED }

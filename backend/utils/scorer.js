// backend/utils/scorer.js
// Shared utilities: signal scoring, sparkline generation

/**
 * Clamp a value between -1 and +1
 */
function clamp(v) { return Math.max(-1, Math.min(1, v)) }

/**
 * Normalise a raw value to -1..+1 given expected min/max
 */
function normalise(value, min, max, invert = false) {
  if (max === min) return 0
  const n = (value - min) / (max - min) * 2 - 1
  return clamp(invert ? -n : n)
}

/**
 * Simple keyword sentiment scorer for text
 * Returns -1..+1
 */
const BULL_WORDS = ['bullish', 'buy', 'long', 'calls', 'upside', 'beat', 'upgrade', 'growth', 'strong',
  'record', 'rally', 'breakout', 'moon', 'squeeze', 'outperform', 'raised guidance', 'exceed', 'surge',
  'positive', 'momentum', 'earnings beat', 'revenue growth', 'expansion']

const BEAR_WORDS = ['bearish', 'sell', 'short', 'puts', 'downside', 'miss', 'downgrade', 'weak', 'crash',
  'dump', 'decline', 'underperform', 'cut guidance', 'recession', 'debt', 'loss', 'layoffs', 'warning',
  'negative', 'decelerate', 'disappointed', 'concern', 'risk', 'headwind', 'regulatory']

function scoreText(text) {
  if (!text) return 0
  const lower = text.toLowerCase()
  let score = 0
  BULL_WORDS.forEach(w => { if (lower.includes(w)) score += 1 })
  BEAR_WORDS.forEach(w => { if (lower.includes(w)) score -= 1 })
  // Normalise: assume max 8 hits either way
  return clamp(score / 8)
}

/**
 * Compute RSI from close prices array
 */
function computeRSI(closes, period = 14) {
  if (closes.length < period + 1) return 50
  let gains = 0, losses = 0
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff > 0) gains += diff
    else losses += Math.abs(diff)
  }
  if (losses === 0) return 100
  const rs = (gains / period) / (losses / period)
  return 100 - 100 / (1 + rs)
}

/**
 * Compute momentum score from price array
 * Returns -1..+1 (combines 20d return + RSI + volume trend)
 */
function computeMomentumScore(candles) {
  if (!candles || candles.length < 21) return 0
  const closes  = candles.map(c => c.close).filter(Boolean)
  const volumes = candles.map(c => c.volume).filter(Boolean)

  // 20-day price return
  const ret20 = (closes[closes.length - 1] - closes[closes.length - 21]) / closes[closes.length - 21]

  // RSI score: rsi=70 → +0.7, rsi=30 → -0.7
  const rsi = computeRSI(closes)
  const rsiScore = (rsi - 50) / 50  // -1 to +1

  // Volume trend (recent 5d avg vs 20d avg)
  const vol5  = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5
  const vol20 = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20
  const volRatio = vol20 > 0 ? vol5 / vol20 : 1
  // Positive vol trend if price is rising
  const volScore = clamp((volRatio - 1) * (ret20 > 0 ? 1 : -1))

  return clamp(ret20 * 5 * 0.45 + rsiScore * 0.35 + volScore * 0.20)
}

/**
 * Build a 16-point sparkline array from actual candle closes
 */
function buildSparkline(closes) {
  if (!closes || closes.length === 0) return Array(16).fill(0)
  const src = closes.slice(-16)
  if (src.length < 2) return Array(16).fill(0)
  const min = Math.min(...src), max = Math.max(...src)
  const range = max - min || 1
  return src.map(v => ((v - min) / range) * 2 - 1)
}

/**
 * Build sub-signals array from key-value pairs
 */
function buildSubSignals(pairs) {
  return pairs.map(([name, score]) => ({ name, score: clamp(+score.toFixed(2)) }))
}

module.exports = { clamp, normalise, scoreText, computeRSI, computeMomentumScore, buildSparkline, buildSubSignals }

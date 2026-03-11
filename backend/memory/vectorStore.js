// backend/memory/vectorStore.js
// Long-term pattern memory: stores 9-layer "DNA snapshots" and finds similar historical setups

const Database = require('better-sqlite3')
const path     = require('path')
const fs       = require('fs')

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/apex_memory.db')

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH)
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

// ── Open DB and create schema ─────────────────────────────────
const db = new Database(DB_PATH)

db.exec(`
  CREATE TABLE IF NOT EXISTS snapshots (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker            TEXT NOT NULL,
    timestamp         TEXT NOT NULL,
    signals_json      TEXT NOT NULL,
    vector_json       TEXT NOT NULL,
    thesis_type       TEXT,
    thesis_label      TEXT,
    convergence_score REAL,
    outcome_pct       REAL DEFAULT NULL,
    outcome_days      INTEGER DEFAULT NULL,
    outcome_timestamp TEXT DEFAULT NULL,
    UNIQUE(ticker, timestamp)
  );

  CREATE INDEX IF NOT EXISTS idx_snapshots_ticker     ON snapshots(ticker);
  CREATE INDEX IF NOT EXISTS idx_snapshots_timestamp  ON snapshots(timestamp DESC);
  CREATE INDEX IF NOT EXISTS idx_snapshots_thesis     ON snapshots(thesis_type);
`)

// ── Vector math ───────────────────────────────────────────────

/**
 * Cosine similarity between two numeric arrays
 */
function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0
  let dot = 0, magA = 0, magB = 0
  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB)
  return denom === 0 ? 0 : dot / denom
}

/**
 * Build normalised 9-dim vector from signals array
 * Order: [macro, sector, event, sentiment, fundamental, commodity, historical, momentum, options]
 */
const VECTOR_ORDER = ['macro', 'sector', 'event', 'sentiment', 'fundamental', 'commodity', 'historical', 'momentum', 'options']

function buildVector(signals) {
  return VECTOR_ORDER.map(id => {
    const sig = signals.find(s => s.id === id)
    return sig?.score ?? 0
  })
}

// ── Prepared statements ───────────────────────────────────────
const stmtInsert = db.prepare(`
  INSERT OR IGNORE INTO snapshots
    (ticker, timestamp, signals_json, vector_json, thesis_type, thesis_label, convergence_score)
  VALUES
    (@ticker, @timestamp, @signals_json, @vector_json, @thesis_type, @thesis_label, @convergence_score)
`)

const stmtGetAll  = db.prepare(`SELECT * FROM snapshots ORDER BY timestamp DESC`)
const stmtByTicker = db.prepare(`SELECT * FROM snapshots WHERE ticker = ? ORDER BY timestamp DESC LIMIT 50`)
const stmtUpdateOutcome = db.prepare(`
  UPDATE snapshots SET outcome_pct = @pct, outcome_days = @days, outcome_timestamp = @ts
  WHERE id = @id
`)
const stmtGetWithoutOutcome = db.prepare(`
  SELECT * FROM snapshots WHERE outcome_pct IS NULL AND timestamp < datetime('now', '-5 days')
  ORDER BY timestamp DESC LIMIT 20
`)

// ── Public API ────────────────────────────────────────────────

/**
 * Save a pipeline analysis result as a snapshot
 */
function saveSnapshot(ticker, pipelineResult) {
  try {
    const vector  = buildVector(pipelineResult.signals || [])
    const timestamp = new Date().toISOString()

    stmtInsert.run({
      ticker:           ticker.toUpperCase(),
      timestamp,
      signals_json:     JSON.stringify(pipelineResult.signals || []),
      vector_json:      JSON.stringify(vector),
      thesis_type:      pipelineResult.thesis?.type       || null,
      thesis_label:     pipelineResult.thesis?.label      || null,
      convergence_score: pipelineResult.thesis?.overallScore ?? null,
    })
    return { saved: true, timestamp }
  } catch (err) {
    console.error('[vectorStore] saveSnapshot error:', err.message)
    return { saved: false, error: err.message }
  }
}

/**
 * Find snapshots similar to a given vector
 * @param {number[]} queryVector  — 9-dim vector to compare against
 * @param {string}   excludeTicker — optionally exclude current ticker (self-comparison)
 * @param {number}   minSimilarity — threshold (0-1), default 0.82
 * @param {number}   limit         — max results
 */
function findSimilarPatterns(queryVector, excludeTicker = null, minSimilarity = 0.82, limit = 8) {
  const all = stmtGetAll.all()
  const results = []

  for (const row of all) {
    if (excludeTicker && row.ticker === excludeTicker.toUpperCase()) continue
    try {
      const storedVec = JSON.parse(row.vector_json)
      const sim       = cosineSimilarity(queryVector, storedVec)
      if (sim >= minSimilarity) {
        results.push({ ...row, similarity: sim, signals: undefined })
      }
    } catch (_) {}
  }

  return results
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)
}

/**
 * Find similar patterns using a PARTIAL vector (first N dimensions)
 * Used in historical layer before momentum/options are computed
 */
function findSimilarByPartial(partialVector, excludeTicker = null, minSimilarity = 0.72, limit = 5) {
  const n   = partialVector.length
  const all = stmtGetAll.all()
  const results = []

  for (const row of all) {
    try {
      const storedVec = JSON.parse(row.vector_json).slice(0, n)
      const sim       = cosineSimilarity(partialVector, storedVec)
      if (sim >= minSimilarity) {
        results.push({ ...row, similarity: sim })
      }
    } catch (_) {}
  }

  return results
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)
}

/**
 * Get all snapshots (for Memory page)
 */
function getSnapshots(ticker = null) {
  const rows = ticker ? stmtByTicker.all(ticker.toUpperCase()) : stmtGetAll.all().slice(0, 200)
  return rows.map(row => ({
    ...row,
    signals: JSON.parse(row.signals_json || '[]'),
    vector:  JSON.parse(row.vector_json  || '[]'),
    signals_json: undefined,
    vector_json:  undefined,
  }))
}

/**
 * Get all snapshots that need outcome updates (older than 5 days, no outcome yet)
 */
function getSnapshotsNeedingOutcome() {
  return stmtGetWithoutOutcome.all()
}

/**
 * Update the outcome for a snapshot after observing actual price movement
 */
function updateOutcome(id, outcomePct, days = 5) {
  stmtUpdateOutcome.run({ id, pct: outcomePct, days, ts: new Date().toISOString() })
}

/**
 * Get stats about the memory DB
 */
function getMemoryStats() {
  const total    = db.prepare('SELECT COUNT(*) as n FROM snapshots').get()
  const withOut  = db.prepare('SELECT COUNT(*) as n FROM snapshots WHERE outcome_pct IS NOT NULL').get()
  const winners  = db.prepare('SELECT COUNT(*) as n FROM snapshots WHERE outcome_pct > 0').get()
  const tickers  = db.prepare('SELECT COUNT(DISTINCT ticker) as n FROM snapshots').get()
  const avgSim   = db.prepare('SELECT AVG(convergence_score) as avg FROM snapshots WHERE convergence_score IS NOT NULL').get()
  return {
    totalSnapshots:     total.n,
    withOutcomes:       withOut.n,
    winnerSnapshots:    winners.n,
    uniqueTickers:      tickers.n,
    winRate:            withOut.n > 0 ? (winners.n / withOut.n * 100).toFixed(1) : null,
    avgConvergenceScore: avgSim.avg?.toFixed(3) ?? null,
    dbPath: DB_PATH,
  }
}

/**
 * Check if a new analysis matches any HIGH-SIMILARITY pattern in memory
 * Returns match alerts for notification
 */
function checkForAlerts(ticker, queryVector, minSimilarity = 0.88) {
  const matches = findSimilarPatterns(queryVector, null, minSimilarity, 3)
  return matches
    .filter(m => m.outcome_pct != null)  // only matches where we know the outcome
    .map(m => ({
      matchId:       m.id,
      matchTicker:   m.ticker,
      matchDate:     m.timestamp.split('T')[0],
      similarity:    m.similarity,
      thesisLabel:   m.thesis_label,
      outcome:       m.outcome_pct,
      outcomeDays:   m.outcome_days,
      message: `I've seen this movie before — on ${m.timestamp.split('T')[0]}, ${m.ticker} had a ${(m.similarity*100).toFixed(0)}% DNA match to current conditions and ${m.outcome_pct > 0 ? 'rose' : 'fell'} ${Math.abs(m.outcome_pct).toFixed(1)}% over ${m.outcome_days} days.`,
    }))
}

module.exports = {
  saveSnapshot, findSimilarPatterns, findSimilarByPartial,
  getSnapshots, getSnapshotsNeedingOutcome, updateOutcome,
  getMemoryStats, checkForAlerts, buildVector, VECTOR_ORDER,
}

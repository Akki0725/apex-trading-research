// backend/server.js
// APEX Backend Brain — Express API Server

require('dotenv').config()
const express    = require('express')
const cors       = require('cors')
const { runPipeline }  = require('./pipeline')
const { scanUniverse, getUniverse } = require('./discovery/scanner')
const {
  saveSnapshot, getSnapshots, getMemoryStats,
  checkForAlerts, findSimilarPatterns, buildVector, updateOutcome,
} = require('./memory/vectorStore')

const app  = express()
const PORT = process.env.PORT || 3001

app.use(cors({ origin: '*' }))
app.use(express.json())

// ── Request logger ────────────────────────────────────────────
app.use((req, _, next) => {
  console.log(`[${new Date().toISOString().slice(11,19)}] ${req.method} ${req.path}`)
  next()
})

// ─────────────────────────────────────────────────────────────
// Health & Status
// ─────────────────────────────────────────────────────────────
app.get('/api/health', (_, res) => {
  res.json({
    status: 'ok',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
})

app.get('/api/status', (_, res) => {
  const memStats = getMemoryStats()
  res.json({
    status: 'ok',
    memory: memStats,
    universe: getUniverse().length,
    timestamp: new Date().toISOString(),
  })
})

// ─────────────────────────────────────────────────────────────
// Analysis Pipeline
// ─────────────────────────────────────────────────────────────

/** POST /api/analyze/:ticker — Run full 9-layer pipeline */
app.post('/api/analyze/:ticker', async (req, res) => {
  const ticker = req.params.ticker.toUpperCase().trim()

  if (!ticker || ticker.length > 10) {
    return res.status(400).json({ error: 'Invalid ticker' })
  }

  try {
    const result = await runPipeline(ticker)

    // Auto-save to memory
    const saved = saveSnapshot(ticker, result)

    // Check for high-similarity alerts
    const alerts = checkForAlerts(ticker, result.vector, 0.88)

    res.json({ ...result, memoryAlerts: alerts, snapshotSaved: saved.saved })
  } catch (err) {
    console.error(`[analyze] ${ticker} error:`, err.message)
    res.status(500).json({ error: err.message, ticker })
  }
})

/** GET /api/analyze/:ticker — Same as POST but via GET for convenience */
app.get('/api/analyze/:ticker', async (req, res) => {
  const ticker = req.params.ticker.toUpperCase().trim()
  try {
    const result = await runPipeline(ticker)
    const saved  = saveSnapshot(ticker, result)
    const alerts = checkForAlerts(ticker, result.vector, 0.88)
    res.json({ ...result, memoryAlerts: alerts, snapshotSaved: saved.saved })
  } catch (err) {
    res.status(500).json({ error: err.message, ticker })
  }
})

// ─────────────────────────────────────────────────────────────
// Discovery Scanner
// ─────────────────────────────────────────────────────────────

/** GET /api/discover?limit=10 — Scan universe for top setups */
app.get('/api/discover', async (req, res) => {
  const limit = Math.min(50, parseInt(req.query.limit || '12'))
  try {
    const results = await scanUniverse(limit)
    res.json(results)
  } catch (err) {
    console.error('[discover] error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

/** GET /api/discover/universe — List all tickers in the scan universe */
app.get('/api/discover/universe', (_, res) => {
  res.json({ universe: getUniverse() })
})

// ─────────────────────────────────────────────────────────────
// Memory / Pattern Recognition
// ─────────────────────────────────────────────────────────────

/** GET /api/memory/stats — Database statistics */
app.get('/api/memory/stats', (_, res) => {
  res.json(getMemoryStats())
})

/** GET /api/memory/snapshots?ticker=NVDA — All snapshots, optionally filtered */
app.get('/api/memory/snapshots', (req, res) => {
  const ticker = req.query.ticker?.toUpperCase() || null
  res.json(getSnapshots(ticker))
})

/** GET /api/memory/matches/:ticker?threshold=0.82 — Find similar historical patterns */
app.get('/api/memory/matches/:ticker', async (req, res) => {
  const ticker = req.params.ticker.toUpperCase()
  const threshold = parseFloat(req.query.threshold || '0.82')
  const limit     = parseInt(req.query.limit || '8')

  try {
    const result = await runPipeline(ticker)
    const matches = findSimilarPatterns(result.vector, ticker, threshold, limit)
    const alerts  = checkForAlerts(ticker, result.vector, 0.88)

    res.json({
      ticker,
      currentVector: result.vector,
      matches,
      alerts,
      matchCount: matches.length,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/** PATCH /api/memory/outcome/:id — Record the actual price outcome for a snapshot */
app.patch('/api/memory/outcome/:id', (req, res) => {
  const { id } = req.params
  const { outcomePct, days } = req.body
  if (outcomePct == null) return res.status(400).json({ error: 'outcomePct required' })
  updateOutcome(parseInt(id), parseFloat(outcomePct), days || 5)
  res.json({ updated: true, id, outcomePct, days })
})

// ─────────────────────────────────────────────────────────────
// Error handler
// ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[server] Unhandled:', err.message)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════╗
  ║     APEX Backend Brain v2.0 — Running     ║
  ║     Port: ${PORT}  |  DB: Memory Active      ║
  ╚═══════════════════════════════════════════╝
  `)
})

module.exports = app

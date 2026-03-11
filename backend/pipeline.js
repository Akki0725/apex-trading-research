// backend/pipeline.js
// Sequential 5-Stage Filtration Pipeline
// Each stage influences the next via a shared context object

const macroLayer     = require('./layers/macro')
const sectorLayer    = require('./layers/sector')
const eventLayer     = require('./layers/event')
const sentimentLayer = require('./layers/sentiment')
const fundLayer      = require('./layers/fundamental')
const cmdtyLayer     = require('./layers/commodity')
const histLayer      = require('./layers/historical')
const momtLayer      = require('./layers/momentum')
const optnLayer      = require('./layers/options')
const { buildVector } = require('./memory/vectorStore')

// ── Layer meta (for frontend colour/icon mapping) ─────────────
const LAYER_META = {
  macro:       { name: 'Macroeconomic',        shortName: 'MACRO', icon: '🌐', color: '#ff55aa' },
  sector:      { name: 'Sector & Industry',    shortName: 'SECT',  icon: '🏭', color: '#8855ff' },
  event:       { name: 'Event Detection',      shortName: 'EVENT', icon: '⚠️', color: '#ffcc00' },
  sentiment:   { name: 'News Sentiment',       shortName: 'SENT',  icon: '📰', color: '#ff6644' },
  fundamental: { name: 'Fundamental Earnings', shortName: 'FUND',  icon: '📊', color: '#4466ff' },
  commodity:   { name: 'Commodity & Supply Chain', shortName: 'CMDTY', icon: '⛽', color: '#ffaa00' },
  historical:  { name: 'Historical Analog',    shortName: 'HIST',  icon: '📈', color: '#00ff88' },
  momentum:    { name: 'Price Momentum',       shortName: 'MOMT',  icon: '⚡', color: '#00d4ff' },
  options:     { name: 'Options Market',       shortName: 'OPTN',  icon: '🎯', color: '#55ffcc' },
}

function enrichSignal(signal) {
  const meta = LAYER_META[signal.id] || {}
  return { ...meta, ...signal }
}

/**
 * Run the full 9-layer sequential pipeline for a ticker
 *
 * Stage 0: Macro + Sector  → determines regime, volatility, sector rotation
 * Stage 1: Event + Sentiment → detects catalyst, crowd reaction
 * Stage 2: Fundamental + Commodity → validates catalyst with hard data
 *          (commodity weight boosted if geopolitical event detected in Stage 1)
 * Stage 3: Historical → pattern match using Stages 0-2 vector
 * Stage 4: Momentum + Options → execution timing
 *          (options weight boosted if high-vol detected in Stage 0)
 *
 * @returns {object} Full pipeline result compatible with frontend ConvergenceTree
 */
async function runPipeline(ticker) {
  console.log(`[pipeline] Starting ${ticker}...`)
  const t0 = Date.now()

  // ── Stage 0: Big Picture ──────────────────────────────────────
  console.log(`[pipeline] Stage 0: Macro + Sector`)
  const [macroResult, sectorResult] = await Promise.all([
    macroLayer.analyze(ticker),
    sectorLayer.analyze(ticker),
  ])

  // Build Stage 0 context for downstream layers
  const ctx0 = {
    ...macroResult._context,
    ...sectorResult._context,
    isHighVol: macroResult._context?.isHighVol || false,
    regimeScore:   macroResult.score,
    sectorScore:   sectorResult.score,
    sectorETF:     sectorResult._context?.sectorETF,
    volatilityLevel: macroResult.rawData?.vixLast || 18,
  }

  // ── Stage 1: Catalyst Detection ───────────────────────────────
  console.log(`[pipeline] Stage 1: Event + Sentiment`)
  const [eventResult, sentimentResult] = await Promise.all([
    eventLayer.analyze(ticker, ctx0),
    sentimentLayer.analyze(ticker, { ...ctx0, eventScore: 0 }),  // first pass
  ])

  const ctx1 = {
    ...ctx0,
    ...eventResult._context,
    ...sentimentResult._context,
    eventScore:        eventResult.score,
    sentimentScore:    sentimentResult.score,
    isGeopolitical:    eventResult._context?.isGeopolitical || false,
    isEarnings:        eventResult._context?.isEarnings || false,
    catalystStrength:  eventResult._context?.catalystStrength || 0,
    boostCommodity:    eventResult._context?.boostCommodity || false,
    boostMacro:        eventResult._context?.boostMacro || false,
  }

  // Re-run sentiment with event context for crowd-vs-reality comparison
  const sentimentRefined = await sentimentLayer.analyze(ticker, ctx1).catch(() => sentimentResult)

  // ── Stage 2: Reality Check ────────────────────────────────────
  console.log(`[pipeline] Stage 2: Fundamental + Commodity`)
  const [fundResult, cmdtyResult] = await Promise.all([
    fundLayer.analyze(ticker, ctx1),
    cmdtyLayer.analyze(ticker, ctx1),
  ])

  const ctx2 = {
    ...ctx1,
    ...fundResult._context,
    ...cmdtyResult._context,
    fundamentalScore: fundResult.score,
    commodityScore:   cmdtyResult.score,
  }

  // ── Stage 3: Historical Analog ────────────────────────────────
  console.log(`[pipeline] Stage 3: Historical Analog`)
  const histResult = await histLayer.analyze(ticker, ctx2)

  const ctx3 = {
    ...ctx2,
    ...histResult._context,
    historicalScore:  histResult.score,
    winRate:          histResult._context?.winRate,
  }

  // ── Stage 4: Execution Timing ──────────────────────────────────
  console.log(`[pipeline] Stage 4: Momentum + Options`)
  const [momtResult, optnResult] = await Promise.all([
    momtLayer.analyze(ticker, ctx3),
    optnLayer.analyze(ticker, ctx3),
  ])

  const ctx4 = {
    ...ctx3,
    momentumScore: momtResult.score,
    optionsScore:  optnResult.score,
  }

  // ── Assemble final signals array ──────────────────────────────
  const signals = [
    enrichSignal(macroResult),
    enrichSignal(sectorResult),
    enrichSignal(eventResult),
    enrichSignal(sentimentRefined),
    enrichSignal(fundResult),
    enrichSignal(cmdtyResult),
    enrichSignal(histResult),
    enrichSignal(momtResult),
    enrichSignal(optnResult),
  ].map(s => {
    const { _context, ...rest } = s
    return rest
  })

  // ── Build 9-dim memory vector ─────────────────────────────────
  const vector = buildVector(signals)

  // ── Dynamic weight adjustment (pipeline-level) ────────────────
  // Apply dynamic weights based on context
  if (ctx1.isGeopolitical) {
    const cmdty = signals.find(s => s.id === 'commodity')
    const macro = signals.find(s => s.id === 'macro')
    if (cmdty) cmdty.weight = 0.16
    if (macro) macro.weight = 0.15
  }
  if (ctx0.isHighVol) {
    const optn = signals.find(s => s.id === 'options')
    if (optn) optn.weight = 0.16
  }
  if (ctx1.isEarnings) {
    const fund = signals.find(s => s.id === 'fundamental')
    if (fund) fund.weight = 0.18
  }

  const elapsed = Date.now() - t0
  console.log(`[pipeline] ${ticker} complete in ${elapsed}ms`)

  return {
    ticker,
    timestamp: new Date().toISOString(),
    elapsed,
    signals,
    vector,
    context: {
      regimeType:       ctx0.regimeType,
      isHighVol:        ctx0.isHighVol,
      isGeopolitical:   ctx1.isGeopolitical,
      isEarnings:       ctx1.isEarnings,
      catalystStrength: ctx1.catalystStrength,
      sectorETF:        ctx0.sectorETF,
      winRate:          ctx3.winRate,
    },
    dataSources: signals.reduce((acc, s) => {
      acc[s.id] = s.sources?.live ? 'live' : 'math'
      return acc
    }, {}),
  }
}

module.exports = { runPipeline }

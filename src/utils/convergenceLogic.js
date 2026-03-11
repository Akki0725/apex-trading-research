// ─────────────────────────────────────────────────────────────
// APEX Convergence Logic Controller
// Processes 9 signal layers through a 5-stage filtration pipeline
// ─────────────────────────────────────────────────────────────

/** Deterministic sparkline (16 pts, 24h trend) for a layer score */
export function generateSparkline(currentScore, layerId) {
  const seed = (layerId || 'x').split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const pts = []
  for (let i = 0; i < 16; i++) {
    const wave1 = Math.sin(seed * 0.11 + i * 1.31) * 0.18
    const wave2 = Math.sin(seed * 0.07 + i * 0.53) * 0.10
    const trend  = (i / 15) * currentScore * 0.85
    pts.push(Math.max(-1, Math.min(1, trend + wave1 + wave2)))
  }
  pts[pts.length - 1] = currentScore
  return pts
}

/** Build an SVG path string from sparkline data points */
export function sparklinePath(data, width = 80, height = 28) {
  if (!data || data.length < 2) return ''
  return data.map((d, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((d + 1) / 2) * height
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
  }).join(' ')
}

/** Classify macro+sector into regime type */
function getRegimeType(macroScore, sectorScore) {
  if (macroScore > 0.3 && sectorScore > 0.2)  return 'BULL_REGIME'
  if (macroScore < -0.3 && sectorScore < -0.2) return 'BEAR_REGIME'
  if (macroScore < -0.2 && sectorScore > 0.3)  return 'DEFENSIVE_ROTATION'
  if (macroScore > 0.2 && sectorScore < -0.2)  return 'MACRO_HEADWIND'
  if (Math.abs(macroScore) < 0.2 && Math.abs(sectorScore) < 0.2) return 'NEUTRAL'
  return macroScore > sectorScore ? 'MACRO_LED' : 'SECTOR_LED'
}

/** Detect crowd overreaction/underreaction */
function getCrowdReaction(eventScore, sentScore) {
  const gap = sentScore - eventScore
  if (gap > 0.5)  return 'CROWD_OVERREACTING_BULLISH'
  if (gap < -0.5) return 'CROWD_OVERREACTING_BEARISH'
  if (gap > 0.25) return 'MILD_OVER_ENTHUSIASM'
  if (gap < -0.25) return 'CROWD_UNDERREACTING'
  return 'ALIGNED'
}

/** Detect specific conflict pairs */
function detectConflicts(scores) {
  const conflicts = []

  // Classic trap: crowd loves it, smart money is buying puts
  if (scores.sentiment > 0.45 && scores.options < -0.35) {
    conflicts.push({
      id: 'SENT_OPT_DIV',
      label: 'Sentiment / Smart Money Divergence',
      description: 'Crowd sentiment is hyper-bullish while options flow shows heavy put buying — institutional hedging signal.',
      severity: 'HIGH',
      nodes: ['sent', 'optn'],
    })
  }

  // EPS looks good but supply chain is squeezing margins
  if (scores.fundamental > 0.35 && scores.commodity < -0.4) {
    conflicts.push({
      id: 'MARGIN_SQUEEZE',
      label: 'Earnings vs Margin Squeeze',
      description: 'Strong earnings beat met with surging input costs. Forward margins may compress despite headline EPS beat.',
      severity: 'MEDIUM',
      nodes: ['fund', 'cmdty'],
    })
  }

  // Macro says run but sector is rotating out
  if (scores.macro > 0.3 && scores.sector < -0.3) {
    conflicts.push({
      id: 'MACRO_SECT_DIV',
      label: 'Macro Bull / Sector Rotation Out',
      description: 'Macro environment is supportive but capital is rotating out of this sector. Relative underperformance likely.',
      severity: 'MEDIUM',
      nodes: ['macro', 'sect'],
    })
  }

  // Price ripping but no historical precedent
  if (scores.momentum > 0.5 && scores.historical < -0.3) {
    conflicts.push({
      id: 'HIST_MOMT_DIV',
      label: 'Momentum vs Historical Pattern',
      description: 'Strong price momentum lacks historical analog support. Similar setups resolved bearishly in prior cycles.',
      severity: 'MEDIUM',
      nodes: ['momt', 'hist'],
    })
  }

  return conflicts
}

/** Thesis label and 2-sentence summary from stage results */
function buildThesis(stages, regimeType, crowdReaction, isHighVol, conflicts) {
  const { regimeScore, catalystScore, evidenceScore, analogScore, timingScore } = stages
  const scores = [regimeScore, catalystScore, evidenceScore, analogScore, timingScore]
  const bullish = scores.filter(s => s > 0.12).length
  const bearish = scores.filter(s => s < -0.12).length
  const overallScore = regimeScore * 0.15 + catalystScore * 0.2 + evidenceScore * 0.25 + analogScore * 0.2 + timingScore * 0.2
  const hasHighConflict = conflicts.some(c => c.severity === 'HIGH')

  let type, label, summary, probability

  if (hasHighConflict && Math.abs(overallScore) < 0.3) {
    type = 'NO_CONVERGENCE'
    label = 'Avoid — No Convergence'
    probability = 0.50
    summary = `Critical signal conflict detected between layers prevents a clean thesis. Sentiment and smart money are pointing in opposite directions, creating an asymmetric risk trap with no defined edge.`

  } else if (bearish >= 4) {
    type = 'HIGH_CONVICTION_SHORT'
    label = 'High Conviction Short'
    probability = 0.5 + Math.abs(overallScore) * 0.42
    summary = `All five stages of the filtration pipeline converge bearishly. Macro regime, weak fundamentals, and bearish historical analogs align with deteriorating price momentum — a multi-factor setup favoring a disciplined short position.`

  } else if (bullish >= 4 && timingScore > 0.15 && regimeType === 'BULL_REGIME') {
    type = 'MOMENTUM_BREAKOUT'
    label = 'Momentum Breakout'
    probability = 0.5 + overallScore * 0.42
    summary = `All five stages confirm a high-conviction long thesis. The bullish macro regime provides the wind at the back while strong momentum and smart-money options positioning suggest institutional accumulation is already underway.`

  } else if (bullish >= 4 && timingScore > 0.1 && (regimeType === 'BEAR_REGIME' || regimeType === 'MACRO_HEADWIND')) {
    type = 'CONTRARIAN_LONG'
    label = 'Contrarian Long'
    probability = 0.5 + overallScore * 0.38
    summary = `Fundamentals and catalyst layers are strongly bullish despite a challenging macro backdrop — a textbook contrarian setup. Historical analogs show this asymmetry resolves upward ${(55 + analogScore * 25).toFixed(0)}% of the time when supply-chain evidence confirms.`

  } else if (regimeType === 'DEFENSIVE_ROTATION' && sectorIsDefensive(bullish, bearish)) {
    type = 'DEFENSIVE_ROTATION'
    label = 'Defensive Rotation Play'
    probability = 0.5 + overallScore * 0.3
    summary = `Macro deterioration is triggering capital rotation into defensive sectors. This stock sits in the path of that flow with institutional options positioning confirming the sector re-rating is still in early innings.`

  } else if (catalystScore > 0.4 && evidenceScore < 0.1 && Math.abs(timingScore) < 0.25) {
    type = 'EVENT_DRIVEN'
    label = 'Event-Driven Trade'
    probability = 0.5 + catalystScore * 0.28
    summary = `A strong catalyst has been detected but fundamental evidence has not yet confirmed. This is a pure event-driven setup — tight time horizon, high sensitivity to the next news print, and no structural thesis backing it.`

  } else if (isHighVol && Math.abs(timingScore) > 0.3) {
    type = 'VOLATILITY_PLAY'
    label = timingScore > 0 ? 'Volatility Breakout Long' : 'Volatility Short'
    probability = 0.5 + timingScore * 0.32
    summary = `Elevated volatility regime detected. Options market implied volatility skew and price momentum are pointing ${timingScore > 0 ? 'long' : 'short'}. Position sizing must account for the wide expected-move range in this environment.`

  } else if (bullish >= 3 && timingScore < 0.1) {
    type = 'AWAIT_TRIGGER'
    label = 'Speculative Long — Await Entry Trigger'
    probability = 0.5 + overallScore * 0.22
    summary = `The fundamental and historical cases are constructive, but the execution layer is not yet confirming. Wait for a momentum inflection or unusual options activity before committing capital — the thesis is valid, the timing is not yet.`

  } else {
    type = 'NEUTRAL'
    label = 'Neutral — Monitor Closely'
    probability = 0.5 + overallScore * 0.15
    summary = `Signal layers show mixed convergence with no dominant directional bias. The risk/reward does not justify position initiation at this time — re-evaluate after the next catalyst event or macro data release.`
  }

  const confidenceLevel = bullish >= 4 || bearish >= 4 ? 'HIGH' : bullish >= 3 || bearish >= 3 ? 'MEDIUM' : 'LOW'
  return {
    type, label, summary,
    probability: Math.max(0.08, Math.min(0.95, probability)),
    confidence: confidenceLevel,
    overallScore,
    bullishStages: bullish,
    bearishStages: bearish,
  }
}

function sectorIsDefensive(bullish, bearish) {
  return bullish >= 2
}

// ─────────────────────────────────────────────────────────────
// MAIN EXPORT: buildConvergenceTree
// ─────────────────────────────────────────────────────────────

export function buildConvergenceTree(signals, simulatedOverrides = {}) {
  // Helper: get effective score (with simulation override)
  const eff = (id) => {
    const found = signals.find(s => s.id === id)
    return simulatedOverrides[id] !== undefined ? simulatedOverrides[id] : (found?.score ?? 0)
  }

  const scores = {
    macro:       eff('macro'),
    sector:      eff('sector'),
    event:       eff('event'),
    sentiment:   eff('sentiment'),
    fundamental: eff('fundamental'),
    commodity:   eff('commodity'),
    historical:  eff('historical'),
    momentum:    eff('momentum'),
    options:     eff('options'),
  }

  // ── Stage 0: Regime (MACRO + SECT) ──────────────────────────
  const regimeScore    = scores.macro * 0.6 + scores.sector * 0.4
  const regimeType     = getRegimeType(scores.macro, scores.sector)
  const regimeConf     = (Math.abs(scores.macro) + Math.abs(scores.sector)) / 2

  // ── Stage 1: Catalyst (EVENT + SENT) ────────────────────────
  const sentEventGap    = Math.abs(scores.event - scores.sentiment)
  const sentDivergence  = sentEventGap > 0.48
  const catalystScore   = scores.event * 0.5 + scores.sentiment * 0.5
  const crowdReaction   = getCrowdReaction(scores.event, scores.sentiment)
  const catalystConf    = sentDivergence ? Math.max(0.18, 0.55 - sentEventGap * 0.3) : Math.abs(catalystScore) * 0.7 + 0.3

  // ── Stage 2: Evidence (FUND + CMDTY) ────────────────────────
  const evidenceScore   = scores.fundamental * 0.6 + scores.commodity * 0.4
  const evidenceConf    = (Math.abs(scores.fundamental) * 0.65 + Math.abs(scores.commodity) * 0.35) * 0.6 + 0.35

  // ── Stage 3: Historical Analog (HIST) ───────────────────────
  const analogScore     = scores.historical
  const analogWinRate   = Math.round(50 + analogScore * 35)
  const analogConf      = Math.abs(analogScore) * 0.65 + 0.35

  // ── Stage 4: Execution Timing (MOMT + OPTN) ─────────────────
  const isHighVol       = Math.abs(regimeScore) > 0.44 || Math.abs(scores.macro) > 0.6
  const optnWeight      = isHighVol ? 0.62 : 0.38
  const momtWeight      = 1 - optnWeight
  const timingScore     = scores.momentum * momtWeight + scores.options * optnWeight
  const timingConf      = (Math.abs(scores.momentum) + Math.abs(scores.options)) / 2

  // ── Conflicts ────────────────────────────────────────────────
  const conflicts = detectConflicts(scores)

  // ── Thesis ───────────────────────────────────────────────────
  const thesis = buildThesis(
    { regimeScore, catalystScore, evidenceScore, analogScore, timingScore },
    regimeType, crowdReaction, isHighVol, conflicts
  )

  // ── Edge Confidence Scores ────────────────────────────────────
  const edgeConf = {
    macroToRegime:      Math.abs(scores.macro)     * 0.75 + 0.25,
    sectToRegime:       Math.abs(scores.sector)    * 0.75 + 0.25,
    regimeToCatalyst:   regimeConf * 0.6 + 0.3,
    eventToCatalyst:    Math.abs(scores.event)     * 0.7  + 0.2,
    sentToCatalyst:     sentDivergence ? 0.18 : Math.abs(scores.sentiment) * 0.7 + 0.2,
    catalystToEvidence: catalystConf,
    fundToEvidence:     Math.abs(scores.fundamental) * 0.7 + 0.2,
    cmdtyToEvidence:    Math.abs(scores.commodity)   * 0.6 + 0.2,
    evidenceToAnalog:   evidenceConf * 0.7 + 0.2,
    analogToTiming:     analogConf * 0.65 + 0.2,
    momtToTiming:       Math.abs(scores.momentum) * 0.7 + 0.2,
    optnToTiming:       Math.abs(scores.options)  * (isHighVol ? 0.85 : 0.6) + 0.15,
    timingToThesis:     (timingConf * 0.5 + thesis.probability * 0.5),
  }

  // ── Historical analog examples ────────────────────────────────
  const analogs = [
    { date: '2021-04-12', similarity: 0.88, outcome: analogScore > 0.1 ? '+14.2%' : '-11.3%', days: 5 },
    { date: '2020-11-03', similarity: 0.79, outcome: analogScore > 0.1 ? '+9.8%'  : '-8.1%',  days: 5 },
    { date: '2022-02-28', similarity: 0.72, outcome: analogScore > 0.1 ? '+6.1%'  : '-13.7%', days: 5 },
  ]

  return {
    scores,
    stages: {
      regime:   { score: regimeScore,   type: regimeType,    confidence: regimeConf,    label: regimeType.replace(/_/g, ' ') },
      catalyst: { score: catalystScore, crowdReaction,       confidence: catalystConf,  sentDivergence },
      evidence: { score: evidenceScore, confidence: evidenceConf },
      analog:   { score: analogScore,   winRate: analogWinRate, confidence: analogConf, analogs },
      timing:   { score: timingScore,   confidence: timingConf, isHighVol, optnWeight, momtWeight },
    },
    thesis,
    conflicts,
    edgeConf,
    sparklines: Object.fromEntries(
      Object.keys(scores).map(id => [id, generateSparkline(scores[id], id)])
    ),
  }
}

/** Build the React Flow nodes + edges arrays from tree data */
export function buildFlowElements(tree, signals, simulatedOverrides, onNodeSelect) {
  const { scores, stages, thesis, conflicts, edgeConf, sparklines } = tree

  const conflictNodeIds = new Set(conflicts.flatMap(c => c.nodes))
  const simNodeIds      = new Set(Object.keys(simulatedOverrides))

  // Helper: get full signal object for a layer id
  const sig = (id) => signals.find(s => s.id === id) || {}

  // Node factory helpers
  const layerNode = (id, position, extra = {}) => ({
    id,
    type: 'layerNode',
    position,
    data: {
      signal:       sig(id),
      score:        scores[id],
      sparkline:    sparklines[id],
      isConflict:   conflictNodeIds.has(id),
      isSimulated:  simNodeIds.has(id),
      ...extra,
    },
  })

  const stageNode = (id, position, data) => ({
    id,
    type: 'stageNode',
    position,
    data,
  })

  // ── X centering: canvas ~760px wide ─────────────────────────
  const CX = 280  // center x for single/stage nodes

  const nodes = [
    // ── Stage 0 ──
    layerNode('macro',   { x: 30,  y: 40  }),
    layerNode('sector',  { x: 480, y: 40  }),
    stageNode('regime',  { x: CX - 120, y: 260 }, {
      stageNum: 0, label: 'Market Context',
      sublabel: stages.regime.label,
      score: stages.regime.score,
      confidence: stages.regime.confidence,
      isConflict: conflictNodeIds.has('macro') && conflictNodeIds.has('sect'),
    }),

    // ── Stage 1 ──
    layerNode('event',     { x: 30,  y: 470 }),
    layerNode('sentiment', { x: 480, y: 470 }, {
      isConflict: conflictNodeIds.has('sent'),
      crowdReaction: stages.catalyst.crowdReaction,
    }),
    stageNode('catalyst',  { x: CX - 120, y: 690 }, {
      stageNum: 1, label: 'Catalyst',
      sublabel: stages.catalyst.sentDivergence ? '⚠ Divergence Detected' : stages.catalyst.crowdReaction.replace(/_/g, ' '),
      score: stages.catalyst.score,
      confidence: stages.catalyst.confidence,
      isConflict: stages.catalyst.sentDivergence,
    }),

    // ── Stage 2 ──
    layerNode('fundamental', { x: 30,  y: 900 }),
    layerNode('commodity',   { x: 480, y: 900 }),
    stageNode('evidence',    { x: CX - 120, y: 1120 }, {
      stageNum: 2, label: 'Fundamental Evidence',
      sublabel: evidenceSublabel(stages.evidence.score),
      score: stages.evidence.score,
      confidence: stages.evidence.confidence,
    }),

    // ── Stage 3 ──
    layerNode('historical', { x: CX - 90, y: 1330 }, {
      winRate: stages.analog.winRate,
      analogs: stages.analog.analogs,
    }),

    // ── Stage 4 ──
    layerNode('momentum', { x: 30,  y: 1560 },
      stages.timing.isHighVol ? {} : {}
    ),
    layerNode('options',  { x: 480, y: 1560 }, {
      isConflict:   conflictNodeIds.has('optn'),
      isHighVol:    stages.timing.isHighVol,
      optnWeight:   stages.timing.optnWeight,
    }),
    stageNode('timing',   { x: CX - 120, y: 1780 }, {
      stageNum: 4, label: 'Execution Timing',
      sublabel: stages.timing.isHighVol ? '⚡ HIGH VOL MODE' : 'Normal Weighting',
      score: stages.timing.score,
      confidence: stages.timing.confidence,
      isHighVol: stages.timing.isHighVol,
    }),

    // ── Thesis ──
    { id: 'thesis', type: 'thesisNode', position: { x: CX - 160, y: 2010 }, data: { thesis } },
  ]

  // Confidence edge factory
  const edge = (id, source, target, confKey, extra = {}) => ({
    id,
    source,
    target,
    type: 'confidenceEdge',
    data: {
      confidence: edgeConf[confKey] ?? 0.5,
      sourceScore: scores[source] ?? 0,
      targetScore: (scores[target] ?? 0),
      ...extra,
    },
  })

  const edges = [
    // Stage 0 feeds
    edge('e-macro-regime',    'macro',      'regime',   'macroToRegime'),
    edge('e-sect-regime',     'sector',     'regime',   'sectToRegime'),
    // Stage 0→1
    edge('e-regime-cat',      'regime',     'catalyst', 'regimeToCatalyst'),
    // Stage 1 feeds
    edge('e-event-cat',       'event',      'catalyst', 'eventToCatalyst'),
    edge('e-sent-cat',        'sentiment',  'catalyst', 'sentToCatalyst', {
      isConflict: stages.catalyst.sentDivergence,
    }),
    // Stage 1→2
    edge('e-cat-ev',          'catalyst',   'evidence', 'catalystToEvidence'),
    // Stage 2 feeds
    edge('e-fund-ev',         'fundamental','evidence', 'fundToEvidence'),
    edge('e-cmdty-ev',        'commodity',  'evidence', 'cmdtyToEvidence', {
      isConflict: conflictNodeIds.has('cmdty'),
    }),
    // Stage 2→3
    edge('e-ev-hist',         'evidence',   'historical','evidenceToAnalog'),
    // Stage 3→4
    edge('e-hist-momt',       'historical', 'momentum', 'analogToTiming'),
    edge('e-hist-optn',       'historical', 'options',  'analogToTiming'),
    // Stage 4 feeds
    edge('e-momt-timing',     'momentum',   'timing',   'momtToTiming'),
    edge('e-optn-timing',     'options',    'timing',   'optnToTiming'),
    // Stage 4→Thesis
    edge('e-timing-thesis',   'timing',     'thesis',   'timingToThesis'),
  ]

  return { nodes, edges }
}

function evidenceSublabel(score) {
  if (score > 0.4)  return 'Strong Fundamental Support'
  if (score > 0.1)  return 'Moderate Evidence'
  if (score < -0.4) return 'Fundamentals Deteriorating'
  if (score < -0.1) return 'Weak Evidence'
  return 'Mixed Evidence'
}

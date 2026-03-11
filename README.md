# APEX — AI-Powered Trading Research System v2.0

> A professional-grade XAI Decision Engine with a Sequential Pipeline Brain, Vector Memory, and Autonomous Discovery.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     APEX v2.0 STACK                             │
├────────────────────────┬────────────────────────────────────────┤
│  Frontend (Vite/React) │  Backend (Node/Express)                │
│  ─────────────────────  │  ──────────────────────────────────── │
│  ConvergenceTree        │  server.js          :3001             │
│  (React Flow XAI UI)    │  pipeline.js        (orchestrator)    │
│                         │  layers/            (9 modules)       │
│  Discovery Page         │  discovery/scanner  (universe scan)   │
│  Memory Page            │  memory/vectorStore (SQLite + cosine) │
│  Dashboard / Analysis   │  utils/fetcher      (YF, Reddit, ...)  │
│                         │  utils/scorer       (normalise/RSI)    │
│  useBackend.js hook     │  data/apex_memory.db                  │
│  (live + mock fallback) │                                       │
└────────────────────────┴────────────────────────────────────────┘
```

---

## Quick Start

### Install everything
```bash
npm run setup          # installs both frontend + backend deps
```

### Start both servers (recommended)
```bash
npm run dev:all
```
- **Frontend**: http://localhost:5173
- **Backend**:  http://localhost:3001

### Or start separately
```bash
# Terminal 1 — backend
npm run dev:backend

# Terminal 2 — frontend
npm run dev
```

---

## The 5-Stage Filtration Pipeline

Each ticker flows through a sequential chain. Each stage **passes context** to the next:

```
Stage 0: Market Context    MACRO + SECT
           │ regime, volatility, sector rotation
           ▼
Stage 1: Catalyst          EVENT + SENT
           │ news scraping, Reddit WSB, crowd reaction
           ▼
Stage 2: Reality Check     FUND + CMDTY
           │ EPS surprises, supply chain costs
           │ (CMDTY weight auto-boosted if geopolitical crisis detected)
           ▼
Stage 3: Historical Analog HIST
           │ cosine similarity search in memory DB
           ▼
Stage 4: Execution Timing  MOMT + OPTN
           │ (OPTIONS weight auto-elevated when VIX > 25)
           ▼
      CONVERGENCE THESIS
      (7 thesis types: Momentum Breakout, Contrarian Long,
       High Conviction Short, Defensive Rotation, Event-Driven,
       Volatility Play, Await Trigger, Avoid — No Convergence)
```

---

## The 9 Layer Modules

| File | Stage | Data Sources | Fallback |
|------|-------|-------------|---------|
| `layers/macro.js`       | 0A | YF: VIX, TNX, IRX, SPY | deterministic mock |
| `layers/sector.js`      | 0B | YF: sector ETF, SPY, ticker | deterministic mock |
| `layers/event.js`       | 1A | YF News API (25 headlines) | deterministic mock |
| `layers/sentiment.js`   | 1B | Reddit WSB + /r/stocks + YF News | deterministic mock |
| `layers/fundamental.js` | 2A | YF Summary: earnings, EPS, guidance | deterministic mock |
| `layers/commodity.js`   | 2B | YF: sector-specific commodities | deterministic mock |
| `layers/historical.js`  | 3  | APEX memory DB (cosine search) | static analogs |
| `layers/momentum.js`    | 4A | YF Chart: RSI, MACD, MA crossovers | deterministic mock |
| `layers/options.js`     | 4B | YF Options Chain: PCR, IV, unusual activity | deterministic mock |

Every layer:
1. Tries live data first
2. Falls back to deterministic mock if network fails
3. Returns `_context` object for downstream layers to consume
4. Returns `subSignals[]` for the drilldown sidebar
5. Returns `sparkline[16]` for the node sparkline display

---

## Vector Memory (Pattern Recognition)

### How it works
1. Every `POST /api/analyze/:ticker` run saves a 9-dimensional vector snapshot to **SQLite**
2. Vector = `[macro, sector, event, sentiment, fundamental, commodity, historical, momentum, options]`
3. Cosine similarity search compares current vector against all stored vectors
4. Threshold ≥ 88% → **Pattern Alert** fires: *"I've seen this movie before"*
5. Record actual outcomes (the % move that happened) via the Memory page table

### DB Location
```
backend/data/apex_memory.db    (auto-created on first run)
```

### API Endpoints for Memory
```
GET  /api/memory/stats                   — total snapshots, win rate, etc.
GET  /api/memory/snapshots?ticker=NVDA   — all snapshots (filter optional)
GET  /api/memory/matches/:ticker         — cosine similarity search
PATCH /api/memory/outcome/:id            — record actual % outcome
```

---

## Discovery Engine

`GET /api/discover?limit=12` launches concurrent quickScore jobs across the universe.

**quickScore()** uses 2 fast API calls (chart + news) to estimate convergence without running the full 9-layer pipeline. Highest convergence stocks surface at the top of the Discovery page.

### Customise the universe
Add to `backend/.env`:
```
SCAN_UNIVERSE=NVDA,AAPL,TSLA,SPY,QQQ,PLTR,...
```

---

## Environment Configuration

Copy `backend/.env.example` → `backend/.env`, then fill in optional keys:

```env
PORT=3001
FETCH_TIMEOUT=6000
DB_PATH=./data/apex_memory.db
SCAN_UNIVERSE=NVDA,AAPL,MSFT,...

# Optional but improves data quality:
FRED_API_KEY=    # free at fred.stlouisfed.org/docs/api
                 # used for precise CPI, GDP, yield curve data
```

> **All API keys are optional.** The system gracefully falls back to Yahoo Finance
> for all macro data without FRED. Every layer has a mock fallback, so the UI
> works even with no internet connection.

---

## Adding a Custom Ticker

Any ticker that Yahoo Finance supports can be analyzed. The sector ETF map
(`backend/layers/sector.js`) has ~30 pre-mapped tickers. For others, it
falls back to `SPY` for sector comparison — still fully functional.

---

## Data Sources Used (No API Key Required)

| Source | What we pull |
|--------|-------------|
| Yahoo Finance Charts | OHLCV price history, commodity prices |
| Yahoo Finance Summary | EPS, revenue growth, analyst consensus |
| Yahoo Finance News | 25 latest headlines per ticker |
| Yahoo Finance Options | Put/call ratio, IV, open interest |
| Reddit (public JSON) | WSB + /r/stocks posts — no login needed |

---

## Mock Fallback System

Every layer uses `deterministicScore(ticker, layerId)` as its fallback:
- Seeded by ticker + layer ID (same result every time for the same inputs)
- Returns a realistic -1..+1 float
- The frontend can run entirely in mock mode — no backend required

**The UI shows `● MOCK` or `● LIVE` indicators** so you always know which data you're seeing.

---

## Frontend Pages

| Page | Route | Description |
|------|-------|-------------|
| **Overview** | `dashboard` | XAI Convergence Tree with React Flow, simulation mode, drilldown sidebar |
| **Layer Analysis** | `analysis` | Deep-dive into each layer's subSignals, comparisons, radar chart |
| **Discovery** | `discovery` | Autonomous scanner — surfaces high-convergence setups |
| **Memory** | `memory` | Vector DB viewer, pattern matches, outcome recording |
| **Backtest** | `backtest` | Historical strategy simulation |
| **Portfolio** | `portfolio` | Paper trading tracker |

---

## Simulation Mode

On the Overview page, click any layer node → open the drilldown sidebar → toggle **Simulation Mode** → drag the slider to override that layer's score. All downstream stage nodes and the final Convergence Thesis update in real-time.

Example: "What if News Sentiment flips negative while everything else stays the same?"

---

## Project Structure

```
trading-system/
├── package.json            ← root: scripts, concurrently
├── vite.config.js          ← Vite + /api proxy to :3001
├── index.html
├── src/
│   ├── App.jsx
│   ├── index.css
│   ├── main.jsx
│   ├── components/
│   │   ├── ConvergenceTree/
│   │   │   ├── ConvergenceTree.jsx   ← React Flow wrapper
│   │   │   ├── LayerNode.jsx         ← layer signal node
│   │   │   ├── StageNode.jsx         ← stage aggregator node
│   │   │   ├── ThesisNode.jsx        ← final convergence node
│   │   │   ├── ConfidenceEdge.jsx    ← animated edges
│   │   │   └── DrilldownSidebar.jsx  ← progressive disclosure + sim
│   │   └── Layout/Layout.jsx
│   ├── hooks/
│   │   └── useBackend.js             ← live/mock auto-fallback hook
│   ├── data/
│   │   └── mockData.js               ← mock generator
│   ├── utils/
│   │   └── convergenceLogic.js       ← local tree builder (mock mode)
│   └── pages/
│       ├── Dashboard.jsx
│       ├── Analysis.jsx
│       ├── Discovery.jsx
│       ├── Memory.jsx
│       ├── Backtest.jsx
│       └── Portfolio.jsx
└── backend/
    ├── server.js                     ← Express API
    ├── pipeline.js                   ← 5-stage orchestrator
    ├── package.json
    ├── .env.example
    ├── layers/
    │   ├── macro.js
    │   ├── sector.js
    │   ├── event.js
    │   ├── sentiment.js
    │   ├── fundamental.js
    │   ├── commodity.js
    │   ├── historical.js
    │   ├── momentum.js
    │   └── options.js
    ├── discovery/
    │   └── scanner.js
    ├── memory/
    │   └── vectorStore.js            ← SQLite + cosine similarity
    └── utils/
        ├── fetcher.js                ← YF, Reddit, FRED HTTP client
        └── scorer.js                 ← RSI, normalise, sparkline, scoreText
```

---

*No Cursor or other IDE branding in this project.*

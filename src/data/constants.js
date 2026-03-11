// Display-only constants — no fake numbers. Symbols and layer labels only.
// Real data comes from the backend (analyze, discover, memory).

export const DEFAULT_SYMBOLS = [
  'NVDA', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'JPM', 'XOM', 'CVX',
  'AMD', 'INTC', 'NFLX', 'CRM', 'BA', 'GS', 'WMT', 'JNJ', 'PFE', 'V', 'MA',
  'PYPL', 'PLTR', 'COIN', 'SPY', 'QQQ',
]

export const LAYERS = [
  { id: 'macro',       name: 'Macroeconomic',               shortName: 'MACRO', icon: '🌐', color: '#ff55aa', description: 'Interest rates, inflation, global growth, and recession risk' },
  { id: 'sector',      name: 'Sector & Industry',           shortName: 'SECT',  icon: '🏭', color: '#8855ff', description: 'Measures sector-wide forces and relative industry performance' },
  { id: 'event',       name: 'Event Detection',             shortName: 'EVENT',  icon: '⚠️', color: '#ffcc00', description: 'Detects earnings, policy changes, geopolitical events, and catalysts' },
  { id: 'sentiment',   name: 'News Sentiment',              shortName: 'SENT',  icon: '📰', color: '#ff6644', description: 'AI-extracted sentiment from news, media, and earnings calls' },
  { id: 'fundamental', name: 'Fundamental Earnings',        shortName: 'FUND',  icon: '📊', color: '#4466ff', description: 'Evaluates earnings surprises, revenue beats, and forward guidance' },
  { id: 'commodity',   name: 'Commodity & Supply Chain',    shortName: 'CMDTY', icon: '⛽', color: '#ffaa00', description: 'Analyzes commodity price impact on supply chain dynamics' },
  { id: 'historical',  name: 'Historical Analog',           shortName: 'HIST',  icon: '📈', color: '#00ff88', description: 'Pattern matching against historical events of similar nature' },
  { id: 'momentum',    name: 'Price Momentum',              shortName: 'MOMT',  icon: '⚡', color: '#00d4ff', description: 'Captures price acceleration, volume spikes, and trend strength' },
  { id: 'options',     name: 'Options Market',              shortName: 'OPTN',  icon: '🎯', color: '#55ffcc', description: 'Implied volatility, unusual activity, and put/call ratios' },
]

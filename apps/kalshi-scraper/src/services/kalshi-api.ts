const KALSHI_API_BASE = 'https://api.elections.kalshi.com/trade-api/v2'
const MAX_RETRIES = 3
const MAX_MARKET_PAGES = 50
const MAX_EVENT_PAGES = 30
const PAGE_DELAY_MS = 300

// -- Kalshi API response types --

export interface KalshiMarket {
  ticker: string
  event_ticker: string
  market_type: string
  title: string
  subtitle: string
  yes_sub_title: string
  no_sub_title: string
  yes_bid: number
  yes_ask: number
  yes_bid_dollars: string
  yes_ask_dollars: string
  last_price: number
  last_price_dollars: string
  previous_price: number
  previous_price_dollars: string
  volume: number
  volume_24h: number
  volume_24h_fp: string
  open_interest: number
  open_interest_fp: string
  close_time: string
  status: string
  result: string
}

export interface KalshiEvent {
  event_ticker: string
  series_ticker: string
  title: string
  sub_title: string
  category: string
}

interface MarketsResponse {
  cursor: string
  markets: KalshiMarket[]
}

interface EventsResponse {
  cursor: string
  events: KalshiEvent[]
}

// -- Helpers --

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchJson<T>(url: string): Promise<T> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    })

    if (res.status === 429) {
      const backoff = 2 ** (attempt + 1) * 1000
      console.warn(`Rate limited, retrying in ${backoff}ms...`)
      await sleep(backoff)
      continue
    }

    if (!res.ok) {
      throw new Error(`Kalshi API ${res.status}: ${url}`)
    }

    return res.json() as Promise<T>
  }

  throw new Error(`Kalshi API: max retries exceeded for ${url}`)
}

// Convert FixedPointDollars string to integer cents (0-100)
export function dollarsToCents(dollars: string): number {
  const value = parseFloat(dollars || '0')
  return Math.round(value * 100)
}

// -- Public API --

export async function fetchAllMarkets(): Promise<KalshiMarket[]> {
  const allMarkets: KalshiMarket[] = []
  let cursor = ''
  let pages = 0

  // Fetch non-multivariate markets with pagination
  while (pages < MAX_MARKET_PAGES) {
    const params = new URLSearchParams({
      status: 'open',
      limit: '1000',
      mve_filter: 'exclude',
    })
    if (cursor) params.set('cursor', cursor)

    const data = await fetchJson<MarketsResponse>(
      `${KALSHI_API_BASE}/markets?${params}`,
    )
    allMarkets.push(...data.markets)
    pages++

    if (!data.cursor) break
    cursor = data.cursor
    await sleep(PAGE_DELAY_MS)
  }

  // Keep only markets with trading activity
  return allMarkets.filter((m) => m.volume_24h > 0 || m.open_interest > 0)
}

export async function fetchEvents(): Promise<Map<string, KalshiEvent>> {
  const eventMap = new Map<string, KalshiEvent>()
  let cursor = ''
  let pages = 0

  while (pages < MAX_EVENT_PAGES) {
    const params = new URLSearchParams({
      status: 'open',
      limit: '200',
    })
    if (cursor) params.set('cursor', cursor)

    const data = await fetchJson<EventsResponse>(
      `${KALSHI_API_BASE}/events?${params}`,
    )
    for (const event of data.events) {
      eventMap.set(event.event_ticker, event)
    }
    pages++

    if (!data.cursor) break
    cursor = data.cursor
    await sleep(PAGE_DELAY_MS)
  }

  return eventMap
}

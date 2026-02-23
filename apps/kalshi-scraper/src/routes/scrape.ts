import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { config } from '../config'
import { db, markets } from '../db'
import type { NewMarket } from '../db/schema'
import {
  type ScrapedRanking,
  scrapeKalshiRankings,
} from '../services/browserbase-scraper'
import { mapCategory } from '../services/category-mapper'
import {
  dollarsToCents,
  fetchAllMarkets,
  fetchEvents,
  type KalshiMarket,
} from '../services/kalshi-api'
import {
  computeFeedScore,
  generateEngagementCounts,
  isHotMarket,
  isTrendingMarket,
} from '../services/ranking'

export const scrapeRoute = new Hono().post('/', async (c) => {
  // Protect endpoint with secret
  const secret = c.req.header('x-scrape-secret') ?? c.req.query('secret')
  if (secret !== config.SCRAPE_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const startTime = Date.now()
  const results = {
    marketsIngested: 0,
    eventsLoaded: 0,
    scraped: false,
    error: null as string | null,
  }

  try {
    // Run API pull and Browserbase scrape in parallel
    const [kalshiMarkets, eventMap, scrapedRankings] = await Promise.all([
      fetchAllMarkets(),
      fetchEvents(),
      scrapeKalshiRankingsOrFallback(),
    ])

    results.eventsLoaded = eventMap.size
    results.scraped = scrapedRankings.length > 0

    // Build set of trending titles from scraped data
    const trendingTitles = buildTrendingTitles(scrapedRankings)

    // Transform and upsert each market
    const marketRows = kalshiMarkets.map((km) =>
      transformMarket(km, eventMap, trendingTitles),
    )

    // Batch upsert in chunks of 100
    for (let i = 0; i < marketRows.length; i += 100) {
      const chunk = marketRows.slice(i, i + 100)
      await upsertMarkets(chunk)
    }

    results.marketsIngested = marketRows.length
  } catch (err) {
    results.error = err instanceof Error ? err.message : String(err)
    console.error('Scrape failed:', results.error)
  }

  const duration = Date.now() - startTime
  return c.json({ ...results, durationMs: duration })
})

// -- Helpers --

async function scrapeKalshiRankingsOrFallback(): Promise<ScrapedRanking[]> {
  try {
    return await scrapeKalshiRankings()
  } catch (err) {
    console.error('Browserbase scrape failed, continuing with API-only:', err)
    return []
  }
}

function buildTrendingTitles(rankings: ScrapedRanking[]): Set<string> {
  const titles = new Set<string>()
  for (const ranking of rankings) {
    if (ranking.feedType === 'trending' || ranking.feedType === 'top_movers') {
      for (const item of ranking.items) {
        titles.add(item.title.toLowerCase())
      }
    }
  }
  return titles
}

function transformMarket(
  km: KalshiMarket,
  eventMap: Map<string, import('../services/kalshi-api').KalshiEvent>,
  trendingTitles: Set<string>,
): NewMarket {
  const event = eventMap.get(km.event_ticker)
  const category = mapCategory(event?.category ?? '', [], km.title)

  // Convert prices from FixedPointDollars to cents
  const yesPrice = dollarsToCents(km.yes_bid_dollars)
  const noPrice = 100 - yesPrice
  const lastPrice = dollarsToCents(km.last_price_dollars)
  const previousPrice = dollarsToCents(km.previous_price_dollars)
  const priceChange24h = lastPrice - previousPrice

  // Build the kalshi URL from the event ticker
  const seriesTicker = event?.series_ticker ?? km.event_ticker
  const kalshiUrl = `https://kalshi.com/markets/${seriesTicker.toLowerCase()}`

  // Check if this market appears in scraped trending list
  const isInTrendingList = trendingTitles.has(km.title.toLowerCase())

  const engagement = generateEngagementCounts(km.volume_24h)

  const market: NewMarket = {
    ticker: km.ticker,
    title: km.title,
    subtitle: event?.sub_title ?? km.subtitle ?? '',
    category,
    yesPrice,
    noPrice,
    volume: km.volume,
    volume24h: km.volume_24h,
    openInterest: km.open_interest,
    closeTime: km.close_time ? new Date(km.close_time) : null,
    imageUrl: null,
    kalshiUrl,
    status: 'open',
    lastPrice,
    priceChange24h,
    tradersCount: Math.round(km.volume_24h / 50),
    isHot: false,
    isTrending: false,
    feedScore: 0,
    likesCount: engagement.likesCount,
    commentsCount: engagement.commentsCount,
    sharesCount: engagement.sharesCount,
    eventTicker: km.event_ticker,
  }

  // Compute ranking fields
  market.feedScore = computeFeedScore({ market, isInTrendingList })
  market.isHot = isHotMarket(market)
  market.isTrending = isTrendingMarket(
    market,
    isInTrendingList,
    market.feedScore ?? 0,
  )

  return market
}

async function upsertMarkets(rows: NewMarket[]) {
  if (rows.length === 0) return

  await db
    .insert(markets)
    .values(rows)
    .onConflictDoUpdate({
      target: markets.ticker,
      set: {
        title: sql`excluded.title`,
        subtitle: sql`excluded.subtitle`,
        category: sql`excluded.category`,
        yesPrice: sql`excluded.yes_price`,
        noPrice: sql`excluded.no_price`,
        volume: sql`excluded.volume`,
        volume24h: sql`excluded.volume_24h`,
        openInterest: sql`excluded.open_interest`,
        closeTime: sql`excluded.close_time`,
        kalshiUrl: sql`excluded.kalshi_url`,
        status: sql`excluded.status`,
        lastPrice: sql`excluded.last_price`,
        priceChange24h: sql`excluded.price_change_24h`,
        tradersCount: sql`excluded.traders_count`,
        isHot: sql`excluded.is_hot`,
        isTrending: sql`excluded.is_trending`,
        feedScore: sql`excluded.feed_score`,
        likesCount: sql`excluded.likes_count`,
        commentsCount: sql`excluded.comments_count`,
        sharesCount: sql`excluded.shares_count`,
        eventTicker: sql`excluded.event_ticker`,
        updatedAt: sql`now()`,
      },
    })
}

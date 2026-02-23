import { and, desc, eq, lt } from 'drizzle-orm'
import { Hono } from 'hono'
import { db, markets } from '../db'

export const feedRoute = new Hono().get('/', async (c) => {
  const category = c.req.query('category') ?? 'trending'
  const cursor = c.req.query('cursor') ?? null
  const limit = Math.min(
    Number.parseInt(c.req.query('limit') ?? '20', 10) || 20,
    100,
  )

  // Build where conditions
  const conditions = [eq(markets.status, 'open')]

  // Category filter
  if (category === 'trending') {
    conditions.push(eq(markets.isTrending, true))
  } else if (category !== 'all') {
    conditions.push(eq(markets.category, category))
  }

  // Cursor-based pagination (cursor = feed_score of last item)
  if (cursor) {
    conditions.push(lt(markets.feedScore, Number.parseInt(cursor, 10)))
  }

  const rows = await db
    .select()
    .from(markets)
    .where(and(...conditions))
    .orderBy(desc(markets.feedScore))
    .limit(limit + 1)

  const hasMore = rows.length > limit
  const pageRows = hasMore ? rows.slice(0, limit) : rows
  const nextCursor =
    hasMore && pageRows.length > 0
      ? String(pageRows[pageRows.length - 1].feedScore)
      : null

  // Map DB rows to the FeedResponse shape the frontend expects
  const feedMarkets = pageRows.map((row) => ({
    id: row.id,
    ticker: row.ticker,
    title: row.title,
    subtitle: row.subtitle ?? '',
    category: row.category,
    yes_price: row.yesPrice,
    no_price: row.noPrice,
    volume: row.volume ?? 0,
    volume_24h: row.volume24h ?? 0,
    open_interest: row.openInterest ?? 0,
    close_time: row.closeTime?.toISOString() ?? '',
    image_url: row.imageUrl,
    kalshi_url: row.kalshiUrl,
    status: row.status,
    last_price: row.lastPrice ?? 0,
    price_change_24h: row.priceChange24h ?? 0,
    traders_count: row.tradersCount ?? 0,
    likes_count: row.likesCount ?? 0,
    comments_count: row.commentsCount ?? 0,
    shares_count: row.sharesCount ?? 0,
    is_hot: row.isHot ?? false,
    is_trending: row.isTrending ?? false,
    created_at: row.createdAt?.toISOString() ?? '',
  }))

  return c.json({
    markets: feedMarkets,
    cursor: nextCursor,
    has_more: hasMore,
  })
})

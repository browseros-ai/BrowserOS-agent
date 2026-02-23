import type { NewMarket } from '../db/schema'

interface RankingInput {
  market: NewMarket
  isInTrendingList: boolean
}

// Compute a feed score (0-1000) for ranking markets in the TikTok feed
export function computeFeedScore(input: RankingInput): number {
  const { market, isInTrendingList } = input

  // Volume component — normalize to 0-1 range (cap at 2M for 24h volume)
  const volume24h = market.volume24h ?? 0
  const volumeScore = Math.min(volume24h / 2_000_000, 1)

  // Controversy — markets near 50/50 are most engaging
  const yesPrice = market.yesPrice ?? 50
  const controversyScore = 1 - Math.abs(yesPrice - 50) / 50

  // Recency — newer markets get a boost (decay over 30 days)
  const createdMs = market.createdAt
    ? new Date(market.createdAt).getTime()
    : Date.now() - 30 * 24 * 60 * 60 * 1000
  const ageMs = Date.now() - createdMs
  const ageDays = ageMs / (24 * 60 * 60 * 1000)
  const recencyScore = Math.max(0, 1 - ageDays / 30)

  // Closing soon — urgency factor (peak when closing in next 24h)
  const closeMs = market.closeTime
    ? new Date(market.closeTime).getTime()
    : Date.now() + 365 * 24 * 60 * 60 * 1000
  const timeToCloseHours = Math.max(
    0,
    (closeMs - Date.now()) / (60 * 60 * 1000),
  )
  const closingSoonScore =
    timeToCloseHours < 24
      ? 1 - timeToCloseHours / 24
      : timeToCloseHours < 168
        ? 0.3
        : 0

  // Kalshi trending boost
  const trendingBoost = isInTrendingList ? 1 : 0

  // Weighted sum
  const score =
    volumeScore * 0.3 +
    controversyScore * 0.25 +
    recencyScore * 0.2 +
    closingSoonScore * 0.15 +
    trendingBoost * 0.1

  return Math.round(score * 1000)
}

// Determine if a market should be flagged as "hot"
export function isHotMarket(market: NewMarket): boolean {
  const volume24h = market.volume24h ?? 0
  const yesPrice = market.yesPrice ?? 50
  const controversyScore = 1 - Math.abs(yesPrice - 50) / 50
  return volume24h > 500_000 && controversyScore > 0.5
}

// Determine if a market should be flagged as "trending"
export function isTrendingMarket(
  _market: NewMarket,
  isInTrendingList: boolean,
  feedScore: number,
): boolean {
  return isInTrendingList || feedScore > 500
}

// Generate synthetic engagement counts based on volume
export function generateEngagementCounts(volume24h: number) {
  const base = Math.max(100, volume24h / 10)
  return {
    likesCount: Math.round(base * (0.8 + Math.random() * 0.4)),
    commentsCount: Math.round(base * (0.3 + Math.random() * 0.2)),
    sharesCount: Math.round(base * (0.2 + Math.random() * 0.15)),
  }
}

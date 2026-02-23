import { mapCategory } from '../src/services/category-mapper'
import {
  dollarsToCents,
  fetchAllMarkets,
  fetchEvents,
} from '../src/services/kalshi-api'
import {
  computeFeedScore,
  generateEngagementCounts,
  isHotMarket,
} from '../src/services/ranking'

async function main() {
  console.log('Fetching markets from Kalshi API...')
  const markets = await fetchAllMarkets()
  console.log(`Fetched ${markets.length} open markets`)

  console.log('\nFetching events...')
  const eventMap = await fetchEvents()
  console.log(`Fetched ${eventMap.size} events`)

  // Show first 5 markets with transformed data
  console.log('\n--- Top 5 markets by volume_24h ---\n')
  const sorted = markets.sort((a, b) => b.volume_24h - a.volume_24h).slice(0, 5)

  for (const m of sorted) {
    const event = eventMap.get(m.event_ticker)
    const category = mapCategory(event?.category ?? '', [], m.title)
    const yesPrice = dollarsToCents(m.yes_bid_dollars)

    const market = {
      ticker: m.ticker,
      title: m.title,
      yesPrice,
      noPrice: 100 - yesPrice,
      volume24h: m.volume_24h,
      closeTime: m.close_time ? new Date(m.close_time) : null,
      createdAt: new Date(),
    }

    const score = computeFeedScore({
      market: market as any,
      isInTrendingList: false,
    })
    const hot = isHotMarket(market as any)
    const engagement = generateEngagementCounts(m.volume_24h)

    console.log(`${m.ticker}`)
    console.log(`  Title: ${m.title}`)
    console.log(`  Category: ${event?.category ?? 'unknown'} → ${category}`)
    console.log(`  YES: ${yesPrice}¢  Volume 24h: ${m.volume_24h}`)
    console.log(
      `  Price change: ${dollarsToCents(m.last_price_dollars) - dollarsToCents(m.previous_price_dollars)}`,
    )
    console.log(`  Feed score: ${score}  Hot: ${hot}`)
    console.log(
      `  Engagement: likes=${engagement.likesCount} comments=${engagement.commentsCount}`,
    )
    console.log()
  }

  // Show category distribution
  const categories = new Map<string, number>()
  for (const m of markets) {
    const event = eventMap.get(m.event_ticker)
    const cat = mapCategory(event?.category ?? '', [], m.title)
    categories.set(cat, (categories.get(cat) ?? 0) + 1)
  }
  console.log('--- Category distribution ---')
  for (const [cat, count] of [...categories.entries()].sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(`  ${cat}: ${count}`)
  }
}

main().catch(console.error)

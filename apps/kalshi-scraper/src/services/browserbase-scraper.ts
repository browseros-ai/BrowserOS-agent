import Browserbase from '@browserbasehq/sdk'
import { chromium } from 'playwright-core'
import { config } from '../config'

export type FeedType = 'trending' | 'top_movers' | 'new' | 'highest_volume'

export interface ScrapedItem {
  title: string
  subtitle: string
  pricePercent: number
  priceChange: number
  rank: number
}

export interface ScrapedRanking {
  feedType: FeedType
  items: ScrapedItem[]
}

const SECTION_NAMES: Array<{ label: string; feedType: FeedType }> = [
  { label: 'Trending', feedType: 'trending' },
  { label: 'Top movers', feedType: 'top_movers' },
  { label: 'Top Movers', feedType: 'top_movers' },
  { label: 'New', feedType: 'new' },
  { label: 'Highest volume', feedType: 'highest_volume' },
  { label: 'Highest Volume', feedType: 'highest_volume' },
]

export async function scrapeKalshiRankings(): Promise<ScrapedRanking[]> {
  const bb = new Browserbase({ apiKey: config.BROWSERBASE_API_KEY })

  const session = await bb.sessions.create({
    projectId: config.BROWSERBASE_PROJECT_ID,
    browserSettings: { blockAds: true },
  })

  const browser = await chromium.connectOverCDP(session.connectUrl)
  const context = browser.contexts()[0]
  const page = context.pages()[0]

  try {
    await page.goto('https://kalshi.com/markets', {
      waitUntil: 'networkidle',
      timeout: 30_000,
    })
    await page.waitForTimeout(3000)

    // Extract each section separately to keep complexity low
    const rankings: ScrapedRanking[] = []
    for (const { label, feedType } of SECTION_NAMES) {
      const items = await extractSection(page, label)
      if (items.length > 0) {
        rankings.push({ feedType, items })
      }
    }

    // Deduplicate by feedType (e.g. "Top movers" vs "Top Movers")
    return deduplicateRankings(rankings)
  } finally {
    await browser.close()
  }
}

async function extractSection(
  page: import('playwright-core').Page,
  sectionLabel: string,
): Promise<ScrapedItem[]> {
  return page.evaluate((label) => {
    const headings = document.querySelectorAll(
      'h2, h3, [class*="heading"], [class*="title"]',
    )

    // Find the heading matching this section
    let section: Element | null = null
    for (const h of headings) {
      if (h.textContent?.trim() === label) {
        section = h.closest('section') ?? h.parentElement
        break
      }
    }
    if (!section) return []

    const items: Array<{
      title: string
      subtitle: string
      pricePercent: number
      priceChange: number
      rank: number
    }> = []

    const listItems = section.querySelectorAll(
      'a, [class*="item"], [class*="card"], [class*="row"]',
    )

    let rank = 1
    for (const item of listItems) {
      if (rank > 10) break

      const titleEl = item.querySelector(
        '[class*="title"], [class*="name"], h4, h5, span',
      )
      const title = titleEl?.textContent?.trim() ?? ''
      if (!title || title === label) continue

      const subtitleEl = item.querySelector(
        '[class*="subtitle"], [class*="description"], [class*="sub"]',
      )
      const subtitle = subtitleEl?.textContent?.trim() ?? ''

      const priceMatch = item.textContent?.match(/(\d{1,3})%/)
      const pricePercent = priceMatch ? Number.parseInt(priceMatch[1], 10) : 0

      const changeMatch = item.textContent?.match(/[▲▼△▽]?\s*(\d+)/)
      const isNeg =
        item.textContent?.includes('▼') || item.textContent?.includes('▽')
      const priceChange = changeMatch
        ? Number.parseInt(changeMatch[1], 10) * (isNeg ? -1 : 1)
        : 0

      items.push({ title, subtitle, pricePercent, priceChange, rank })
      rank++
    }

    return items
  }, sectionLabel)
}

function deduplicateRankings(rankings: ScrapedRanking[]): ScrapedRanking[] {
  const seen = new Set<FeedType>()
  return rankings.filter((r) => {
    if (seen.has(r.feedType)) return false
    seen.add(r.feedType)
    return true
  })
}

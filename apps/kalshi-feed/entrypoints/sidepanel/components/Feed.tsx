import { type FC, useRef, useState } from 'react'
import { FAKE_MARKETS } from '@/lib/data/fake-markets'
import type { FeedCategory } from '@/lib/types/market'
import { CategoryTabs } from './CategoryTabs'
import { MarketCard } from './MarketCard'

export const Feed: FC = () => {
  const [activeCategory, setActiveCategory] = useState<FeedCategory>('trending')
  const feedRef = useRef<HTMLDivElement>(null)

  const filteredMarkets =
    activeCategory === 'trending' || activeCategory === 'all'
      ? FAKE_MARKETS
      : FAKE_MARKETS.filter((m) => m.category === activeCategory)

  const handleCategoryChange = (category: FeedCategory) => {
    setActiveCategory(category)
    if (feedRef.current) {
      feedRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  return (
    <div className="relative flex h-screen w-full flex-col bg-black">
      <div className="absolute top-0 right-0 left-0 z-20">
        <div className="bg-gradient-to-b from-black/80 to-transparent pb-4">
          <div className="flex items-center justify-center px-4 pt-3 pb-1">
            <h1 className="font-bold text-base text-white">Kalshi Feed</h1>
          </div>
          <CategoryTabs
            activeCategory={activeCategory}
            onCategoryChange={handleCategoryChange}
          />
        </div>
      </div>

      <div
        ref={feedRef}
        className="h-full w-full snap-y snap-mandatory overflow-y-scroll [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {filteredMarkets.length > 0 ? (
          filteredMarkets.map((market) => (
            <MarketCard key={market.id} market={market} />
          ))
        ) : (
          <div className="flex h-screen items-center justify-center">
            <p className="text-white/50">No markets in this category</p>
          </div>
        )}
      </div>
    </div>
  )
}

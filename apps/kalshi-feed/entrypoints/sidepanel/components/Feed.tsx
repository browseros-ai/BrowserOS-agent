import { type FC, useRef, useState } from 'react'
import { FAKE_MARKETS } from '@/lib/data/fake-markets'
import { BottomNav } from './BottomNav'
import { MarketCard } from './MarketCard'
import { TopBar } from './TopBar'

export const Feed: FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0)
  const feedRef = useRef<HTMLDivElement>(null)

  const currentMarket = FAKE_MARKETS[currentIndex] ?? FAKE_MARKETS[0]

  const handleScroll = () => {
    if (!feedRef.current) return
    const scrollTop = feedRef.current.scrollTop
    const cardHeight = feedRef.current.clientHeight
    const index = Math.round(scrollTop / cardHeight)
    if (index !== currentIndex && index >= 0 && index < FAKE_MARKETS.length) {
      setCurrentIndex(index)
    }
  }

  return (
    <div className="relative flex h-screen w-full flex-col bg-black">
      {/* Top bar overlay */}
      <div className="pointer-events-auto absolute top-0 right-0 left-0 z-30">
        <TopBar category={currentMarket.category} />
      </div>

      {/* Scrollable feed */}
      <div
        ref={feedRef}
        onScroll={handleScroll}
        className="flex-1 snap-y snap-mandatory overflow-y-scroll [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {FAKE_MARKETS.map((market) => (
          <MarketCard key={market.id} market={market} />
        ))}
      </div>

      {/* Bottom nav */}
      <BottomNav />
    </div>
  )
}

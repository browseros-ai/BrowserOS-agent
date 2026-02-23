import {
  ArrowDown,
  ArrowUp,
  Clock,
  ExternalLink,
  TrendingUp,
  Users,
} from 'lucide-react'
import type { FC } from 'react'
import type { Market } from '@/lib/types/market'
import { cn } from '@/lib/utils/cn'
import {
  formatTimeRemaining,
  formatTraders,
  formatVolume,
} from '@/lib/utils/format'
import { getCategoryEmoji, getCategoryGradient } from '@/lib/utils/gradients'

interface MarketCardProps {
  market: Market
}

export const MarketCard: FC<MarketCardProps> = ({ market }) => {
  const timeRemaining = formatTimeRemaining(market.close_time)
  const isClosingSoon =
    timeRemaining.includes('h ') || timeRemaining.includes('m ')
  const gradient = getCategoryGradient(market.category)
  const emoji = getCategoryEmoji(market.category)

  const handleBuyYes = () => {
    window.open(market.kalshi_url, '_blank')
  }

  const handleBuyNo = () => {
    window.open(market.kalshi_url, '_blank')
  }

  return (
    <div className="relative flex h-screen w-full shrink-0 snap-start flex-col overflow-hidden">
      <div className={cn('absolute inset-0 bg-gradient-to-b', gradient)} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_0%,rgba(0,0,0,0.4)_100%)]" />

      <div className="relative z-10 flex flex-1 flex-col justify-between p-4 pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-white/10 px-3 py-1 font-medium text-xs capitalize backdrop-blur-sm">
              {emoji} {market.category}
            </span>
            {isClosingSoon && (
              <span className="flex items-center gap-1 rounded-full bg-red-500/20 px-3 py-1 font-medium text-red-300 text-xs backdrop-blur-sm">
                <Clock className="h-3 w-3" />
                Closing soon
              </span>
            )}
          </div>
          <span className="flex items-center gap-1 text-white/60 text-xs">
            <Clock className="h-3 w-3" />
            {timeRemaining}
          </span>
        </div>

        <div className="my-auto space-y-6">
          <div className="space-y-2">
            <h2 className="font-bold text-2xl text-white leading-tight drop-shadow-lg">
              {market.title}
            </h2>
            <p className="text-sm text-white/60">{market.subtitle}</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm text-white/80">
                Probability
              </span>
              <div className="flex items-center gap-1">
                {market.price_change_24h > 0 ? (
                  <ArrowUp className="h-3 w-3 text-yes-green" />
                ) : market.price_change_24h < 0 ? (
                  <ArrowDown className="h-3 w-3 text-no-red" />
                ) : null}
                <span
                  className={cn(
                    'font-medium text-xs',
                    market.price_change_24h > 0
                      ? 'text-yes-green'
                      : 'text-no-red',
                  )}
                >
                  {market.price_change_24h > 0 ? '+' : ''}
                  {market.price_change_24h}%
                </span>
              </div>
            </div>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="rounded-l-full bg-yes-green transition-all duration-500"
                style={{ width: `${market.yes_price}%` }}
              />
              <div
                className="rounded-r-full bg-no-red transition-all duration-500"
                style={{ width: `${market.no_price}%` }}
              />
            </div>
            <div className="flex justify-between text-sm">
              <span className="font-semibold text-yes-green">
                Yes {market.yes_price}¢
              </span>
              <span className="font-semibold text-no-red">
                No {market.no_price}¢
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-center gap-6 text-white/50 text-xs">
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" />
              {formatVolume(market.volume_24h)} 24h vol
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {formatTraders(market.traders_count)} traders
            </span>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleBuyYes}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-yes-green py-4 font-bold text-base text-white shadow-lg transition-all active:scale-95 active:bg-yes-green-dark"
            >
              Buy Yes {market.yes_price}¢
              <ExternalLink className="h-4 w-4 opacity-60" />
            </button>
            <button
              type="button"
              onClick={handleBuyNo}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-no-red py-4 font-bold text-base text-white shadow-lg transition-all active:scale-95 active:bg-no-red-dark"
            >
              Buy No {market.no_price}¢
              <ExternalLink className="h-4 w-4 opacity-60" />
            </button>
          </div>

          <p className="text-center text-[10px] text-white/30">
            Tap to place trade on Kalshi
          </p>
        </div>
      </div>
    </div>
  )
}

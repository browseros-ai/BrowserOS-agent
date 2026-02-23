import {
  Bookmark,
  CheckCircle,
  Clock,
  Flame,
  Heart,
  MessageCircle,
  Share2,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react'
import type { FC } from 'react'
import type { Market } from '@/lib/types/market'
import { formatCompact, formatDaysRemaining } from '@/lib/utils/format'

interface MarketCardProps {
  market: Market
}

export const MarketCard: FC<MarketCardProps> = ({ market }) => {
  const handleBet = () => {
    window.open(market.kalshi_url, '_blank')
  }

  return (
    <div className="relative flex h-full w-full shrink-0 snap-start flex-col overflow-hidden bg-black">
      {market.image_url && (
        <img
          src={market.image_url}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />

      {/* Right side action bar */}
      <div className="absolute right-4 bottom-36 z-20 flex flex-col items-center gap-3">
        {market.is_hot && (
          <div className="flex flex-col items-center gap-0.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/20">
              <Flame className="h-5 w-5 text-orange-400" />
            </div>
            <span className="font-semibold text-[9px] text-orange-400">
              HOT
            </span>
          </div>
        )}
        <div className="flex flex-col items-center gap-0.5">
          <Heart className="h-6 w-6 text-white" />
          <span className="font-medium text-[10px] text-white">
            {formatCompact(market.likes_count)}
          </span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <MessageCircle className="h-6 w-6 text-white" />
          <span className="font-medium text-[10px] text-white">
            {formatCompact(market.comments_count)}
          </span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <Share2 className="h-6 w-6 text-white" />
          <span className="font-medium text-[10px] text-white">
            {formatCompact(market.shares_count)}
          </span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <Bookmark className="h-6 w-6 text-white" />
          <span className="font-medium text-[10px] text-white">Save</span>
        </div>
      </div>

      {/* Bottom content overlay */}
      <div className="absolute right-0 bottom-3 left-0 z-10 px-4 pb-3">
        {/* Trending badge */}
        {market.is_trending && (
          <div className="mb-2 inline-flex items-center gap-1 rounded bg-emerald-500/90 px-2.5 py-1">
            <TrendingUp className="h-3 w-3 text-white" />
            <span className="font-bold text-[11px] text-white tracking-wide">
              TRENDING
            </span>
          </div>
        )}

        {/* Title */}
        <h2 className="mb-3 pr-16 font-bold text-white text-xl leading-tight drop-shadow-lg">
          {market.title}
        </h2>

        {/* Stats row */}
        <div className="mb-4 flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 backdrop-blur-sm">
            <TrendingUp className="h-3 w-3 text-red-400" />
            <span className="font-semibold text-white text-xs">
              {market.yes_price}% YES
            </span>
          </div>
          <div className="flex items-center gap-1 text-white/60">
            <Clock className="h-3 w-3" />
            <span className="text-xs">
              {formatDaysRemaining(market.close_time)}
            </span>
          </div>
          <div className="flex items-center gap-1 text-white/60">
            <Users className="h-3 w-3" />
            <span className="text-xs">
              {formatCompact(market.traders_count)}
            </span>
          </div>
        </div>

        {/* YES / NO buttons */}
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={handleBet}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 font-bold text-[15px] text-white transition-all active:scale-[0.97] active:brightness-90"
          >
            <CheckCircle className="h-5 w-5" />
            YES &middot; {market.yes_price}%
          </button>
          <button
            type="button"
            onClick={handleBet}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-900/80 py-3.5 font-bold text-[15px] text-white transition-all active:scale-[0.97] active:brightness-90"
          >
            <XCircle className="h-5 w-5" />
            NO &middot; {market.no_price}%
          </button>
        </div>
      </div>
    </div>
  )
}

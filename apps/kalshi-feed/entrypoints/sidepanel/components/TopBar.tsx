import { Bell, Eye, Search } from 'lucide-react'
import type { FC } from 'react'
import type { MarketCategory } from '@/lib/types/market'
import { getCategoryLabel } from '@/lib/utils/gradients'

interface TopBarProps {
  category: MarketCategory
}

export const TopBar: FC<TopBarProps> = ({ category }) => {
  return (
    <div className="flex items-center justify-between px-4 pt-3 pb-2">
      <button type="button" className="p-1">
        <Bell className="h-6 w-6 text-white/70" />
      </button>
      <div className="flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 backdrop-blur-sm">
        <Eye className="h-3.5 w-3.5 text-white/80" />
        <span className="font-medium text-sm text-white">
          {getCategoryLabel(category)}
        </span>
      </div>
      <button type="button" className="p-1">
        <Search className="h-6 w-6 text-white/70" />
      </button>
    </div>
  )
}

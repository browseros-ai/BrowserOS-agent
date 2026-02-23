import type { FC } from 'react'
import type { FeedCategory } from '@/lib/types/market'
import { cn } from '@/lib/utils/cn'

interface CategoryTabsProps {
  activeCategory: FeedCategory
  onCategoryChange: (category: FeedCategory) => void
}

const CATEGORIES: { key: FeedCategory; label: string }[] = [
  { key: 'trending', label: '\u{1F525} Trending' },
  { key: 'all', label: 'All' },
  { key: 'politics', label: '\u{1F3DB} Politics' },
  { key: 'sports', label: '\u{26BD} Sports' },
  { key: 'crypto', label: '\u{1FA99} Crypto' },
  { key: 'economics', label: '\u{1F4C8} Economics' },
  { key: 'entertainment', label: '\u{1F3AC} Entertainment' },
]

export const CategoryTabs: FC<CategoryTabsProps> = ({
  activeCategory,
  onCategoryChange,
}) => {
  return (
    <div className="flex gap-2 overflow-x-auto px-4 py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {CATEGORIES.map((cat) => (
        <button
          key={cat.key}
          type="button"
          onClick={() => onCategoryChange(cat.key)}
          className={cn(
            'shrink-0 rounded-full px-4 py-1.5 font-medium text-xs transition-all',
            activeCategory === cat.key
              ? 'bg-white text-black'
              : 'bg-white/10 text-white/70 hover:bg-white/20',
          )}
        >
          {cat.label}
        </button>
      ))}
    </div>
  )
}

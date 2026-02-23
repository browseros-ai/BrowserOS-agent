import { Home, Play, PlusSquare, Trophy, User } from 'lucide-react'
import type { FC } from 'react'

const NAV_ITEMS = [
  { icon: Home, label: 'Home' },
  { icon: Play, label: 'Feed', active: true },
  { icon: PlusSquare, label: '', isCenter: true },
  { icon: Trophy, label: 'Ranking' },
  { icon: User, label: 'Profile' },
] as const

export const BottomNav: FC = () => {
  return (
    <div className="flex h-16 items-center justify-around border-white/10 border-t bg-black/95 px-2 backdrop-blur-md">
      {NAV_ITEMS.map((item) =>
        item.isCenter ? (
          <button
            key="center"
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500"
          >
            <PlusSquare className="h-6 w-6 text-white" />
          </button>
        ) : (
          <button
            key={item.label}
            type="button"
            className="flex flex-col items-center gap-0.5"
          >
            <item.icon
              className={`h-6 w-6 ${'active' in item && item.active ? 'text-white' : 'text-white/50'}`}
            />
            <span
              className={`text-[10px] ${'active' in item && item.active ? 'font-medium text-white' : 'text-white/50'}`}
            >
              {item.label}
            </span>
          </button>
        ),
      )}
    </div>
  )
}

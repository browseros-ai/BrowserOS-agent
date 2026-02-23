import type { MarketCategory } from '@/lib/types/market'

const CATEGORY_GRADIENTS: Record<MarketCategory, string> = {
  politics: 'from-blue-900/80 via-red-900/60 to-purple-900/80',
  sports: 'from-green-900/80 via-emerald-900/60 to-teal-900/80',
  crypto: 'from-purple-900/80 via-violet-900/60 to-indigo-900/80',
  economics: 'from-amber-900/80 via-yellow-900/60 to-orange-900/80',
  entertainment: 'from-pink-900/80 via-rose-900/60 to-fuchsia-900/80',
  science: 'from-cyan-900/80 via-sky-900/60 to-blue-900/80',
  weather: 'from-sky-900/80 via-blue-900/60 to-indigo-900/80',
  tech: 'from-slate-900/80 via-zinc-900/60 to-neutral-900/80',
}

export function getCategoryGradient(category: MarketCategory): string {
  return CATEGORY_GRADIENTS[category] ?? CATEGORY_GRADIENTS.economics
}

export function getCategoryEmoji(category: MarketCategory): string {
  const emojis: Record<MarketCategory, string> = {
    politics: '\u{1F3DB}',
    sports: '\u{26BD}',
    crypto: '\u{1FA99}',
    economics: '\u{1F4C8}',
    entertainment: '\u{1F3AC}',
    science: '\u{1F52C}',
    weather: '\u{26C5}',
    tech: '\u{1F4BB}',
  }
  return emojis[category] ?? '\u{1F4CA}'
}

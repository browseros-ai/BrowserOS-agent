import type { MarketCategory } from '@/lib/types/market'

export function getCategoryLabel(category: MarketCategory): string {
  const labels: Record<MarketCategory, string> = {
    politics: 'Politics',
    sports: 'Sports',
    crypto: 'Crypto',
    economics: 'Economics',
    entertainment: 'Entertainment',
    science: 'Science',
    weather: 'Weather',
    tech: 'Tech',
    conspiracy: 'Conspiracy',
  }
  return labels[category] ?? category
}

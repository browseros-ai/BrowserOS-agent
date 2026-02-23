export type MarketCategory =
  | 'politics'
  | 'sports'
  | 'crypto'
  | 'economics'
  | 'entertainment'
  | 'science'
  | 'weather'
  | 'tech'

export interface Market {
  id: string
  ticker: string
  title: string
  subtitle: string
  category: MarketCategory
  yes_price: number
  no_price: number
  volume: number
  volume_24h: number
  open_interest: number
  close_time: string
  image_url: string | null
  kalshi_url: string
  status: 'open' | 'closed' | 'settled'
  last_price: number
  price_change_24h: number
  traders_count: number
  likes_count: number
  comments_count: number
  shares_count: number
  is_hot: boolean
  is_trending: boolean
  created_at: string
}

export interface FeedResponse {
  markets: Market[]
  cursor: string | null
  has_more: boolean
}

export type FeedCategory =
  | 'trending'
  | 'politics'
  | 'sports'
  | 'crypto'
  | 'economics'
  | 'entertainment'
  | 'all'

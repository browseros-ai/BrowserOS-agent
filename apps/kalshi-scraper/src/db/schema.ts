import {
  bigint,
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

export const markets = pgTable('markets', {
  id: uuid('id').defaultRandom().primaryKey(),
  ticker: text('ticker').notNull().unique(),
  title: text('title').notNull(),
  subtitle: text('subtitle').default(''),
  category: text('category').notNull(),
  yesPrice: integer('yes_price').notNull(),
  noPrice: integer('no_price').notNull(),
  volume: bigint('volume', { mode: 'number' }).default(0),
  volume24h: bigint('volume_24h', { mode: 'number' }).default(0),
  openInterest: bigint('open_interest', { mode: 'number' }).default(0),
  closeTime: timestamp('close_time', { withTimezone: true }),
  imageUrl: text('image_url'),
  kalshiUrl: text('kalshi_url').notNull(),
  status: text('status').notNull().default('open'),
  lastPrice: integer('last_price').default(0),
  priceChange24h: integer('price_change_24h').default(0),
  tradersCount: integer('traders_count').default(0),
  isHot: boolean('is_hot').default(false),
  isTrending: boolean('is_trending').default(false),
  feedScore: integer('feed_score').default(0),
  likesCount: integer('likes_count').default(0),
  commentsCount: integer('comments_count').default(0),
  sharesCount: integer('shares_count').default(0),
  eventTicker: text('event_ticker'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export type Market = typeof markets.$inferSelect
export type NewMarket = typeof markets.$inferInsert

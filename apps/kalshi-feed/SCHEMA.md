# Kalshi Feed — Backend API Schema

The frontend expects data from a Supabase backend. Below is the exact schema the backend should populate.

## Supabase Table: `markets`

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | Primary key |
| `ticker` | `text` | Kalshi market ticker (e.g. `KXFEDRATE-26MAR-B4.5`) |
| `title` | `text` | Market question (e.g. "Will the Fed cut rates in March 2026?") |
| `subtitle` | `text` | Short context line |
| `category` | `text` | One of: `politics`, `sports`, `crypto`, `economics`, `entertainment`, `science`, `weather`, `tech` |
| `yes_price` | `integer` | Current YES price in cents (0-100) |
| `no_price` | `integer` | Current NO price in cents (0-100, should equal 100 - yes_price) |
| `volume` | `bigint` | Total volume in cents |
| `volume_24h` | `bigint` | 24-hour volume in cents |
| `open_interest` | `bigint` | Open interest in cents |
| `close_time` | `timestamptz` | When the market closes |
| `image_url` | `text` | Optional market image URL |
| `kalshi_url` | `text` | Direct link to market on kalshi.com |
| `status` | `text` | One of: `open`, `closed`, `settled` |
| `last_price` | `integer` | Last trade price in cents |
| `price_change_24h` | `integer` | Price change in last 24h (percentage points) |
| `traders_count` | `integer` | Number of unique traders |
| `created_at` | `timestamptz` | When the market was created on Kalshi |

## API Endpoint: `GET /feed`

### Query Parameters
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `category` | `string` | `trending` | Filter by category or `trending`/`all` |
| `cursor` | `string` | `null` | Pagination cursor |
| `limit` | `integer` | `20` | Number of markets per page |

### Response Shape
```json
{
  "markets": [
    {
      "id": "uuid",
      "ticker": "KXFEDRATE-26MAR-B4.5",
      "title": "Will the Fed cut rates in March 2026?",
      "subtitle": "Federal Reserve interest rate decision",
      "category": "economics",
      "yes_price": 67,
      "no_price": 33,
      "volume": 2847293,
      "volume_24h": 482100,
      "open_interest": 1200000,
      "close_time": "2026-03-19T18:00:00Z",
      "image_url": null,
      "kalshi_url": "https://kalshi.com/markets/kxfedrate",
      "status": "open",
      "last_price": 67,
      "price_change_24h": 3,
      "traders_count": 18432,
      "created_at": "2026-01-15T00:00:00Z"
    }
  ],
  "cursor": "next_page_token_or_null",
  "has_more": true
}
```

## Feed Ranking Algorithm (for `trending`)

```
score = (
    volume_24h * 0.3
  + controversy_score * 0.25
  + recency_boost * 0.2
  + closing_soon_boost * 0.15
  + category_diversity * 0.1
)

controversy_score = 1 - abs(yes_price - 50) / 50
```

Markets closest to 50/50 with high volume rank highest.

## Kalshi Public API (data source for scraper)

Base URL: `https://api.elections.kalshi.com/trade-api/v2`

No auth required for market data:
- `GET /markets?status=open&limit=200` — all open markets
- `GET /events/{event_ticker}` — event details
- `GET /markets/{ticker}/orderbook` — live orderbook
- `GET /markets/{ticker}/trades` — trade history

## TypeScript Types

See `lib/types/market.ts` for the exact TypeScript interface the frontend uses.

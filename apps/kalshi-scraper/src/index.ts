import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { config } from './config'
import { feedRoute } from './routes/feed'
import { scrapeRoute } from './routes/scrape'

const app = new Hono()
  .use(logger())
  .use('*', cors())
  .get('/', (c) =>
    c.json({ service: '@browseros/kalshi-scraper', version: '0.1.0' }),
  )
  .get('/health', (c) => c.json({ status: 'ok' }))
  .route('/feed', feedRoute)
  .route('/scrape', scrapeRoute)
  .notFound((c) => c.json({ error: 'Not found' }, 404))
  .onError((err, c) => {
    console.error('Unhandled error:', err)
    return c.json({ error: 'Internal server error' }, 500)
  })

console.log(`
@browseros/kalshi-scraper v0.1.0

  PORT: ${config.PORT}
  DATABASE_URL: ***
  BROWSERBASE: ***

Endpoints:
  GET  /         - Service info
  GET  /health   - Health check
  GET  /feed     - Market feed (category, cursor, limit)
  POST /scrape   - Trigger scrape cycle (requires x-scrape-secret)
`)

export default {
  port: config.PORT,
  fetch: app.fetch,
}

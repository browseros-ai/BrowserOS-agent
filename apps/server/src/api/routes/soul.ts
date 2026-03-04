import { Hono } from 'hono'
import { readSoul } from '../../lib/soul'

export function createSoulRoutes() {
  return new Hono().get('/', async (c) => {
    const content = await readSoul()
    return c.json({ content })
  })
}

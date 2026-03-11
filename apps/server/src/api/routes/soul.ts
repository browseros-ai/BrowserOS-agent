import { Hono } from 'hono'
import { readSoul, writeSoul } from '../../lib/soul'

export function createSoulRoutes() {
  return new Hono()
    .get('/', async (c) => {
      const content = await readSoul()
      return c.json({ content })
    })
    .put('/', async (c) => {
      const { content } = await c.req.json<{ content: string }>()
      const result = await writeSoul(content)
      return c.json(result)
    })
}

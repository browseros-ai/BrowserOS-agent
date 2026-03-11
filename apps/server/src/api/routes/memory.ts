import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import { readMemorySnapshot, saveCoreMemory } from '../../lib/memory'

const UpdateCoreMemorySchema = z.object({
  content: z.string().max(200_000),
})

export function createMemoryRoutes() {
  return new Hono()
    .get('/', async (c) => {
      const memory = await readMemorySnapshot()
      return c.json(memory)
    })
    .put('/core', zValidator('json', UpdateCoreMemorySchema), async (c) => {
      const { content } = c.req.valid('json')
      await saveCoreMemory(content)
      return c.json({ ok: true })
    })
}

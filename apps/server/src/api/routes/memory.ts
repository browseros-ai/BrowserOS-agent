import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import { readCoreMemory, saveCoreMemory } from '../../lib/core-memory'

const SaveCoreMemorySchema = z.object({
  content: z.string(),
})

export function createMemoryRoutes() {
  return new Hono()
    .get('/core', async (c) => c.json(await readCoreMemory()))
    .put('/core', zValidator('json', SaveCoreMemorySchema), async (c) => {
      const { content } = c.req.valid('json')
      return c.json(await saveCoreMemory(content))
    })
}

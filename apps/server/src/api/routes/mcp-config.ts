import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import {
  addMcpServer,
  getMcpServers,
  McpServerEntrySchema,
  migrateMcpServers,
  removeMcpServer,
  updateMcpServer,
} from '../../lib/mcp-config'

const AddServerSchema = McpServerEntrySchema.omit({ id: true })

const UpdateServerSchema = McpServerEntrySchema.partial().omit({ id: true })

const IdParamSchema = z.object({ id: z.string().min(1) })

const MigrateSchema = z.object({
  servers: z.array(McpServerEntrySchema),
})

export function createMcpConfigRoutes() {
  return new Hono()
    .get('/', async (c) => {
      const servers = await getMcpServers()
      return c.json({ servers })
    })
    .post('/', zValidator('json', AddServerSchema), async (c) => {
      const body = c.req.valid('json')
      const server = await addMcpServer(body)
      return c.json({ server }, 201)
    })
    .patch(
      '/:id',
      zValidator('param', IdParamSchema),
      zValidator('json', UpdateServerSchema),
      async (c) => {
        const { id } = c.req.valid('param')
        const patch = c.req.valid('json')
        const server = await updateMcpServer(id, patch)
        if (!server) return c.json({ error: 'Server not found' }, 404)
        return c.json({ server })
      },
    )
    .delete('/:id', zValidator('param', IdParamSchema), async (c) => {
      const { id } = c.req.valid('param')
      const removed = await removeMcpServer(id)
      if (!removed) return c.json({ error: 'Server not found' }, 404)
      return c.json({ success: true })
    })
    .post('/migrate', zValidator('json', MigrateSchema), async (c) => {
      const { servers } = c.req.valid('json')
      const migrated = await migrateMcpServers(servers)
      return c.json({ migrated })
    })
}

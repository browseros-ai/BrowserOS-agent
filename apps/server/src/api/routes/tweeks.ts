import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import { TweeksService } from '../services/tweeks-service'

const CreateTweekSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  domain: z.string().min(1),
  url_pattern: z.string().min(1),
  script: z.string().min(1),
  script_type: z.enum(['js', 'css']).optional().default('js'),
})

const UpdateTweekSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  script: z.string().min(1).optional(),
  url_pattern: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
})

const IdParamSchema = z.object({
  id: z.string().uuid(),
})

export function createTweeksRoutes() {
  const service = new TweeksService()

  return new Hono()
    .get('/', async (c) => {
      const domain = c.req.query('domain')
      const tweeks = service.list(domain)
      return c.json({ tweeks })
    })
    .get('/match', async (c) => {
      const url = c.req.query('url')
      if (!url) {
        return c.json({ error: 'url query parameter is required' }, 400)
      }
      const tweeks = service.getMatchingTweeks(url)
      return c.json({ tweeks })
    })
    .get('/:id', zValidator('param', IdParamSchema), async (c) => {
      const { id } = c.req.valid('param')
      const tweek = service.getById(id)
      if (!tweek) {
        return c.json({ error: 'Tweek not found' }, 404)
      }
      return c.json({ tweek })
    })
    .post('/', zValidator('json', CreateTweekSchema), async (c) => {
      const input = c.req.valid('json')
      const tweek = service.create(input)
      return c.json({ tweek }, 201)
    })
    .put(
      '/:id',
      zValidator('param', IdParamSchema),
      zValidator('json', UpdateTweekSchema),
      async (c) => {
        const { id } = c.req.valid('param')
        const input = c.req.valid('json')
        const tweek = service.update(id, input)
        if (!tweek) {
          return c.json({ error: 'Tweek not found' }, 404)
        }
        return c.json({ tweek })
      },
    )
    .delete('/:id', zValidator('param', IdParamSchema), async (c) => {
      const { id } = c.req.valid('param')
      const deleted = service.delete(id)
      if (!deleted) {
        return c.json({ error: 'Tweek not found' }, 404)
      }
      return c.json({ success: true })
    })
}

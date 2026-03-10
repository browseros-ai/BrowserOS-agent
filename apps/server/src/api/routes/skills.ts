import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import {
  createSkill,
  deleteSkill,
  getSkill,
  listSkills,
  updateSkill,
} from '../../skills/service'

const CreateSkillSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  content: z.string().min(1).max(50_000),
})

const UpdateSkillSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().min(1).max(500).optional(),
  content: z.string().max(50_000).optional(),
  enabled: z.boolean().optional(),
})

export function createSkillsRoutes() {
  return new Hono()
    .get('/', async (c) => {
      const skills = await listSkills()
      return c.json({ skills })
    })
    .get('/:id', async (c) => {
      const skill = await getSkill(c.req.param('id'))
      if (!skill) return c.json({ error: 'Skill not found' }, 404)
      return c.json({ skill })
    })
    .post('/', zValidator('json', CreateSkillSchema), async (c) => {
      try {
        const skill = await createSkill(c.req.valid('json'))
        return c.json({ skill }, 201)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to create'
        return c.json({ error: msg }, 400)
      }
    })
    .put('/:id', zValidator('json', UpdateSkillSchema), async (c) => {
      try {
        const skill = await updateSkill(c.req.param('id'), c.req.valid('json'))
        return c.json({ skill })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to update'
        const status = msg.includes('not found') ? 404 : 500
        return c.json({ error: msg }, status)
      }
    })
    .delete('/:id', async (c) => {
      try {
        await deleteSkill(c.req.param('id'))
        return c.json({ ok: true })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to delete'
        const status = msg.includes('not found') ? 404 : 500
        return c.json({ error: msg }, status)
      }
    })
}

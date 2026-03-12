import { describe, it } from 'bun:test'
import assert from 'node:assert'

import { createSkillsRoutes } from '../../src/api/routes/skills'
import { getSkill } from '../../src/skills/service'

describe('skills routes', () => {
  const app = createSkillsRoutes()

  it('GET /:id returns 404 for non-existent skill (not 500 from path check)', async () => {
    const res = await app.request('/valid-skill-id')
    assert.strictEqual(res.status, 404)
    const body = await res.json()
    assert.strictEqual(body.error, 'Skill not found')
  })
})

describe('getSkill path traversal protection', () => {
  it('throws on path traversal attempts', async () => {
    await assert.rejects(() => getSkill('../../../etc/passwd'), {
      message: 'Invalid skill id',
    })
  })

  it('returns null for valid but non-existent skill ID', async () => {
    const result = await getSkill('nonexistent-skill')
    assert.strictEqual(result, null)
  })
})

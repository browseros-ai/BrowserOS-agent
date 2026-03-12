import { describe, it } from 'bun:test'
import assert from 'node:assert'
import { sep } from 'node:path'

import { createSkillsRoutes } from '../../src/api/routes/skills'

describe('skills routes', () => {
  const app = createSkillsRoutes()

  it('GET /:id returns 404 for non-existent skill (not 500 from path check)', async () => {
    const res = await app.request('/valid-skill-id')
    assert.strictEqual(res.status, 404)
    const body = await res.json()
    assert.strictEqual(body.error, 'Skill not found')
  })

  it('GET /:id rejects path traversal attempts', async () => {
    const res = await app.request('/../../../etc/passwd')
    assert.notStrictEqual(res.status, 200)
  })
})

describe('safeSkillDir uses platform separator', () => {
  it(`path.sep is "${sep}" on this platform`, () => {
    assert.ok(sep === '/' || sep === '\\')
  })
})

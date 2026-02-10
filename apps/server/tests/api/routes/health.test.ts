/**
 * @license
 * Copyright 2025 BrowserOS
 */

import { describe, it } from 'bun:test'
import assert from 'node:assert'

import { createHealthRoute } from '../../../src/api/routes/health'

describe('createHealthRoute', () => {
  it('returns status ok', async () => {
    const route = createHealthRoute()
    const response = await route.request('/')

    assert.strictEqual(response.status, 200)
    const body = (await response.json()) as { status: string; uptime: number }
    assert.strictEqual(body.status, 'ok')
    assert.strictEqual(typeof body.uptime, 'number')
    assert.ok(body.uptime >= 0)
  })
})

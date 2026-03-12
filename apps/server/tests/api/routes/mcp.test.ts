/**
 * @license
 * Copyright 2025 BrowserOS
 */

import { describe, it } from 'bun:test'
import assert from 'node:assert'

import { createMcpRoutes } from '../../../src/api/routes/mcp'

describe('createMcpRoutes', () => {
  const route = createMcpRoutes({
    version: '0.0.0-test',
    registry: {} as any,
    browser: {} as any,
    executionDir: '/tmp',
    resourcesDir: '/tmp',
  })

  it('GET / returns status ok with message', async () => {
    const response = await route.request('/')

    assert.strictEqual(response.status, 200)
    const body = await response.json()
    assert.strictEqual(body.status, 'ok')
    assert.strictEqual(
      body.message,
      'MCP server is running. Use POST to interact.',
    )
  })
})

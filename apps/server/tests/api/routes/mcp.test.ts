/**
 * @license
 * Copyright 2025 BrowserOS
 */

import { describe, it } from 'bun:test'
import assert from 'node:assert'
import { createMcpRoutes } from '../../../src/api/routes/mcp'
import type { Browser } from '../../../src/browser/browser'
import type { ToolRegistry } from '../../../src/tools/tool-registry'

function createDeps() {
  return {
    version: 'test',
    registry: {
      all: () => [],
      names: () => [],
    } as unknown as ToolRegistry,
    browser: {} as unknown as Browser,
    executionDir: '/tmp',
    resourcesDir: '/tmp',
  }
}

describe('createMcpRoutes', () => {
  it('returns status info for plain GET requests', async () => {
    const route = createMcpRoutes(createDeps())
    const response = await route.request('/')

    assert.strictEqual(response.status, 200)
    const body = await response.json()
    assert.deepStrictEqual(body, {
      status: 'ok',
      message:
        'MCP server is running. Use POST for JSON-RPC requests. GET with Accept: text/event-stream is reserved for SSE streaming.',
    })
  })

  it('preserves SSE GET handling for MCP clients', async () => {
    const route = createMcpRoutes(createDeps())
    const response = await route.request('/', {
      headers: {
        Accept: 'text/event-stream',
      },
    })

    assert.strictEqual(response.status, 200)
    assert.ok(
      response.headers.get('content-type')?.includes('text/event-stream'),
    )
    await response.body?.cancel()
  })
})

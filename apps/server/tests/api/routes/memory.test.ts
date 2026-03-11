/**
 * @license
 * Copyright 2025 BrowserOS
 */

import { beforeEach, describe, it, mock } from 'bun:test'
import assert from 'node:assert'

const readCoreMemory = mock(async () => ({
  content: '',
  exists: false,
  updatedAt: null,
}))

const saveCoreMemory = mock(async (content: string) => ({
  content,
  exists: true,
  updatedAt: '2026-03-11T00:00:00.000Z',
}))

describe('createMemoryRoutes', () => {
  beforeEach(() => {
    readCoreMemory.mockReset()
    saveCoreMemory.mockReset()

    mock.module('../../../src/lib/core-memory', () => ({
      readCoreMemory,
      saveCoreMemory,
    }))
  })

  it('returns the core memory document payload', async () => {
    readCoreMemory.mockResolvedValue({
      content: '# Core memory\n\n- prefers concise answers',
      exists: true,
      updatedAt: '2026-03-11T16:00:00.000Z',
    })

    const { createMemoryRoutes } = await import(
      '../../../src/api/routes/memory'
    )
    const route = createMemoryRoutes()
    const response = await route.request('/core')
    const body = await response.json()

    assert.strictEqual(response.status, 200)
    assert.deepStrictEqual(body, {
      content: '# Core memory\n\n- prefers concise answers',
      exists: true,
      updatedAt: '2026-03-11T16:00:00.000Z',
    })
    assert.strictEqual(readCoreMemory.mock.calls.length, 1)
  })

  it('writes the full core memory document', async () => {
    saveCoreMemory.mockResolvedValue({
      content: '# Updated core memory',
      exists: true,
      updatedAt: '2026-03-11T16:15:00.000Z',
    })

    const { createMemoryRoutes } = await import(
      '../../../src/api/routes/memory'
    )
    const route = createMemoryRoutes()
    const response = await route.request('/core', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: '# Updated core memory',
      }),
    })
    const body = await response.json()

    assert.strictEqual(response.status, 200)
    assert.deepStrictEqual(body, {
      content: '# Updated core memory',
      exists: true,
      updatedAt: '2026-03-11T16:15:00.000Z',
    })
    assert.deepStrictEqual(saveCoreMemory.mock.calls[0], [
      '# Updated core memory',
    ])
  })
})

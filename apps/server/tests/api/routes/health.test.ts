/**
 * @license
 * Copyright 2025 BrowserOS
 */

import { describe, it, mock } from 'bun:test'
import assert from 'node:assert'

import { createHealthRoute } from '../../../src/api/routes/health'
import type { HealthWatchdog } from '../../../src/lib/health-watchdog'

describe('createHealthRoute', () => {
  describe('without watchdog', () => {
    it('returns status ok', async () => {
      const route = createHealthRoute()
      const response = await route.request('/')

      assert.strictEqual(response.status, 200)
      const body = await response.json()
      assert.deepStrictEqual(body, { status: 'ok' })
    })
  })

  describe('with watchdog', () => {
    it('returns status ok and records health check', async () => {
      const mockRecordHealthCheck = mock(() => {})
      const mockWatchdog = {
        recordHealthCheck: mockRecordHealthCheck,
      } as unknown as HealthWatchdog

      const route = createHealthRoute({ watchdog: mockWatchdog })
      const response = await route.request('/')

      assert.strictEqual(response.status, 200)
      const body = await response.json()
      assert.deepStrictEqual(body, { status: 'ok' })

      // Verify watchdog was notified
      assert.strictEqual(
        mockRecordHealthCheck.mock.calls.length,
        1,
        'recordHealthCheck should be called once',
      )
    })

    it('records health check on every request', async () => {
      const mockRecordHealthCheck = mock(() => {})
      const mockWatchdog = {
        recordHealthCheck: mockRecordHealthCheck,
      } as unknown as HealthWatchdog

      const route = createHealthRoute({ watchdog: mockWatchdog })

      await route.request('/')
      await route.request('/')
      await route.request('/')

      assert.strictEqual(
        mockRecordHealthCheck.mock.calls.length,
        3,
        'recordHealthCheck should be called for each request',
      )
    })
  })
})

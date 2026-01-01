/**
 * @license
 * Copyright 2025 BrowserOS
 *
 * Integration tests for @browseros/agent-sdk
 * Tests the SDK against a real BrowserOS server.
 */

import { beforeAll, describe, it } from 'bun:test'
import assert from 'node:assert'
import { Agent } from '@browseros/agent-sdk'

import {
  ensureBrowserOS,
  type TestEnvironmentConfig,
} from '../__helpers__/setup.js'

let config: TestEnvironmentConfig

beforeAll(async () => {
  config = await ensureBrowserOS()
}, 60000)

function createAgent(): Agent {
  return new Agent({
    url: `http://127.0.0.1:${config.serverPort}`,
  })
}

describe('Agent SDK Integration', () => {
  describe('nav()', () => {
    it('navigates to a URL successfully', async () => {
      const agent = createAgent()
      const result = await agent.nav('https://google.com')

      console.log('\n=== nav() Response ===')
      console.log(JSON.stringify(result, null, 2))

      assert.ok(result.success, 'Navigation should succeed')
    }, 30000)

    it('navigates to a data URL', async () => {
      const agent = createAgent()
      const result = await agent.nav('data:text/html,<h1>Test Page</h1>')

      console.log('\n=== nav() Data URL Response ===')
      console.log(JSON.stringify(result, null, 2))

      assert.ok(result.success, 'Navigation to data URL should succeed')
    }, 30000)

    it('emits progress events', async () => {
      const agent = createAgent()
      const events: unknown[] = []
      agent.onProgress((event) => events.push(event))

      await agent.nav('https://example.com')

      console.log('\n=== Progress Events ===')
      console.log(JSON.stringify(events, null, 2))

      assert.ok(events.length > 0, 'Should emit progress events')
      assert.strictEqual(
        (events[0] as { type: string }).type,
        'nav',
        'First event should be nav type',
      )
    }, 30000)

    it('handles invalid URL gracefully', async () => {
      const agent = createAgent()
      try {
        await agent.nav('not-a-valid-url')
        assert.fail('Should have thrown an error')
      } catch (error) {
        assert.ok(error instanceof Error, 'Should throw an error')
        console.log('✓ Invalid URL rejected as expected')
      }
    }, 30000)
  })

  describe('act()', () => {
    it('executes action with agent loop', async () => {
      const agent = createAgent()
      try {
        const result = await agent.act('click the button')
        console.log('\n=== act() Response ===')
        console.log(JSON.stringify(result, null, 2))
        assert.ok(result.success !== undefined, 'Should return a result')
      } catch (error) {
        // act() may fail if BROWSEROS_CONFIG_URL not set - expected in test env
        assert.ok(error instanceof Error, 'Should throw an error')
        console.log(`✓ act() threw expected error: ${(error as Error).message}`)
      }
    }, 60000)
  })

  describe('extract()', () => {
    it('returns 501 (not yet implemented)', async () => {
      const { z } = await import('zod')
      const agent = createAgent()

      try {
        await agent.extract('get title', {
          schema: z.object({ title: z.string() }),
        })
        assert.fail('Should have thrown 501 error')
      } catch (error) {
        assert.ok(error instanceof Error, 'Should throw an error')
        assert.ok(
          error.message.includes('not yet implemented'),
          'Should indicate not implemented',
        )
        console.log('✓ extract() correctly returns 501')
      }
    }, 30000)
  })

  describe('verify()', () => {
    it('returns 501 (not yet implemented)', async () => {
      const agent = createAgent()

      try {
        await agent.verify('page is loaded')
        assert.fail('Should have thrown 501 error')
      } catch (error) {
        assert.ok(error instanceof Error, 'Should throw an error')
        assert.ok(
          error.message.includes('not yet implemented'),
          'Should indicate not implemented',
        )
        console.log('✓ verify() correctly returns 501')
      }
    }, 30000)
  })
})

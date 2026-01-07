/**
 * @license
 * Copyright 2025 BrowserOS
 *
 * Integration tests for @browseros-ai/agent-sdk
 * Tests the SDK against a real BrowserOS server.
 */

import { beforeAll, describe, it } from 'bun:test'
import assert from 'node:assert'
import { Agent } from '@browseros-ai/agent-sdk'

import {
  ensureBrowserOS,
  type TestEnvironmentConfig,
} from '../__helpers__/setup'

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
    it('clicks a button on a test page', async () => {
      const agent = createAgent()

      // Navigate to a simple test page with a button
      await agent.nav(
        'data:text/html,<button id="btn" onclick="this.textContent=\'Clicked!\'">Click me</button>',
      )

      const result = await agent.act('click the button')

      console.log('\n=== act() Response ===')
      console.log(JSON.stringify(result, null, 2))

      assert.ok(result.success, 'Action should succeed')
    }, 60000)

    it('emits progress events during action', async () => {
      const agent = createAgent()
      const events: unknown[] = []
      agent.onProgress((event) => events.push(event))

      await agent.nav('data:text/html,<h1>Test</h1>')
      await agent.act('describe what you see')

      console.log('\n=== act() Progress Events ===')
      console.log(JSON.stringify(events, null, 2))

      const actEvents = events.filter(
        (e) => (e as { type: string }).type === 'act',
      )
      assert.ok(actEvents.length > 0, 'Should emit act progress events')
    }, 60000)
  })

  describe('extract()', () => {
    it('extracts structured data from page', async () => {
      const { z } = await import('zod')
      const agent = createAgent()

      await agent.nav(
        'data:text/html,<h1>Welcome to My Site</h1><p>This is a test page.</p>',
      )

      const result = await agent.extract('get the page title', {
        schema: z.object({ title: z.string() }),
      })

      console.log('\n=== extract() Response ===')
      console.log(JSON.stringify(result, null, 2))

      assert.ok(result.data, 'Should return extracted data')
      assert.ok(
        typeof result.data.title === 'string',
        'Title should be a string',
      )
    }, 60000)
  })

  describe('verify()', () => {
    it('verifies page state', async () => {
      const agent = createAgent()

      await agent.nav('data:text/html,<h1>Hello World</h1>')

      const result = await agent.verify(
        'the page contains a heading that says Hello World',
      )

      console.log('\n=== verify() Response ===')
      console.log(JSON.stringify(result, null, 2))

      assert.ok(
        typeof result.success === 'boolean',
        'Should return success boolean',
      )
      assert.ok(
        typeof result.reason === 'string',
        'Should return reason string',
      )
    }, 60000)
  })
})

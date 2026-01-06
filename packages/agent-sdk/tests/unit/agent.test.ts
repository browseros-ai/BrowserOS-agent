import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { Agent } from '../../src/agent'
import {
  ActionError,
  ConnectionError,
  ExtractionError,
  NavigationError,
  VerificationError,
} from '../../src/errors'
import type { ProgressEvent } from '../../src/types'

const TEST_URL = 'http://localhost:9222'

function mockFetch(response: unknown, status = 200) {
  return mock(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(response),
    } as Response),
  )
}

function mockFetchError(error: Error) {
  return mock(() => Promise.reject(error))
}

describe('Agent', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe('constructor', () => {
    it('creates agent with url', () => {
      const agent = new Agent({ url: TEST_URL })
      expect(agent).toBeDefined()
    })

    it('creates agent with url and llm config', () => {
      const agent = new Agent({
        url: TEST_URL,
        llm: { provider: 'openai', model: 'gpt-4o', apiKey: 'sk-test' },
      })
      expect(agent).toBeDefined()
    })

    it('strips trailing slash from url', () => {
      const fetchMock = mockFetch({ success: true })
      globalThis.fetch = fetchMock

      const agent = new Agent({ url: 'http://localhost:9222/' })
      agent.nav('https://example.com')

      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:9222/sdk/nav',
        expect.any(Object),
      )
    })
  })

  describe('nav()', () => {
    it('sends correct request to /sdk/nav', async () => {
      const fetchMock = mockFetch({ success: true })
      globalThis.fetch = fetchMock

      const agent = new Agent({ url: TEST_URL })
      await agent.nav('https://example.com')

      expect(fetchMock).toHaveBeenCalledWith('http://localhost:9222/sdk/nav', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com' }),
      })
    })

    it('includes tabId and windowId options', async () => {
      const fetchMock = mockFetch({ success: true })
      globalThis.fetch = fetchMock

      const agent = new Agent({ url: TEST_URL })
      await agent.nav('https://example.com', { tabId: 123, windowId: 456 })

      expect(fetchMock).toHaveBeenCalledWith('http://localhost:9222/sdk/nav', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://example.com',
          tabId: 123,
          windowId: 456,
        }),
      })
    })

    it('returns NavResult on success', async () => {
      globalThis.fetch = mockFetch({ success: true })

      const agent = new Agent({ url: TEST_URL })
      const result = await agent.nav('https://example.com')

      expect(result).toEqual({ success: true })
    })

    it('throws NavigationError on failure', async () => {
      globalThis.fetch = mockFetch(
        { error: { message: 'Navigation failed' } },
        500,
      )

      const agent = new Agent({ url: TEST_URL })

      await expect(agent.nav('https://example.com')).rejects.toThrow(
        NavigationError,
      )
    })

    it('throws ConnectionError when fetch fails', async () => {
      globalThis.fetch = mockFetchError(new Error('Network error'))

      const agent = new Agent({ url: TEST_URL })

      await expect(agent.nav('https://example.com')).rejects.toThrow(
        ConnectionError,
      )
    })

    it('emits nav progress event', async () => {
      globalThis.fetch = mockFetch({ success: true })

      const events: ProgressEvent[] = []
      const agent = new Agent({
        url: TEST_URL,
        onProgress: (e) => events.push(e),
      })

      await agent.nav('https://example.com')

      expect(events).toHaveLength(1)
      expect(events[0]).toEqual({
        type: 'nav',
        message: 'Navigating to https://example.com',
        metadata: { url: 'https://example.com' },
      })
    })
  })

  describe('act()', () => {
    it('sends correct request to /sdk/act', async () => {
      const fetchMock = mockFetch({ success: true, steps: [] })
      globalThis.fetch = fetchMock

      const agent = new Agent({ url: TEST_URL })
      await agent.act('click the button')

      expect(fetchMock).toHaveBeenCalledWith('http://localhost:9222/sdk/act', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction: 'click the button',
          context: undefined,
          maxSteps: undefined,
          windowId: undefined,
          llm: undefined,
        }),
      })
    })

    it('includes context, maxSteps, and windowId options', async () => {
      const fetchMock = mockFetch({ success: true, steps: [] })
      globalThis.fetch = fetchMock

      const agent = new Agent({ url: TEST_URL })
      await agent.act('search for item', {
        context: { query: 'headphones' },
        maxSteps: 5,
        windowId: 789,
      })

      expect(fetchMock).toHaveBeenCalledWith('http://localhost:9222/sdk/act', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction: 'search for item',
          context: { query: 'headphones' },
          maxSteps: 5,
          windowId: 789,
          llm: undefined,
        }),
      })
    })

    it('includes llm config from constructor', async () => {
      const fetchMock = mockFetch({ success: true, steps: [] })
      globalThis.fetch = fetchMock

      const llmConfig = {
        provider: 'openai' as const,
        model: 'gpt-4o',
        apiKey: 'sk-test',
      }
      const agent = new Agent({ url: TEST_URL, llm: llmConfig })
      await agent.act('click the button')

      expect(fetchMock).toHaveBeenCalledWith('http://localhost:9222/sdk/act', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction: 'click the button',
          context: undefined,
          maxSteps: undefined,
          windowId: undefined,
          llm: llmConfig,
        }),
      })
    })

    it('returns ActResult on success', async () => {
      const mockResult = {
        success: true,
        steps: [
          {
            thought: 'I need to click the button',
            toolCalls: [{ name: 'browser_click', args: { nodeId: 1 } }],
          },
        ],
      }
      globalThis.fetch = mockFetch(mockResult)

      const agent = new Agent({ url: TEST_URL })
      const result = await agent.act('click the button')

      expect(result).toEqual(mockResult)
    })

    it('throws ActionError on failure', async () => {
      globalThis.fetch = mockFetch({ error: { message: 'Action failed' } }, 500)

      const agent = new Agent({ url: TEST_URL })

      await expect(agent.act('click the button')).rejects.toThrow(ActionError)
    })

    it('emits act progress event', async () => {
      globalThis.fetch = mockFetch({ success: true, steps: [] })

      const events: ProgressEvent[] = []
      const agent = new Agent({
        url: TEST_URL,
        onProgress: (e) => events.push(e),
      })

      await agent.act('click the button')

      expect(events).toHaveLength(1)
      expect(events[0]).toEqual({
        type: 'act',
        message: 'click the button',
        metadata: { instruction: 'click the button' },
      })
    })
  })

  describe('extract()', () => {
    const productSchema = z.object({
      name: z.string(),
      price: z.number(),
    })

    it('sends correct request with JSON Schema to /sdk/extract', async () => {
      const fetchMock = mockFetch({ data: { name: 'Test', price: 99 } })
      globalThis.fetch = fetchMock

      const agent = new Agent({ url: TEST_URL })
      await agent.extract('get product info', { schema: productSchema })

      const expectedJsonSchema = zodToJsonSchema(productSchema)
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:9222/sdk/extract',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instruction: 'get product info',
            schema: expectedJsonSchema,
            context: undefined,
            llm: undefined,
          }),
        },
      )
    })

    it('includes context option', async () => {
      const fetchMock = mockFetch({ data: { name: 'Test', price: 99 } })
      globalThis.fetch = fetchMock

      const agent = new Agent({ url: TEST_URL })
      await agent.extract('get product info', {
        schema: productSchema,
        context: { format: 'USD' },
      })

      const expectedJsonSchema = zodToJsonSchema(productSchema)
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:9222/sdk/extract',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instruction: 'get product info',
            schema: expectedJsonSchema,
            context: { format: 'USD' },
            llm: undefined,
          }),
        },
      )
    })

    it('includes llm config from constructor', async () => {
      const fetchMock = mockFetch({ data: { name: 'Test', price: 99 } })
      globalThis.fetch = fetchMock

      const llmConfig = {
        provider: 'anthropic' as const,
        model: 'claude-3',
        apiKey: 'key',
      }
      const agent = new Agent({ url: TEST_URL, llm: llmConfig })
      await agent.extract('get product info', { schema: productSchema })

      const expectedJsonSchema = zodToJsonSchema(productSchema)
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:9222/sdk/extract',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instruction: 'get product info',
            schema: expectedJsonSchema,
            context: undefined,
            llm: llmConfig,
          }),
        },
      )
    })

    it('returns ExtractResult on success', async () => {
      const mockData = { name: 'Headphones', price: 99.99 }
      globalThis.fetch = mockFetch({ data: mockData })

      const agent = new Agent({ url: TEST_URL })
      const result = await agent.extract('get product info', {
        schema: productSchema,
      })

      expect(result).toEqual({ data: mockData })
    })

    it('throws ExtractionError on failure', async () => {
      globalThis.fetch = mockFetch(
        { error: { message: 'Extraction failed' } },
        422,
      )

      const agent = new Agent({ url: TEST_URL })

      await expect(
        agent.extract('get product info', { schema: productSchema }),
      ).rejects.toThrow(ExtractionError)
    })

    it('emits extract progress event', async () => {
      globalThis.fetch = mockFetch({ data: { name: 'Test', price: 99 } })

      const events: ProgressEvent[] = []
      const agent = new Agent({
        url: TEST_URL,
        onProgress: (e) => events.push(e),
      })

      await agent.extract('get product info', { schema: productSchema })

      expect(events).toHaveLength(1)
      expect(events[0]).toEqual({
        type: 'extract',
        message: 'get product info',
        metadata: { instruction: 'get product info' },
      })
    })
  })

  describe('verify()', () => {
    it('sends correct request to /sdk/verify', async () => {
      const fetchMock = mockFetch({ success: true, reason: 'Element visible' })
      globalThis.fetch = fetchMock

      const agent = new Agent({ url: TEST_URL })
      await agent.verify('search results are visible')

      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:9222/sdk/verify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            expectation: 'search results are visible',
            context: undefined,
            llm: undefined,
          }),
        },
      )
    })

    it('includes context option', async () => {
      const fetchMock = mockFetch({ success: true, reason: 'Element visible' })
      globalThis.fetch = fetchMock

      const agent = new Agent({ url: TEST_URL })
      await agent.verify('price is correct', { context: { expected: 99.99 } })

      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:9222/sdk/verify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            expectation: 'price is correct',
            context: { expected: 99.99 },
            llm: undefined,
          }),
        },
      )
    })

    it('includes llm config from constructor', async () => {
      const fetchMock = mockFetch({ success: true, reason: 'Verified' })
      globalThis.fetch = fetchMock

      const llmConfig = { provider: 'google' as const, model: 'gemini-pro' }
      const agent = new Agent({ url: TEST_URL, llm: llmConfig })
      await agent.verify('page loaded')

      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:9222/sdk/verify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            expectation: 'page loaded',
            context: undefined,
            llm: llmConfig,
          }),
        },
      )
    })

    it('returns VerifyResult on success', async () => {
      globalThis.fetch = mockFetch({
        success: true,
        reason: 'Search results found',
      })

      const agent = new Agent({ url: TEST_URL })
      const result = await agent.verify('search results are visible')

      expect(result).toEqual({ success: true, reason: 'Search results found' })
    })

    it('returns VerifyResult with success=false when verification fails', async () => {
      globalThis.fetch = mockFetch({
        success: false,
        reason: 'No search results found',
      })

      const agent = new Agent({ url: TEST_URL })
      const result = await agent.verify('search results are visible')

      expect(result).toEqual({
        success: false,
        reason: 'No search results found',
      })
    })

    it('throws VerificationError on server error', async () => {
      globalThis.fetch = mockFetch(
        { error: { message: 'Verification failed' } },
        500,
      )

      const agent = new Agent({ url: TEST_URL })

      await expect(agent.verify('search results are visible')).rejects.toThrow(
        VerificationError,
      )
    })

    it('emits verify progress event', async () => {
      globalThis.fetch = mockFetch({ success: true, reason: 'Verified' })

      const events: ProgressEvent[] = []
      const agent = new Agent({
        url: TEST_URL,
        onProgress: (e) => events.push(e),
      })

      await agent.verify('page loaded')

      expect(events).toHaveLength(1)
      expect(events[0]).toEqual({
        type: 'verify',
        message: 'page loaded',
        metadata: { expectation: 'page loaded' },
      })
    })
  })

  describe('onProgress()', () => {
    it('allows setting progress callback after construction', async () => {
      globalThis.fetch = mockFetch({ success: true })

      const events: ProgressEvent[] = []
      const agent = new Agent({ url: TEST_URL })
      agent.onProgress((e) => events.push(e))

      await agent.nav('https://example.com')

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('nav')
    })

    it('replaces previous callback', async () => {
      globalThis.fetch = mockFetch({ success: true })

      const events1: ProgressEvent[] = []
      const events2: ProgressEvent[] = []
      const agent = new Agent({
        url: TEST_URL,
        onProgress: (e) => events1.push(e),
      })

      agent.onProgress((e) => events2.push(e))
      await agent.nav('https://example.com')

      expect(events1).toHaveLength(0)
      expect(events2).toHaveLength(1)
    })
  })

  describe('error handling', () => {
    it('includes status code in error', async () => {
      globalThis.fetch = mockFetch({ error: { message: 'Not found' } }, 404)

      const agent = new Agent({ url: TEST_URL })

      try {
        await agent.nav('https://example.com')
      } catch (error) {
        expect(error).toBeInstanceOf(NavigationError)
        expect((error as NavigationError).statusCode).toBe(404)
      }
    })

    it('extracts error message from response body', async () => {
      globalThis.fetch = mockFetch(
        { error: { message: 'Custom error message' } },
        400,
      )

      const agent = new Agent({ url: TEST_URL })

      try {
        await agent.nav('https://example.com')
      } catch (error) {
        expect(error).toBeInstanceOf(NavigationError)
        expect((error as NavigationError).message).toBe('Custom error message')
      }
    })

    it('uses default error message when body parse fails', async () => {
      globalThis.fetch = mock(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.reject(new Error('Invalid JSON')),
        } as Response),
      )

      const agent = new Agent({ url: TEST_URL })

      try {
        await agent.nav('https://example.com')
      } catch (error) {
        expect(error).toBeInstanceOf(NavigationError)
        expect((error as NavigationError).message).toBe(
          'Request failed with status 500',
        )
      }
    })
  })
})

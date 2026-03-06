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
import type { UIMessageStreamEvent } from '../../src/types'

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

function mockSSEFetch(events: UIMessageStreamEvent[], status = 200) {
  const sseData = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('')
  const encoder = new TextEncoder()
  const encoded = encoder.encode(sseData)

  return mock(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      body: {
        getReader: () => {
          let read = false
          return {
            read: async () => {
              if (read) return { done: true, value: undefined }
              read = true
              return { done: false, value: encoded }
            },
            releaseLock: () => {},
          }
        },
      },
    } as unknown as Response),
  )
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

    it('generates sessionId when stateful mode is enabled', () => {
      const agent = new Agent({ url: TEST_URL, stateful: true })
      expect(agent.sessionId).not.toBeNull()
    })

    it('does not generate sessionId when stateful mode is disabled', () => {
      const agent = new Agent({ url: TEST_URL, stateful: false })
      expect(agent.sessionId).toBeNull()
    })
  })

  describe('nav()', () => {
    it('sends correct request to /sdk/nav', async () => {
      const fetchMock = mockFetch({ success: true })
      globalThis.fetch = fetchMock

      const agent = new Agent({ url: TEST_URL })
      await agent.nav('https://example.com')

      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:9222/sdk/nav',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      )

      const call = fetchMock.mock.calls[0]
      const body = JSON.parse(call[1].body)
      expect(body.url).toBe('https://example.com')
    })

    it('includes tabId and windowId options', async () => {
      const fetchMock = mockFetch({ success: true })
      globalThis.fetch = fetchMock

      const agent = new Agent({ url: TEST_URL })
      await agent.nav('https://example.com', { tabId: 123, windowId: 456 })

      const call = fetchMock.mock.calls[0]
      const body = JSON.parse(call[1].body)
      expect(body.url).toBe('https://example.com')
      expect(body.tabId).toBe(123)
      expect(body.windowId).toBe(456)
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

    it('emits UIMessageStreamEvents', async () => {
      globalThis.fetch = mockFetch({ success: true })

      const events: UIMessageStreamEvent[] = []
      const agent = new Agent({
        url: TEST_URL,
        onProgress: (e) => events.push(e),
      })

      await agent.nav('https://example.com')

      expect(events.length).toBeGreaterThan(0)
      expect(events[0]).toEqual({ type: 'start-step' })
      expect(events[events.length - 1]).toEqual({ type: 'finish-step' })
    })
  })

  describe('act()', () => {
    it('sends correct request to /sdk/act', async () => {
      const fetchMock = mockSSEFetch([
        { type: 'start-step' },
        { type: 'finish-step' },
      ])
      globalThis.fetch = fetchMock

      const agent = new Agent({ url: TEST_URL })
      await agent.act('click the button')

      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:9222/sdk/act',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      )

      const call = fetchMock.mock.calls[0]
      const body = JSON.parse(call[1].body)
      expect(body.instruction).toBe('click the button')
      expect(body.sessionId).toBeDefined()
    })

    it('includes context and maxSteps options', async () => {
      const fetchMock = mockSSEFetch([
        { type: 'start-step' },
        { type: 'finish-step' },
      ])
      globalThis.fetch = fetchMock

      const agent = new Agent({ url: TEST_URL })
      await agent.act('search for item', {
        context: { query: 'headphones' },
        maxSteps: 5,
      })

      const call = fetchMock.mock.calls[0]
      const body = JSON.parse(call[1].body)
      expect(body.instruction).toBe('search for item')
      expect(body.context).toEqual({ query: 'headphones' })
      expect(body.maxSteps).toBe(5)
    })

    it('includes llm config from constructor', async () => {
      const fetchMock = mockSSEFetch([
        { type: 'start-step' },
        { type: 'finish-step' },
      ])
      globalThis.fetch = fetchMock

      const llmConfig = {
        provider: 'openai' as const,
        model: 'gpt-4o',
        apiKey: 'sk-test',
      }
      const agent = new Agent({ url: TEST_URL, llm: llmConfig })
      await agent.act('click the button')

      const call = fetchMock.mock.calls[0]
      const body = JSON.parse(call[1].body)
      expect(body.llm).toEqual(llmConfig)
    })

    it('returns ActResult with steps from SSE stream', async () => {
      const fetchMock = mockSSEFetch([
        { type: 'start-step' },
        {
          type: 'text-delta',
          delta: 'I need to click the button',
          id: 'thought',
        },
        {
          type: 'tool-input-available',
          toolCallId: '1',
          toolName: 'browser_click',
          input: { nodeId: 1 },
        },
        {
          type: 'tool-output-available',
          toolCallId: '1',
          output: { success: true },
        },
        { type: 'finish-step' },
      ])
      globalThis.fetch = fetchMock

      const agent = new Agent({ url: TEST_URL })
      const result = await agent.act('click the button')

      expect(result.success).toBe(true)
      expect(result.steps).toHaveLength(1)
      expect(result.steps[0].thought).toBe('I need to click the button')
      expect(result.steps[0].toolCalls).toHaveLength(1)
      expect(result.steps[0].toolCalls?.[0].name).toBe('browser_click')
    })

    it('throws ActionError on failure', async () => {
      globalThis.fetch = mockFetch({ error: { message: 'Action failed' } }, 500)

      const agent = new Agent({ url: TEST_URL })

      await expect(agent.act('click the button')).rejects.toThrow(ActionError)
    })

    it('emits SSE events via onProgress', async () => {
      const fetchMock = mockSSEFetch([
        { type: 'start-step' },
        { type: 'text-delta', delta: 'thinking...', id: 'thought' },
        { type: 'finish-step' },
      ])
      globalThis.fetch = fetchMock

      const events: UIMessageStreamEvent[] = []
      const agent = new Agent({
        url: TEST_URL,
        onProgress: (e) => events.push(e),
      })

      await agent.act('click the button')

      expect(events).toHaveLength(3)
      expect(events[0]).toEqual({ type: 'start-step' })
      expect(events[1]).toEqual({
        type: 'text-delta',
        delta: 'thinking...',
        id: 'thought',
      })
      expect(events[2]).toEqual({ type: 'finish-step' })
    })

    it('resets sessionId when resetState is true', async () => {
      const fetchMock = mockSSEFetch([
        { type: 'start-step' },
        { type: 'finish-step' },
      ])
      globalThis.fetch = fetchMock

      const agent = new Agent({ url: TEST_URL })
      const originalSessionId = agent.sessionId

      await agent.act('click the button', { resetState: true })

      expect(agent.sessionId).not.toBe(originalSessionId)
    })
  })

  describe('act() with verify option', () => {
    it('verifies after action succeeds', async () => {
      let callCount = 0
      globalThis.fetch = mock(() => {
        callCount++
        if (callCount === 1) {
          // act() SSE response
          const encoder = new TextEncoder()
          const sseData = [{ type: 'start-step' }, { type: 'finish-step' }]
            .map((e) => `data: ${JSON.stringify(e)}\n\n`)
            .join('')
          return Promise.resolve({
            ok: true,
            status: 200,
            body: {
              getReader: () => {
                let read = false
                return {
                  read: async () => {
                    if (read) return { done: true, value: undefined }
                    read = true
                    return { done: false, value: encoder.encode(sseData) }
                  },
                  releaseLock: () => {},
                }
              },
            },
          } as unknown as Response)
        }
        // verify() JSON response
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true, reason: 'Verified' }),
        } as Response)
      })

      const agent = new Agent({ url: TEST_URL })
      const result = await agent.act('click add to cart', {
        verify: 'Cart shows 1 item',
      })

      expect(result.success).toBe(true)
      expect(callCount).toBe(2)
    })

    it('retries when verification fails', async () => {
      let callCount = 0
      globalThis.fetch = mock(() => {
        callCount++
        if (callCount === 1 || callCount === 3) {
          // act() SSE response
          const encoder = new TextEncoder()
          const sseData = [{ type: 'start-step' }, { type: 'finish-step' }]
            .map((e) => `data: ${JSON.stringify(e)}\n\n`)
            .join('')
          return Promise.resolve({
            ok: true,
            status: 200,
            body: {
              getReader: () => {
                let read = false
                return {
                  read: async () => {
                    if (read) return { done: true, value: undefined }
                    read = true
                    return { done: false, value: encoder.encode(sseData) }
                  },
                  releaseLock: () => {},
                }
              },
            },
          } as unknown as Response)
        }
        if (callCount === 2) {
          // First verify() fails
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({ success: false, reason: 'Cart is empty' }),
          } as Response)
        }
        // Second verify() succeeds
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({ success: true, reason: 'Cart has item' }),
        } as Response)
      })

      const agent = new Agent({ url: TEST_URL })
      const result = await agent.act('click add to cart', {
        verify: 'Cart shows 1 item',
        maxRetries: 1,
      })

      expect(result.success).toBe(true)
      expect(callCount).toBe(4) // act, verify(fail), act, verify(pass)
    })

    it('returns failure when all retries exhausted', async () => {
      let callCount = 0
      globalThis.fetch = mock(() => {
        callCount++
        if (callCount % 2 === 1) {
          // act() SSE response
          const encoder = new TextEncoder()
          const sseData = [{ type: 'start-step' }, { type: 'finish-step' }]
            .map((e) => `data: ${JSON.stringify(e)}\n\n`)
            .join('')
          return Promise.resolve({
            ok: true,
            status: 200,
            body: {
              getReader: () => {
                let read = false
                return {
                  read: async () => {
                    if (read) return { done: true, value: undefined }
                    read = true
                    return { done: false, value: encoder.encode(sseData) }
                  },
                  releaseLock: () => {},
                }
              },
            },
          } as unknown as Response)
        }
        // verify() always fails
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({ success: false, reason: 'Cart is empty' }),
        } as Response)
      })

      const agent = new Agent({ url: TEST_URL })
      const result = await agent.act('click add to cart', {
        verify: 'Cart shows 1 item',
        maxRetries: 2,
      })

      expect(result.success).toBe(false)
      expect(callCount).toBe(6) // (act + verify) x 3
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
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      )

      const call = fetchMock.mock.calls[0]
      const body = JSON.parse(call[1].body)
      expect(body.instruction).toBe('get product info')
      expect(body.schema).toEqual(expectedJsonSchema)
    })

    it('includes context option', async () => {
      const fetchMock = mockFetch({ data: { name: 'Test', price: 99 } })
      globalThis.fetch = fetchMock

      const agent = new Agent({ url: TEST_URL })
      await agent.extract('get product info', {
        schema: productSchema,
        context: { format: 'USD' },
      })

      const call = fetchMock.mock.calls[0]
      const body = JSON.parse(call[1].body)
      expect(body.context).toEqual({ format: 'USD' })
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

    it('emits UIMessageStreamEvents', async () => {
      globalThis.fetch = mockFetch({ data: { name: 'Test', price: 99 } })

      const events: UIMessageStreamEvent[] = []
      const agent = new Agent({
        url: TEST_URL,
        onProgress: (e) => events.push(e),
      })

      await agent.extract('get product info', { schema: productSchema })

      expect(events.length).toBeGreaterThan(0)
      expect(events[0]).toEqual({ type: 'start-step' })
      expect(events[events.length - 1]).toEqual({ type: 'finish-step' })
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
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      )

      const call = fetchMock.mock.calls[0]
      const body = JSON.parse(call[1].body)
      expect(body.expectation).toBe('search results are visible')
    })

    it('includes context option', async () => {
      const fetchMock = mockFetch({ success: true, reason: 'Element visible' })
      globalThis.fetch = fetchMock

      const agent = new Agent({ url: TEST_URL })
      await agent.verify('price is correct', { context: { expected: 99.99 } })

      const call = fetchMock.mock.calls[0]
      const body = JSON.parse(call[1].body)
      expect(body.context).toEqual({ expected: 99.99 })
    })

    it('includes llm config from constructor', async () => {
      const fetchMock = mockFetch({ success: true, reason: 'Verified' })
      globalThis.fetch = fetchMock

      const llmConfig = { provider: 'google' as const, model: 'gemini-pro' }
      const agent = new Agent({ url: TEST_URL, llm: llmConfig })
      await agent.verify('page loaded')

      const call = fetchMock.mock.calls[0]
      const body = JSON.parse(call[1].body)
      expect(body.llm).toEqual(llmConfig)
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

    it('emits UIMessageStreamEvents', async () => {
      globalThis.fetch = mockFetch({ success: true, reason: 'Verified' })

      const events: UIMessageStreamEvent[] = []
      const agent = new Agent({
        url: TEST_URL,
        onProgress: (e) => events.push(e),
      })

      await agent.verify('page loaded')

      expect(events.length).toBeGreaterThan(0)
      expect(events[0]).toEqual({ type: 'start-step' })
      expect(events[events.length - 1]).toEqual({ type: 'finish-step' })
    })
  })

  describe('onProgress()', () => {
    it('allows setting progress callback after construction', async () => {
      globalThis.fetch = mockFetch({ success: true })

      const events: UIMessageStreamEvent[] = []
      const agent = new Agent({ url: TEST_URL })
      agent.onProgress((e) => events.push(e))

      await agent.nav('https://example.com')

      expect(events.length).toBeGreaterThan(0)
      expect(events[0]).toEqual({ type: 'start-step' })
    })

    it('replaces previous callback', async () => {
      globalThis.fetch = mockFetch({ success: true })

      const events1: UIMessageStreamEvent[] = []
      const events2: UIMessageStreamEvent[] = []
      const agent = new Agent({
        url: TEST_URL,
        onProgress: (e) => events1.push(e),
      })

      agent.onProgress((e) => events2.push(e))
      await agent.nav('https://example.com')

      expect(events1).toHaveLength(0)
      expect(events2.length).toBeGreaterThan(0)
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

  describe('dispose()', () => {
    it('sends DELETE request to clean up session', async () => {
      const fetchMock = mock(() => Promise.resolve({ ok: true } as Response))
      globalThis.fetch = fetchMock

      const agent = new Agent({ url: TEST_URL })
      const sessionId = agent.sessionId

      await agent.dispose()

      expect(fetchMock).toHaveBeenCalledWith(
        `http://localhost:9222/chat/${sessionId}`,
        { method: 'DELETE' },
      )
    })

    it('does not send DELETE when stateful is false', async () => {
      const fetchMock = mock(() => Promise.resolve({ ok: true } as Response))
      globalThis.fetch = fetchMock

      const agent = new Agent({ url: TEST_URL, stateful: false })
      await agent.dispose()

      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('only disposes once', async () => {
      const fetchMock = mock(() => Promise.resolve({ ok: true } as Response))
      globalThis.fetch = fetchMock

      const agent = new Agent({ url: TEST_URL })

      await agent.dispose()
      await agent.dispose()

      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
  })
})

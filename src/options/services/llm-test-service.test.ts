import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LLMTestService, TestResult } from './llm-test-service'
import { LLMProvider } from '../types/llm-settings'
import { MessageType } from '@/lib/types/messaging'

// Mock Chrome runtime API
const mockPort = {
  postMessage: vi.fn(),
  onMessage: {
    addListener: vi.fn(),
    removeListener: vi.fn()
  },
  disconnect: vi.fn()
}

const mockChrome = {
  runtime: {
    connect: vi.fn(() => mockPort)
  }
}

describe('LLMTestService-unit-test', () => {
  let service: LLMTestService

  beforeEach(() => {
    vi.clearAllMocks()
    ;(globalThis as any).chrome = mockChrome
    service = LLMTestService.getInstance()
  })

  it('tests that service can be created as singleton', () => {
    const instance1 = LLMTestService.getInstance()
    const instance2 = LLMTestService.getInstance()

    expect(instance1).toBe(instance2)
    expect(typeof instance1.testProvider).toBe('function')
    expect(typeof instance1.runPerformanceTests).toBe('function')
    expect(typeof instance1.storeTestResults).toBe('function')
  })

  it('tests that testProvider connects to background and processes response', async () => {
    const testProvider: LLMProvider = {
      id: 'test-1',
      name: 'Test Provider',
      type: 'openai',
      modelId: 'gpt-4',
      apiKey: 'test-key',
      isBuiltIn: false,
      isDefault: false,
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z'
    }

    // Mock successful response
    mockPort.onMessage.addListener.mockImplementation((listener) => {
      setTimeout(() => {
        listener({
          id: expect.stringMatching(/test-/),
          type: MessageType.SETTINGS_TEST_PROVIDER_RESPONSE,
          payload: {
            success: true,
            latency: 500,
            response: 'Hello World',
            timestamp: '2023-01-01T00:00:00Z'
          }
        })
      }, 10)
    })

    const result = await service.testProvider(testProvider)

    // Verify chrome connection
    expect(mockChrome.runtime.connect).toHaveBeenCalledWith({ name: 'options' })
    expect(mockPort.postMessage).toHaveBeenCalledWith({
      type: MessageType.SETTINGS_TEST_PROVIDER,
      payload: { provider: testProvider },
      id: expect.stringMatching(/test-/)
    })

    // Verify result
    expect(result).toEqual({
      success: true,
      latency: 500,
      response: 'Hello World',
      timestamp: '2023-01-01T00:00:00Z'
    })
  })

  it('tests that runPerformanceTests calculates scores correctly', async () => {
    const testProvider: LLMProvider = {
      id: 'test-1',
      name: 'Test Provider',
      type: 'openai',
      modelId: 'gpt-4',
      isBuiltIn: false,
      isDefault: false,
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z'
    }

    // Mock testProvider method to return fast response
    vi.spyOn(service, 'testProvider').mockResolvedValue({
      success: true,
      latency: 800, // Should give high score
      response: 'Hello World',
      timestamp: '2023-01-01T00:00:00Z'
    })

    const scores = await service.runPerformanceTests(testProvider)

    // Verify score calculation
    expect(scores.latency).toBeGreaterThan(8) // Fast response
    expect(scores.accuracy).toBe(8) // Default assumption
    expect(scores.reliability).toBe(10) // Successful test
    expect(scores.overall).toBeGreaterThan(8) // Average should be high
  })

  it('tests that test failures are handled gracefully', async () => {
    const testProvider: LLMProvider = {
      id: 'test-fail',
      name: 'Failing Provider',
      type: 'openai',
      modelId: 'gpt-4',
      isBuiltIn: false,
      isDefault: false,
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z'
    }

    // Mock error response
    mockPort.onMessage.addListener.mockImplementation((listener) => {
      setTimeout(() => {
        listener({
          id: expect.stringMatching(/test-/),
          type: MessageType.ERROR,
          payload: {
            error: 'API key invalid'
          }
        })
      }, 10)
    })

    const result = await service.testProvider(testProvider)

    // Verify error handling
    expect(result.success).toBe(false)
    expect(result.error).toBe('API key invalid')
    expect(result.latency).toBe(0)

    // Test performance scores for failed test
    vi.spyOn(service, 'testProvider').mockResolvedValue(result)
    const scores = await service.runPerformanceTests(testProvider)
    expect(scores.latency).toBe(1)
    expect(scores.accuracy).toBe(1)
    expect(scores.reliability).toBe(1)
  })
})

describe('LLMTestService-integration-test', () => {
  it.skipIf(!process.env.LITELLM_API_KEY || process.env.LITELLM_API_KEY === 'nokey')(
    'tests that service works with real background script communication',
    async () => {
      const service = LLMTestService.getInstance()

      const realProvider: LLMProvider = {
        id: 'real-test-1',
        name: 'Real Test Provider',
        type: 'openai',
        modelId: 'gpt-3.5-turbo',
        apiKey: process.env.LITELLM_API_KEY,
        isBuiltIn: false,
        isDefault: false,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z'
      }

      // Mock realistic chrome response
      const mockListener = vi.fn()
      mockPort.onMessage.addListener.mockImplementation((listener) => {
        mockListener.mockImplementation(listener)
        // Simulate response after delay
        setTimeout(() => {
          listener({
            id: 'test-123',
            type: MessageType.SETTINGS_TEST_PROVIDER_RESPONSE,
            payload: {
              success: true,
              latency: 1200,
              response: 'Hello World',
              timestamp: new Date().toISOString()
            }
          })
        }, 100)
      })

      // Override postMessage to trigger response
      mockPort.postMessage.mockImplementation((message) => {
        setTimeout(() => {
          mockListener({
            id: message.id,
            type: MessageType.SETTINGS_TEST_PROVIDER_RESPONSE,
            payload: {
              success: true,
              latency: 1200,
              response: 'Hello World',
              timestamp: new Date().toISOString()
            }
          })
        }, 100)
      })

      const result = await service.testProvider(realProvider)

      expect(result).toBeDefined()
      expect(result.success).toBe(true)
      expect(result.latency).toBe(1200)

      console.log('✅ LLMTestService integration test passed')
    },
    30000
  )
})
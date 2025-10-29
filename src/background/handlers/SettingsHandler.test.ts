import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SettingsHandler } from './SettingsHandler'
import { MessageType } from '@/lib/types/messaging'
import { PortMessage } from '@/lib/runtime/PortMessaging'

// Mock Chrome BrowserOS prefs API
const mockBrowserOSPrefs = {
  getPrefs: vi.fn(),
  setPrefs: vi.fn()
}

// Mock the port
const mockPort = {
  postMessage: vi.fn()
}

// Mock dynamic imports for LangChain
vi.mock('@/lib/llm/LangChainProvider', () => ({
  LangChainProvider: vi.fn()
}))
vi.mock('@/lib/llm/settings/LLMSettingsReader', () => ({
  LLMSettingsReader: vi.fn()
}))
vi.mock('@langchain/openai', () => ({
  ChatOpenAI: vi.fn().mockImplementation(() => ({
    invoke: vi.fn().mockResolvedValue({ content: 'Hello World' })
  }))
}))
vi.mock('@langchain/anthropic', () => ({
  ChatAnthropic: vi.fn().mockImplementation(() => ({
    invoke: vi.fn().mockResolvedValue({ content: 'Hello World' })
  }))
}))
vi.mock('@langchain/ollama', () => ({
  ChatOllama: vi.fn().mockImplementation(() => ({
    invoke: vi.fn().mockResolvedValue({ content: 'Hello World' })
  }))
}))
vi.mock('@langchain/core/messages', () => ({
  HumanMessage: vi.fn().mockImplementation((content) => ({ content }))
}))

describe('SettingsHandler-unit-test', () => {
  let handler: SettingsHandler

  beforeEach(() => {
    vi.clearAllMocks()
    handler = new SettingsHandler()
    ;(globalThis as any).chrome = {
      BrowserOS: mockBrowserOSPrefs
    }
  })

  it('tests that handler can be created', () => {
    expect(handler).toBeDefined()
    expect(typeof handler.handleGetPref).toBe('function')
    expect(typeof handler.handleSetPref).toBe('function')
    expect(typeof handler.handleGetAllPrefs).toBe('function')
    expect(typeof handler.handleTestProvider).toBe('function')
  })

  it('tests that handleGetPref calls chrome.BrowserOS.getPrefs correctly', async () => {
    mockBrowserOSPrefs.getPrefs.mockImplementation((keys: string[], callback) => {
      callback({ [keys[0]]: 'test-value' })
    })

    const message: PortMessage = {
      id: 'test-1',
      type: MessageType.SETTINGS_GET_PREF,
      payload: { name: 'test-pref' }
    }

    await handler.handleGetPref(message, mockPort as any)

    // Verify browserOS API was called
    expect(mockBrowserOSPrefs.getPrefs).toHaveBeenCalledWith(['test-pref'], expect.any(Function))

    // Verify response was sent
    expect(mockPort.postMessage).toHaveBeenCalledWith({
      type: MessageType.SETTINGS_GET_PREF_RESPONSE,
      payload: { name: 'test-pref', value: 'test-value' },
      id: 'test-1'
    })
  })

  it('tests that handleSetPref calls chrome.BrowserOS.setPrefs correctly', async () => {
    mockBrowserOSPrefs.setPrefs.mockImplementation((prefs: Record<string, unknown>, callback) => {
      callback?.(true)
    })

    const message: PortMessage = {
      id: 'test-2',
      type: MessageType.SETTINGS_SET_PREF,
      payload: { name: 'test-pref', value: 'test-value' }
    }

    await handler.handleSetPref(message, mockPort as any)

    // Verify browserOS API was called
    expect(mockBrowserOSPrefs.setPrefs).toHaveBeenCalledWith({ 'test-pref': 'test-value' }, expect.any(Function))

    // Verify response was sent
    expect(mockPort.postMessage).toHaveBeenCalledWith({
      type: MessageType.SETTINGS_SET_PREF_RESPONSE,
      payload: { name: 'test-pref', success: true },
      id: 'test-2'
    })
  })

  it('tests that error handling works when chrome APIs throw', async () => {
    mockBrowserOSPrefs.getPrefs.mockImplementation(() => {
      throw new Error('Chrome API error')
    })

    const message: PortMessage = {
      id: 'test-error',
      type: MessageType.SETTINGS_GET_PREF,
      payload: { name: 'failing-pref' }
    }

    await handler.handleGetPref(message, mockPort as any)

    // Verify error response was sent
    expect(mockPort.postMessage).toHaveBeenCalledWith({
      type: MessageType.ERROR,
      payload: { error: expect.stringContaining('Failed to get preference') },
      id: 'test-error'
    })
  })

  it('tests that handleTestProvider creates correct LLM instance and tests it', async () => {
    const { ChatOpenAI } = await import('@langchain/openai')
    const mockLLM = {
      invoke: vi.fn().mockResolvedValue({ content: 'Hello World' })
    }
    vi.mocked(ChatOpenAI).mockReturnValue(mockLLM as any)

    const message: PortMessage = {
      id: 'test-provider',
      type: MessageType.SETTINGS_TEST_PROVIDER,
      payload: {
        provider: {
          type: 'openai',
          apiKey: 'test-key',
          modelId: 'gpt-4'
        }
      }
    }

    await handler.handleTestProvider(message, mockPort as any)

    // Verify LLM was created with correct config
    expect(ChatOpenAI).toHaveBeenCalledWith({
      openAIApiKey: 'test-key',
      modelName: 'gpt-4',
      temperature: 0.7,
      maxTokens: 100,
      streaming: false
    })

    // Verify test was performed
    expect(mockLLM.invoke).toHaveBeenCalled()

    // Verify success response was sent
    expect(mockPort.postMessage).toHaveBeenCalledWith({
      type: MessageType.SETTINGS_TEST_PROVIDER_RESPONSE,
      payload: expect.objectContaining({
        success: true,
        latency: expect.any(Number),
        response: 'Hello World'
      }),
      id: 'test-provider'
    })
  })
})

describe('SettingsHandler-integration-test', () => {
  it.skipIf(!process.env.LITELLM_API_KEY || process.env.LITELLM_API_KEY === 'nokey')(
    'tests that handler works with real LLM provider testing',
    async () => {
      const handler = new SettingsHandler()

      // Setup mock chrome environment
      ;(globalThis as any).chrome = {
        browserOS: {
          getPref: vi.fn((name, callback) => callback(null)),
          setPref: vi.fn((name, value, pageId, callback) => callback(true)),
          getAllPrefs: vi.fn(callback => callback({}))
        }
      }

      const realProvider = {
        type: 'openai',
        apiKey: process.env.LITELLM_API_KEY,
        modelId: 'gpt-3.5-turbo',
        baseUrl: 'https://api.openai.com/v1'
      }

      const message: PortMessage = {
        id: 'integration-test',
        type: MessageType.SETTINGS_TEST_PROVIDER,
        payload: { provider: realProvider }
      }

      const mockPort = {
        postMessage: vi.fn()
      }

      // Test the provider
      await handler.handleTestProvider(message, mockPort as any)

      // Wait a bit for async operation
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Verify response was sent
      expect(mockPort.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.SETTINGS_TEST_PROVIDER_RESPONSE,
          payload: expect.objectContaining({
            success: expect.any(Boolean),
            latency: expect.any(Number)
          }),
          id: 'integration-test'
        })
      )

      console.log('✅ SettingsHandler integration test passed')
    },
    30000
  )
})



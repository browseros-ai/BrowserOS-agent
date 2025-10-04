import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useBrowserOSPrefs } from './useBrowserOSPrefs'
import { LLMProvider } from '../types/llm-settings'

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

// Setup Chrome global
beforeEach(() => {
  vi.clearAllMocks()
  ;(globalThis as any).chrome = mockChrome
  mockPort.onMessage.addListener.mockClear()
  mockPort.onMessage.removeListener.mockClear()
  mockPort.postMessage.mockClear()
  mockPort.disconnect.mockClear()
  mockChrome.runtime.connect.mockClear()
})

describe('useBrowserOSPrefs-unit-test', () => {
  it('tests that hook can be initialized with default state', () => {
    const { result } = renderHook(() => useBrowserOSPrefs())

    expect(result.current.providers).toHaveLength(1)
    expect(result.current.providers[0].name).toBe('BrowserOS')
    expect(result.current.providers[0].type).toBe('browseros')
    expect(result.current.defaultProvider).toBe('browseros')
    expect(result.current.isLoading).toBe(true)
    expect(typeof result.current.addProvider).toBe('function')
    expect(typeof result.current.updateProvider).toBe('function')
    expect(typeof result.current.deleteProvider).toBe('function')
  })

  it('tests that loadPreferences connects to chrome runtime and processes response', async () => {
    const { result } = renderHook(() => useBrowserOSPrefs())

    // Simulate the message listener being called with preferences
    act(() => {
      const listener = mockPort.onMessage.addListener.mock.calls[0][0]
      listener({
        id: expect.stringMatching(/load-/),
        type: 'SETTINGS_GET_ALL_PREFS_RESPONSE',
        payload: {
          prefs: {
            llm_providers: JSON.stringify([
              {
                id: 'custom-1',
                name: 'Custom Provider',
                type: 'openai',
                isBuiltIn: false,
                isDefault: false,
                createdAt: '2023-01-01T00:00:00Z',
                updatedAt: '2023-01-01T00:00:00Z'
              }
            ]),
            default_provider: 'custom-1'
          }
        }
      })
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // Verify chrome connection was established
    expect(mockChrome.runtime.connect).toHaveBeenCalledWith({ name: 'options' })
    expect(mockPort.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SETTINGS_GET_ALL_PREFS',
        payload: {}
      })
    )

    // Verify state was updated
    expect(result.current.providers).toHaveLength(2) // Default + custom
    expect(result.current.defaultProvider).toBe('custom-1')
  })

  it('tests that addProvider saves to preferences and updates state', async () => {
    const { result } = renderHook(() => useBrowserOSPrefs())

    const newProvider: LLMProvider = {
      id: 'new-provider',
      name: 'New Provider',
      type: 'anthropic',
      modelId: 'claude-3-sonnet',
      isBuiltIn: false,
      isDefault: false,
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z'
    }

    // Mock the save response
    const mockSaveResponse = () => {
      const listener = mockPort.onMessage.addListener.mock.calls.find(
        call => call[0].toString().includes('SETTINGS_SET_PREF_RESPONSE')
      )?.[0]
      if (listener) {
        listener({
          id: expect.stringMatching(/save-/),
          type: 'SETTINGS_SET_PREF_RESPONSE',
          payload: { success: true }
        })
      }
    }

    await act(async () => {
      const promise = result.current.addProvider(newProvider)
      mockSaveResponse()
      await promise
    })

    // Verify provider was added to state
    expect(result.current.providers).toHaveLength(2)
    expect(result.current.providers[1].name).toBe('New Provider')

    // Verify save was called
    expect(mockPort.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SETTINGS_SET_PREF',
        payload: expect.objectContaining({
          name: 'browseros.llm_providers'
        })
      })
    )
  })

  it('tests that error handling works when chrome APIs fail', async () => {
    // Mock chrome.runtime.connect to throw error
    mockChrome.runtime.connect.mockImplementation(() => {
      throw new Error('Chrome API unavailable')
    })

    const { result } = renderHook(() => useBrowserOSPrefs())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    }, { timeout: 6000 }) // Wait for timeout fallback

    // Should still have default provider
    expect(result.current.providers).toHaveLength(1)
    expect(result.current.providers[0].name).toBe('BrowserOS')
  })
})

describe('useBrowserOSPrefs-integration-test', () => {
  it.skipIf(!process.env.LITELLM_API_KEY || process.env.LITELLM_API_KEY === 'nokey')(
    'tests that hook works with real chrome extension environment',
    async () => {
      // Setup real-like chrome mock for integration test
      const realPort = {
        postMessage: vi.fn(),
        onMessage: {
          addListener: vi.fn((listener) => {
            // Simulate async response after short delay
            setTimeout(() => {
              listener({
                id: 'test-load-id',
                type: 'SETTINGS_GET_ALL_PREFS_RESPONSE',
                payload: {
                  prefs: {
                    default_provider: 'browseros'
                  }
                }
              })
            }, 100)
          }),
          removeListener: vi.fn()
        },
        disconnect: vi.fn()
      }

      ;(globalThis as any).chrome = {
        runtime: {
          connect: vi.fn(() => realPort)
        }
      }

      const { result } = renderHook(() => useBrowserOSPrefs())

      // Wait for hook to initialize
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      }, { timeout: 5000 })

      // Verify hook functionality
      expect(result.current.providers).toBeDefined()
      expect(result.current.providers.length).toBeGreaterThan(0)
      expect(result.current.defaultProvider).toBe('browseros')
      expect(typeof result.current.addProvider).toBe('function')
      expect(typeof result.current.testProvider).toBe('function')

      console.log('✅ useBrowserOSPrefs integration test passed')
    },
    30000
  )
})
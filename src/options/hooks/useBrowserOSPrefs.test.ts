import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useBrowserOSPrefs } from './useBrowserOSPrefs'
import { LLMProvider } from '../types/llm-settings'
import { MessageType } from '@/lib/types/messaging'
import { BrowserOSProvidersConfig } from '@/lib/llm/settings/browserOSTypes'

const mockSendMessage = vi.fn(() => true)
const mockConnect = vi.fn(() => true)
const mockDisconnect = vi.fn(() => undefined)
const mockAddConnectionListener = vi.fn()
const mockRemoveConnectionListener = vi.fn()
const mockSendMessageWithResponse = vi.fn()

let isPortConnected = false
const messageListeners = new Map<MessageType, Set<(payload: any, messageId?: string) => void>>()
let mockMessagingInstance: any = null

const triggerWorkflowStatus = (payload: any) => {
  const listeners = messageListeners.get(MessageType.WORKFLOW_STATUS)
  if (listeners) {
    listeners.forEach(listener => listener(payload))
  }
}

const resetPortMessagingMockState = () => {
  mockSendMessage.mockClear()
  mockSendMessage.mockImplementation(() => true)
  mockConnect.mockClear()
  mockConnect.mockImplementation(() => true)
  mockDisconnect.mockClear()
  mockDisconnect.mockImplementation(() => undefined)
  mockAddConnectionListener.mockClear()
  mockAddConnectionListener.mockImplementation(() => {})
  mockRemoveConnectionListener.mockClear()
  mockRemoveConnectionListener.mockImplementation(() => {})
  mockSendMessageWithResponse.mockClear()
  mockSendMessageWithResponse.mockImplementation(() => Promise.resolve(undefined))
  messageListeners.clear()
  isPortConnected = false
  mockMessagingInstance = null
}

vi.mock('@/lib/runtime/PortMessaging', () => {
  class MockPortMessaging {
    connect(portName: string, enableAutoReconnect?: boolean) {
      const result = mockConnect(portName, enableAutoReconnect)
      if (result === false) {
        return false
      }
      isPortConnected = true
      return true
    }

    disconnect() {
      mockDisconnect()
      isPortConnected = false
    }

    addMessageListener(type: MessageType, callback: (payload: any, messageId?: string) => void) {
      if (!messageListeners.has(type)) {
        messageListeners.set(type, new Set())
      }
      messageListeners.get(type)!.add(callback)
    }

    removeMessageListener(type: MessageType, callback: (payload: any, messageId?: string) => void) {
      const listeners = messageListeners.get(type)
      if (listeners) {
        listeners.delete(callback)
        if (listeners.size === 0) {
          messageListeners.delete(type)
        }
      }
    }

    addConnectionListener = mockAddConnectionListener
    removeConnectionListener = mockRemoveConnectionListener

    sendMessage(type: MessageType, payload: unknown, messageId?: string) {
      mockSendMessage(type, payload, messageId)
      return true
    }

    sendMessageWithResponse = mockSendMessageWithResponse

    isConnected() {
      return isPortConnected
    }

    static getInstance() {
      if (!mockMessagingInstance) {
        mockMessagingInstance = new MockPortMessaging()
      }
      return mockMessagingInstance
    }
  }

  return {
    PortMessaging: MockPortMessaging,
    PortPrefix: { OPTIONS: 'options' }
  }
})

beforeEach(() => {
  vi.useFakeTimers()
  resetPortMessagingMockState()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useBrowserOSPrefs-unit-test', () => {
  it('tests that hook can be initialized with default state', () => {
    const { result } = renderHook(() => useBrowserOSPrefs())

    expect(result.current.providers).toHaveLength(1)
    expect(result.current.providers[0].name).toBe('BrowserOS')
    expect(result.current.providers[0].type).toBe('browseros')
    expect(result.current.providers[0].systemPrompt).toBe('')
    expect(result.current.defaultProvider).toBe('browseros')
    expect(result.current.isLoading).toBe(true)
    expect(typeof result.current.addProvider).toBe('function')
    expect(typeof result.current.updateProvider).toBe('function')
    expect(typeof result.current.deleteProvider).toBe('function')
  })

  it('tests that loadPreferences connects to chrome runtime and processes response', async () => {
    const { result } = renderHook(() => useBrowserOSPrefs())

    act(() => {
      vi.runOnlyPendingTimers()
    })

    // Simulate the message listener being called with preferences
    act(() => {
      triggerWorkflowStatus({
        status: 'success',
        data: {
          providersConfig: {
            defaultProviderId: 'custom-1',
            providers: [
              {
                id: 'browseros',
                name: 'BrowserOS',
                type: 'browseros',
                isBuiltIn: true,
                isDefault: false,
                systemPrompt: '',
                createdAt: '2023-01-01T00:00:00Z',
                updatedAt: '2023-01-01T00:00:00Z'
              },
              {
                id: 'custom-1',
                name: 'Custom Provider',
                type: 'openai',
                isBuiltIn: false,
                isDefault: true,
                systemPrompt: 'Stay concise',
                createdAt: '2023-01-01T00:00:00Z',
                updatedAt: '2023-01-01T00:00:00Z'
              }
            ]
          }
        },
        id: 'workflow-message'
      })
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // Verify chrome connection was established
    expect(mockConnect).toHaveBeenCalledWith('options', true)
    const getCall = mockSendMessage.mock.calls.find(call => call[0] === MessageType.GET_LLM_PROVIDERS)
    expect(getCall).toBeDefined()
    if (getCall) {
      expect(getCall[1]).toEqual({})
    }

    // Verify state was updated
    expect(result.current.providers).toHaveLength(2) // Default + custom
    const customProvider = result.current.providers.find(p => p.id === 'custom-1')
    expect(customProvider?.systemPrompt).toBe('Stay concise')
    expect(result.current.defaultProvider).toBe('custom-1')
  })

  it('tests that addProvider saves to preferences and updates state', async () => {
    const { result } = renderHook(() => useBrowserOSPrefs())

    act(() => {
      vi.runOnlyPendingTimers()
    })

    const newProvider: LLMProvider = {
      id: 'new-provider',
      name: 'New Provider',
      type: 'anthropic',
      modelId: 'claude-3-sonnet',
      isBuiltIn: false,
      isDefault: false,
      systemPrompt: 'Follow brand tone',
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z'
    }

    await act(async () => {
      const promise = result.current.addProvider(newProvider)

      triggerWorkflowStatus({
        status: 'success',
        data: {
          providersConfig: {
            defaultProviderId: 'browseros',
            providers: [
              {
                id: 'browseros',
                name: 'BrowserOS',
                type: 'browseros',
                isBuiltIn: true,
                isDefault: true,
                systemPrompt: '',
                createdAt: '2023-01-01T00:00:00Z',
                updatedAt: '2023-01-01T00:00:00Z'
              },
              {
                ...newProvider,
                isDefault: false,
                updatedAt: new Date().toISOString()
              }
            ]
          }
        },
        id: 'workflow-message'
      })

      await promise
    })

    // Verify provider was added to state
    expect(result.current.providers).toHaveLength(2)
    expect(result.current.providers[1].name).toBe('New Provider')
    expect(result.current.providers[1].systemPrompt).toBe('Follow brand tone')

    // Verify save was called
    const saveCall = mockSendMessage.mock.calls.find(call => call[0] === MessageType.SAVE_LLM_PROVIDERS)
    expect(saveCall).toBeDefined()
    if (saveCall) {
      const payload = saveCall[1] as BrowserOSProvidersConfig
      expect(payload.providers.some((p: LLMProvider) => p.id === 'new-provider' && p.systemPrompt === 'Follow brand tone')).toBe(true)
    }
  })

  it('tests that error handling works when chrome APIs fail', async () => {
    mockConnect.mockImplementation(() => false)

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
                type: 'WORKFLOW_STATUS',
                payload: {
                  status: 'success',
                  data: {
                    providersConfig: {
                      defaultProviderId: 'browseros',
                      providers: [
                        {
                          id: 'browseros',
                          name: 'BrowserOS',
                          type: 'browseros',
                          isBuiltIn: true,
                          isDefault: true,
                          systemPrompt: '',
                          createdAt: new Date().toISOString(),
                          updatedAt: new Date().toISOString()
                        }
                      ]
                    }
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

      console.log('✅ useBrowserOSPrefs integration test passed')
    },
    30000
  )
})

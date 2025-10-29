import { useState, useEffect, useCallback } from 'react'
import { LLMProvider } from '../types/llm-settings'
import { MessageType } from '@/lib/types/messaging'
import { PortMessage } from '@/lib/runtime/PortMessaging'
import { BrowserOSProvidersConfig } from '@/lib/llm/settings/browserOSTypes'

const HEARTBEAT_INTERVAL_MS = 20000  // Send heartbeat every 20 seconds to keep background alive

const DEFAULT_BROWSEROS_PROVIDER: LLMProvider = {
  id: 'browseros',
  name: 'BrowserOS',
  type: 'browseros',
  isBuiltIn: true,
  isDefault: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
}

export function useBrowserOSPrefs() {
  const [providers, setProviders] = useState<LLMProvider[]>([DEFAULT_BROWSEROS_PROVIDER])
  const [defaultProvider, setDefaultProviderState] = useState<string>('browseros')
  const [isLoading, setIsLoading] = useState(true)
  const [port, setPort] = useState<chrome.runtime.Port | null>(null)
  const [isPortConnected, setIsPortConnected] = useState(false)

  // Helper to check if port is connected and reconnect if needed
  const ensurePortConnected = useCallback(() => {
    if (!port || !isPortConnected) {
      console.warn('[useBrowserOSPrefs] Port not connected')
      return null
    }
    return port
  }, [port, isPortConnected])

  // Setup persistent port connection
  useEffect(() => {
    let currentPort: chrome.runtime.Port | null = null
    let messageListener: ((msg: PortMessage) => void) | null = null
    let disconnectListener: (() => void) | null = null
    let heartbeatInterval: ReturnType<typeof setInterval> | null = null

    const setupPort = () => {
      try {
        currentPort = chrome.runtime.connect({ name: 'provider-settings' })
        setIsPortConnected(true)

        messageListener = (msg: PortMessage) => {
          // Handle provider config responses and broadcasts
          if (msg.type === MessageType.WORKFLOW_STATUS) {
            const payload = msg.payload as any
            if (payload?.status === 'error') {
              console.error('[useBrowserOSPrefs] Error from background:', payload.error)
            }
            if (payload?.data?.providersConfig) {
              const config = payload.data.providersConfig as BrowserOSProvidersConfig
              // Ensure all providers have isDefault field (migration for old data)
              const migratedProviders = config.providers.map(p => ({
                ...p,
                isDefault: p.isDefault !== undefined ? p.isDefault : (p.id === 'browseros')
              }))
              setProviders(migratedProviders)
              setDefaultProviderState(config.defaultProviderId || 'browseros')
              setIsLoading(false)
            }
          }
        }

        disconnectListener = () => {
          console.warn('[useBrowserOSPrefs] Port disconnected')
          setIsPortConnected(false)
          setPort(null)

          // Stop heartbeat on disconnect
          if (heartbeatInterval) {
            clearInterval(heartbeatInterval)
            heartbeatInterval = null
          }
        }

        currentPort.onMessage.addListener(messageListener)
        currentPort.onDisconnect.addListener(disconnectListener)
        setPort(currentPort)

        // Start heartbeat to keep background service worker alive
        heartbeatInterval = setInterval(() => {
          if (currentPort) {
            try {
              currentPort.postMessage({
                type: MessageType.HEARTBEAT,
                payload: { timestamp: Date.now() },
                id: `heartbeat-provider-settings-${Date.now()}`
              })
            } catch (error) {
              console.warn('[useBrowserOSPrefs] Heartbeat failed, port likely disconnected')
              if (heartbeatInterval) {
                clearInterval(heartbeatInterval)
                heartbeatInterval = null
              }
            }
          }
        }, HEARTBEAT_INTERVAL_MS)

        // Send initial request
        const initialTimeout = setTimeout(() => {
          if (currentPort) {
            try {
              currentPort.postMessage({
                type: MessageType.GET_LLM_PROVIDERS,
                payload: {},
                id: `get-providers-${Date.now()}`
              })
            } catch (error) {
              console.error('[useBrowserOSPrefs] Failed to send initial message:', error)
            }
          }
        }, 100)

        // Retry after delay
        const retryTimeout = setTimeout(() => {
          if (isLoading && currentPort) {
            try {
              currentPort.postMessage({
                type: MessageType.GET_LLM_PROVIDERS,
                payload: {},
                id: `get-providers-retry-${Date.now()}`
              })
            } catch (error) {
              // Silently fail
            }
          }
        }, 500)

        return () => {
          clearTimeout(initialTimeout)
          clearTimeout(retryTimeout)
        }
      } catch (error) {
        console.error('[useBrowserOSPrefs] Failed to setup port:', error)
        setIsPortConnected(false)
        return () => {}
      }
    }

    const cleanup = setupPort()

    return () => {
      cleanup?.()

      // Stop heartbeat
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval)
        heartbeatInterval = null
      }

      if (currentPort) {
        try {
          if (messageListener) currentPort.onMessage.removeListener(messageListener)
          if (disconnectListener) currentPort.onDisconnect.removeListener(disconnectListener)
          currentPort.disconnect()
        } catch (error) {
          // Port already disconnected
        }
      }
      setIsPortConnected(false)
      setPort(null)
    }
  }, [])

  const saveProvidersConfig = useCallback(async (updatedProviders: LLMProvider[], newDefaultId?: string) => {
    const connectedPort = ensurePortConnected()
    if (!connectedPort) {
      console.error('[useBrowserOSPrefs] Port not connected, cannot save providers')
      return false
    }

    const config: BrowserOSProvidersConfig = {
      defaultProviderId: newDefaultId || defaultProvider,
      providers: updatedProviders
    }

    // Send via persistent port with error handling
    try {
      connectedPort.postMessage({
        type: MessageType.SAVE_LLM_PROVIDERS,
        payload: config,
        id: `save-providers-${Date.now()}`
      })
      return true
    } catch (error) {
      console.error('[useBrowserOSPrefs] Failed to send save message:', error)
      setIsPortConnected(false)
      return false
    }
  }, [ensurePortConnected, defaultProvider])

  const setDefaultProvider = useCallback(async (providerId: string) => {
    setDefaultProviderState(providerId)
    const normalizedProviders = providers.map(provider => ({
      ...provider,
      isDefault: provider.id === providerId
    }))
    setProviders(normalizedProviders)
    await saveProvidersConfig(normalizedProviders, providerId)
  }, [providers, saveProvidersConfig])

  const addProvider = useCallback(async (provider: LLMProvider) => {
    const newProvider = {
      ...provider,
      id: provider.id || crypto.randomUUID(),
      isDefault: false,  // Ensure isDefault is always set
      isBuiltIn: provider.isBuiltIn || false,
      createdAt: provider.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    const updatedProviders = [...providers, newProvider]
    setProviders(updatedProviders)
    const success = await saveProvidersConfig(updatedProviders)
    if (!success) {
      // Revert local state if save failed
      setProviders(providers)
      throw new Error('Failed to save provider. Connection lost. Please refresh the page and try again.')
    }
    return newProvider
  }, [providers, saveProvidersConfig])

  const updateProvider = useCallback(async (provider: LLMProvider) => {
    const previousProviders = providers
    const updatedProvider = {
      ...provider,
      isDefault: provider.id === defaultProvider,
      updatedAt: new Date().toISOString()
    }
    const updatedProviders = providers.map(p =>
      p.id === provider.id
        ? updatedProvider
        : { ...p, isDefault: p.id === defaultProvider }
    )
    setProviders(updatedProviders)
    const success = await saveProvidersConfig(updatedProviders)
    if (!success) {
      // Revert local state if save failed
      setProviders(previousProviders)
      throw new Error('Failed to update provider. Connection lost. Please refresh the page and try again.')
    }
    return updatedProvider
  }, [providers, defaultProvider, saveProvidersConfig])

  const deleteProvider = useCallback(async (providerId: string) => {
    const previousProviders = providers
    const previousDefaultId = defaultProvider
    const remainingProviders = providers.filter(p => p.id !== providerId)

    let nextDefaultId = defaultProvider
    if (providerId === defaultProvider) {
      const browserOSProvider = remainingProviders.find(p => p.id === 'browseros')
      nextDefaultId = browserOSProvider?.id || remainingProviders[0]?.id || 'browseros'
      setDefaultProviderState(nextDefaultId)
    }

    const normalizedProviders = remainingProviders.map(p => ({
      ...p,
      isDefault: p.id === nextDefaultId
    }))

    setProviders(normalizedProviders)
    const success = await saveProvidersConfig(normalizedProviders, nextDefaultId)
    if (!success) {
      // Revert local state if save failed
      setProviders(previousProviders)
      setDefaultProviderState(previousDefaultId)
      throw new Error('Failed to delete provider. Connection lost. Please refresh the page and try again.')
    }
  }, [providers, defaultProvider, saveProvidersConfig])

  return {
    providers,
    defaultProvider,
    isLoading,
    setDefaultProvider,
    addProvider,
    updateProvider,
    deleteProvider
  }
}
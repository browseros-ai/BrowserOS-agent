import { MessageType } from '@/lib/types/messaging'
import { PortMessage } from '@/lib/runtime/PortMessaging'
import { LLMSettingsReader } from '@/lib/llm/settings/LLMSettingsReader'
import { langChainProvider } from '@/lib/llm/LangChainProvider'
import { BrowserOSProvidersConfigSchema, BROWSEROS_PREFERENCE_KEYS } from '@/lib/llm/settings/browserOSTypes'
import { Logging } from '@/lib/utils/Logging'
import { PortManager } from '@/background/router/PortManager'

/**
 * Handles LLM provider configuration messages:
 * - GET_LLM_PROVIDERS: Get current provider configuration
 * - SAVE_LLM_PROVIDERS: Save provider configuration
 */
export class ProvidersHandler {
  private lastProvidersConfigJson: string | null = null
  private portManager: PortManager | null = null

  /**
   * Set the port manager for broadcasting config changes
   */
  setPortManager(portManager: PortManager): void {
    this.portManager = portManager
  }

  /**
   * Handle GET_LLM_PROVIDERS message
   */
  async handleGetProviders(
    message: PortMessage,
    port: chrome.runtime.Port
  ): Promise<void> {
    try {
      const config = await LLMSettingsReader.readAllProviders()
      this.lastProvidersConfigJson = JSON.stringify(config)

      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: {
          status: 'success',
          data: { providersConfig: config }
        },
        id: message.id
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      Logging.log('ProvidersHandler', `Error getting providers: ${errorMessage}`, 'error')

      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: {
          status: 'error',
          error: `Failed to read providers: ${errorMessage}`
        },
        id: message.id
      })
    }
  }

  /**
   * Handle SAVE_LLM_PROVIDERS message
   */
  async handleSaveProviders(
    message: PortMessage,
    port: chrome.runtime.Port
  ): Promise<void> {
    try {
      const payload = message.payload as any
      // Ensure all providers have isDefault field
      if (payload.providers) {
        payload.providers = payload.providers.map((p: any) => ({
          ...p,
          isDefault: p.isDefault !== undefined ? p.isDefault : (p.id === 'browseros')
        }))
      }
      const config = BrowserOSProvidersConfigSchema.parse(payload)
      const key = BROWSEROS_PREFERENCE_KEYS.PROVIDERS
      const configStr = JSON.stringify(config)

      let browserOSSuccess = false
      let storageSuccess = false

      // Save to chrome.browserOS.setPref (for BrowserOS browser)
      const browserOS = (chrome as any)?.browserOS
      if (browserOS?.setPref) {
        browserOSSuccess = await new Promise<boolean>((resolve) => {
          browserOS.setPref(key, configStr, undefined, (success: boolean) => {
            const error = chrome.runtime?.lastError
            if (error) {
              Logging.log('ProvidersHandler', `BrowserOS setPref error: ${error.message}`, 'warning')
              resolve(false)
            } else if (success) {
              resolve(true)
            } else {
              Logging.log('ProvidersHandler', 'BrowserOS setPref returned false', 'warning')
              resolve(false)
            }
          })
        })
      }

      // ALSO save to chrome.storage.local (always, for extension reliability)
      if (chrome.storage?.local?.set) {
        storageSuccess = await new Promise<boolean>((resolve) => {
          chrome.storage.local.set({ [key]: configStr }, () => {
            if (chrome.runtime.lastError) {
              Logging.log('ProvidersHandler', `chrome.storage.local save error: ${chrome.runtime.lastError.message}`, 'error')
              resolve(false)
            } else {
              resolve(true)
            }
          })
        })
      }

      // Success if either storage mechanism worked
      const success = browserOSSuccess || storageSuccess
      if (success) {
        try { langChainProvider.clearCache() } catch (_) {}
        this.lastProvidersConfigJson = configStr

        this.broadcastProvidersConfig(config)

        port.postMessage({
          type: MessageType.WORKFLOW_STATUS,
          payload: { status: 'success', data: { providersConfig: config } },
          id: message.id
        })
      } else {
        Logging.log('ProvidersHandler', 'Failed to save to any storage mechanism', 'error')
        port.postMessage({
          type: MessageType.WORKFLOW_STATUS,
          payload: { status: 'error', error: 'Failed to save to any storage mechanism' },
          id: message.id
        })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      Logging.log('ProvidersHandler', `Save exception: ${errorMessage}`, 'error')
      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: { status: 'error', error: errorMessage },
        id: message.id
      })
    }
  }

  /**
   * Broadcast provider config to all connected panels
   */
  private broadcastProvidersConfig(config: unknown): void {
    if (!this.portManager) {
      Logging.log('ProvidersHandler', 'PortManager not set, cannot broadcast config', 'warning')
      return
    }

    const ports = this.portManager.getAllPorts()

    for (const port of ports) {
      // Check if port is still connected before sending
      if (!port || typeof port.postMessage !== 'function') {
        Logging.log('ProvidersHandler', 'Port is invalid, skipping broadcast', 'warning')
        continue
      }

      try {
        port.postMessage({
          type: MessageType.WORKFLOW_STATUS,
          payload: {
            status: 'success',
            data: { providersConfig: config }
          }
        })
      } catch (error) {
        Logging.log('ProvidersHandler', `Failed to broadcast to ${port.name}: ${error}`, 'warning')
      }
    }
  }
}






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
      Logging.log('ProvidersHandler', `GET_LLM_PROVIDERS request from ${port.name}`)
      const config = await LLMSettingsReader.readAllProviders()
      this.lastProvidersConfigJson = JSON.stringify(config)

      Logging.log('ProvidersHandler', `Loaded ${config.providers.length} providers for ${port.name}`)
      Logging.log('ProvidersHandler', `Provider IDs: ${config.providers.map(p => p.id).join(', ')}`)
      Logging.log('ProvidersHandler', `Default provider: ${config.defaultProviderId}`)

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
  handleSaveProviders(
    message: PortMessage,
    port: chrome.runtime.Port
  ): void {
    try {
      const payload = message.payload as any
      // Migrate providers to ensure they all have isDefault field
      if (payload.providers) {
        payload.providers = payload.providers.map((p: any) => ({
          ...p,
          isDefault: p.isDefault !== undefined ? p.isDefault : (p.id === 'browseros')
        }))
      }
      const config = BrowserOSProvidersConfigSchema.parse(payload)
      const key = BROWSEROS_PREFERENCE_KEYS.PROVIDERS
      const configStr = JSON.stringify(config)

      // Try chrome.browserOS.setPref first (for BrowserOS browser)
      const browserOS = (chrome as any)?.browserOS
      if (browserOS?.setPref) {
        Logging.log('ProvidersHandler', `Saving ${config.providers.length} providers via browserOS.setPref: ${key}`)
        Logging.log('ProvidersHandler', `Provider IDs: ${config.providers.map(p => p.id).join(', ')}`)

        browserOS.setPref(key, configStr, undefined, (success: boolean) => {
          if (success) {
            try { langChainProvider.clearCache() } catch (_) {}
            this.lastProvidersConfigJson = configStr

            Logging.log('ProvidersHandler', `Saved successfully to BrowserOS prefs, broadcasting to all ports`)
            this.broadcastProvidersConfig(config)

            port.postMessage({
              type: MessageType.WORKFLOW_STATUS,
              payload: { status: 'success', data: { providersConfig: config } },
              id: message.id
            })
          } else {
            Logging.log('ProvidersHandler', `BrowserOS setPref failed`, 'error')
            port.postMessage({
              type: MessageType.WORKFLOW_STATUS,
              payload: { status: 'error', error: 'Failed to save to BrowserOS preferences' },
              id: message.id
            })
          }
        })
      } else {
        // Fallback to chrome.storage.local (for development/other browsers)
        Logging.log('ProvidersHandler', `Fallback: Saving ${config.providers.length} providers to chrome.storage.local: ${key}`)
        Logging.log('ProvidersHandler', `Provider IDs: ${config.providers.map(p => p.id).join(', ')}`)

        chrome.storage?.local?.set({ [key]: configStr }, () => {
          if (chrome.runtime.lastError) {
            Logging.log('ProvidersHandler', `Storage save error: ${chrome.runtime.lastError.message}`, 'error')
            port.postMessage({
              type: MessageType.WORKFLOW_STATUS,
              payload: { status: 'error', error: chrome.runtime.lastError.message },
              id: message.id
            })
            return
          }

          try { langChainProvider.clearCache() } catch (_) {}
          this.lastProvidersConfigJson = configStr

          Logging.log('ProvidersHandler', `Saved successfully to chrome.storage, broadcasting to all ports`)
          this.broadcastProvidersConfig(config)

          port.postMessage({
            type: MessageType.WORKFLOW_STATUS,
            payload: { status: 'success', data: { providersConfig: config } },
            id: message.id
          })
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

    // Get all connected ports and broadcast the updated config
    const ports = this.portManager.getAllPorts()

    Logging.log('ProvidersHandler', `Broadcasting provider config to ${ports.length} connected ports`)

    for (const port of ports) {
      try {
        port.postMessage({
          type: MessageType.WORKFLOW_STATUS,
          payload: {
            status: 'success',
            data: { providersConfig: config }
          }
        })
        Logging.log('ProvidersHandler', `Broadcasted provider config to ${port.name}`)
      } catch (error) {
        Logging.log('ProvidersHandler', `Failed to broadcast to ${port.name}: ${error}`, 'warning')
      }
    }
  }
}
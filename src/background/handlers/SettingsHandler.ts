import { PortMessage } from '@/lib/runtime/PortMessaging'
import { MessageType } from '@/lib/types/messaging'
import { Logging } from '@/lib/utils/Logging'

export class SettingsHandler {
  async handleGetPref(message: PortMessage, port: chrome.runtime.Port): Promise<void> {
    const { name } = message.payload as { name: string }

    const browserOSPrefs = (chrome as any)?.BrowserOS
    if (browserOSPrefs?.getPrefs) {
      try {
        browserOSPrefs.getPrefs([name], (prefs: Record<string, unknown>) => {
          const error = chrome.runtime?.lastError
          if (error) {
            Logging.log('SettingsHandler', `BrowserOS getPrefs error for ${name}: ${error.message}`, 'error')
            port.postMessage({
              type: MessageType.ERROR,
              payload: { error: `Failed to get preference: ${error.message}` },
              id: message.id
            })
            return
          }

          port.postMessage({
            type: MessageType.SETTINGS_GET_PREF_RESPONSE,
            payload: { name, value: prefs?.[name] ?? null },
            id: message.id
          })
        })
      } catch (error) {
        Logging.log('SettingsHandler', `Error getting pref via BrowserOS ${name}: ${error}`, 'error')
        port.postMessage({
          type: MessageType.ERROR,
          payload: { error: `Failed to get preference: ${error}` },
          id: message.id
        })
      }
      return
    }

    if (chrome.storage?.local) {
      try {
        chrome.storage.local.get(name, (result) => {
          if (chrome.runtime.lastError) {
            Logging.log('SettingsHandler', `Storage get error for ${name}: ${chrome.runtime.lastError.message}`, 'error')
            port.postMessage({
              type: MessageType.ERROR,
              payload: { error: `Failed to get preference: ${chrome.runtime.lastError.message}` },
              id: message.id
            })
            return
          }

          port.postMessage({
            type: MessageType.SETTINGS_GET_PREF_RESPONSE,
            payload: { name, value: result[name] ?? null },
            id: message.id
          })
        })
      } catch (error) {
        Logging.log('SettingsHandler', `Error getting pref from storage ${name}: ${error}`, 'error')
        port.postMessage({
          type: MessageType.ERROR,
          payload: { error: `Failed to get preference: ${error}` },
          id: message.id
        })
      }
      return
    }

    Logging.log('SettingsHandler', `No storage mechanism available for preference ${name}`, 'error')
    port.postMessage({
      type: MessageType.ERROR,
      payload: { error: 'Failed to get preference: no storage backend available' },
      id: message.id
    })
  }

  async handleSetPref(message: PortMessage, port: chrome.runtime.Port): Promise<void> {
    const { name, value } = message.payload as { name: string; value: string }

    const browserOSPrefs = (chrome as any)?.BrowserOS
    if (browserOSPrefs?.setPrefs) {
      try {
        browserOSPrefs.setPrefs({ [name]: value }, (success?: boolean) => {
          const error = chrome.runtime?.lastError
          if (error) {
            Logging.log('SettingsHandler', `BrowserOS setPrefs error for ${name}: ${error.message}`, 'error')
            port.postMessage({
              type: MessageType.SETTINGS_SET_PREF_RESPONSE,
              payload: { name, success: false },
              id: message.id
            })
            return
          }

          const ok = success !== false
          if (!ok) {
            Logging.log('SettingsHandler', `BrowserOS setPrefs reported failure for ${name}`, 'error')
          }

          port.postMessage({
            type: MessageType.SETTINGS_SET_PREF_RESPONSE,
            payload: { name, success: ok },
            id: message.id
          })
        })
      } catch (error) {
        Logging.log('SettingsHandler', `Error setting pref via BrowserOS ${name}: ${error}`, 'error')
        port.postMessage({
          type: MessageType.ERROR,
          payload: { error: `Failed to set preference: ${error}` },
          id: message.id
        })
      }
      return
    }

    if (chrome.storage?.local) {
      try {
        chrome.storage.local.set({ [name]: value }, () => {
          const ok = !chrome.runtime.lastError
          if (!ok) {
            Logging.log('SettingsHandler', `Storage error for ${name}: ${chrome.runtime.lastError?.message}`, 'error')
          }
          port.postMessage({
            type: MessageType.SETTINGS_SET_PREF_RESPONSE,
            payload: { name, success: ok },
            id: message.id
          })
        })
      } catch (error) {
        Logging.log('SettingsHandler', `Error setting pref in storage ${name}: ${error}`, 'error')
        port.postMessage({
          type: MessageType.ERROR,
          payload: { error: `Failed to set preference: ${error}` },
          id: message.id
        })
      }
      return
    }

    Logging.log('SettingsHandler', `No storage mechanism available to set preference ${name}`, 'error')
    port.postMessage({
      type: MessageType.ERROR,
      payload: { error: 'Failed to set preference: no storage backend available' },
      id: message.id
    })
  }

  async handleGetAllPrefs(message: PortMessage, port: chrome.runtime.Port): Promise<void> {
    // ONLY use chrome.storage.local - we're an extension, not browser settings
    try {
      chrome.storage.local.get(null, (items) => {
        port.postMessage({
          type: MessageType.SETTINGS_GET_ALL_PREFS_RESPONSE,
          payload: { prefs: items },
          id: message.id
        })
      })
    } catch (error) {
      Logging.log('SettingsHandler', `Error getting all prefs from storage: ${error}`, 'error')
      port.postMessage({
        type: MessageType.ERROR,
        payload: { error: `Failed to get all preferences: ${error}` },
        id: message.id
      })
    }
  }

  async handleTestMCP(message: PortMessage, port: chrome.runtime.Port): Promise<void> {
    const { serverUrl } = message.payload as { serverUrl: string }

    try {
      const startTime = performance.now()

      const response = await fetch(serverUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/list',
          id: 1
        }),
        signal: AbortSignal.timeout(10000)
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      if (data.error) {
        throw new Error(`MCP Error: ${data.error.message || JSON.stringify(data.error)}`)
      }

      if (!data.result || !Array.isArray(data.result.tools)) {
        throw new Error('Invalid MCP response: missing tools array')
      }

      const toolCount = data.result.tools.length
      const tools = data.result.tools.map((tool: any) => ({
        name: tool.name,
        description: tool.description
      }))

      port.postMessage({
        type: MessageType.SETTINGS_TEST_MCP_RESPONSE,
        payload: {
          success: true,
          toolCount,
          tools,
          timestamp: new Date().toISOString()
        },
        id: message.id
      })
    } catch (error) {
      Logging.log('SettingsHandler', `Error testing MCP server: ${error}`, 'error')
      port.postMessage({
        type: MessageType.SETTINGS_TEST_MCP_RESPONSE,
        payload: {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        },
        id: message.id
      })
    }
  }

  async handleTestProvider(message: PortMessage, port: chrome.runtime.Port): Promise<void> {
    const { provider } = message.payload as { provider: any }

    try {
      const { ChatOpenAI } = await import('@langchain/openai')
      const { ChatAnthropic } = await import('@langchain/anthropic')
      const { ChatOllama } = await import('@langchain/ollama')
      const { ChatGoogleGenerativeAI } = await import('@langchain/google-genai')
      const { HumanMessage } = await import('@langchain/core/messages')

      const startTime = performance.now()

      try {
        let llm: any

        switch (provider.type) {
          case 'openai':
            llm = new ChatOpenAI({
              openAIApiKey: provider.apiKey,
              modelName: provider.modelId || 'gpt-4o-mini',
              temperature: 0.7,
              maxTokens: 100,
              streaming: false
            })
            break

          case 'anthropic':
            llm = new ChatAnthropic({
              anthropicApiKey: provider.apiKey,
              modelName: provider.modelId || 'claude-3-5-sonnet-latest',
              temperature: 0.7,
              maxTokens: 100,
              streaming: false
            })
            break

          case 'google_gemini':
            if (!provider.apiKey) {
              throw new Error('API key required for Google Gemini')
            }
            llm = new ChatGoogleGenerativeAI({
              model: provider.modelId || 'gemini-2.0-flash',
              temperature: 0.7,
              maxOutputTokens: 100,
              apiKey: provider.apiKey,
              convertSystemMessageToHumanContent: true
            })
            break

          case 'ollama':
            // Replace localhost with 127.0.0.1 for better compatibility
            let baseUrl = provider.baseUrl || 'http://localhost:11434'
            if (baseUrl.includes('localhost')) {
              baseUrl = baseUrl.replace('localhost', '127.0.0.1')
            }
            llm = new ChatOllama({
              baseUrl,
              model: provider.modelId || 'qwen3:4b',
              temperature: 0.7,
              numPredict: 100
            })
            break

          case 'openrouter':
            if (!provider.apiKey) {
              throw new Error('API key required for OpenRouter')
            }
            llm = new ChatOpenAI({
              openAIApiKey: provider.apiKey,
              modelName: provider.modelId || 'auto',
              temperature: 0.7,
              maxTokens: 100,
              streaming: false,
              configuration: {
                baseURL: provider.baseUrl || 'https://openrouter.ai/api/v1'
              }
            })
            break

          case 'openai_compatible':
          case 'custom':
            if (!provider.baseUrl) {
              throw new Error('Base URL required for OpenAI Compatible provider')
            }
            llm = new ChatOpenAI({
              openAIApiKey: provider.apiKey || 'dummy-key',
              modelName: provider.modelId || 'default',
              temperature: 0.7,
              maxTokens: 100,
              streaming: false,
              configuration: {
                baseURL: provider.baseUrl
              }
            })
            break

          case 'browseros':
            llm = new ChatOpenAI({
              openAIApiKey: 'browseros-key',
              modelName: 'default-llm',
              temperature: 0.7,
              maxTokens: 100,
              streaming: false,
              configuration: {
                baseURL: 'https://llm.browseros.com/default/'
              }
            })
            break

          default:
            throw new Error(`Unsupported provider type: ${provider.type}`)
        }

        const testMessage = new HumanMessage('Hello! Please respond with "Hello World" to confirm you are working.')
        const response = await llm.invoke([testMessage])
        const latency = performance.now() - startTime

        port.postMessage({
          type: MessageType.SETTINGS_TEST_PROVIDER_RESPONSE,
          payload: {
            success: true,
            latency,
            response: response.content as string,
            timestamp: new Date().toISOString()
          },
          id: message.id
        })
      } catch (testError) {
        const latency = performance.now() - startTime

        port.postMessage({
          type: MessageType.SETTINGS_TEST_PROVIDER_RESPONSE,
          payload: {
            success: false,
            latency,
            error: testError instanceof Error ? testError.message : 'Unknown error',
            timestamp: new Date().toISOString()
          },
          id: message.id
        })
      }
    } catch (error) {
      Logging.log('SettingsHandler', `Error testing provider: ${error}`, 'error')
      port.postMessage({
        type: MessageType.ERROR,
        payload: { error: `Failed to test provider: ${error}` },
        id: message.id
      })
    }
  }

}


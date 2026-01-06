import type { ChatMode } from '@/entrypoints/sidepanel/index/chatTypes'
import { getAgentServerUrl } from '@/lib/browseros/helpers'
import {
  defaultProviderIdStorage,
  providersStorage,
} from '@/lib/llm-providers/storage'
import type { LlmProviderConfig } from '@/lib/llm-providers/types'
import { mcpServerStorage } from '@/lib/mcp/mcpServerStorage'
import { personalizationStorage } from '../personalization/personalizationStorage'
import { scheduleSystemPrompt } from './scheduleSystemPrompt'

interface ActiveTab {
  id?: number
  url?: string
  title?: string
}

interface ChatServerRequest {
  message: string
  mode?: ChatMode
  conversationId?: string
  windowId?: number
  activeTab?: ActiveTab
}

interface ChatServerResponse {
  text: string
  conversationId: string
}

interface StreamEvent {
  type: string
  delta?: string
  errorText?: string
}

const getDefaultProvider = async (): Promise<LlmProviderConfig | null> => {
  const providers = await providersStorage.getValue()
  if (!providers?.length) return null

  const defaultProviderId = await defaultProviderIdStorage.getValue()
  const defaultProvider = providers.find((p) => p.id === defaultProviderId)
  return defaultProvider ?? providers[0] ?? null
}

export async function getChatServerResponse(
  request: ChatServerRequest,
): Promise<ChatServerResponse> {
  const agentServerUrl = await getAgentServerUrl()
  const provider = await getDefaultProvider()
  const conversationId = request.conversationId ?? crypto.randomUUID()
  const personalization = await personalizationStorage.getValue()

  const mcpServers = (await mcpServerStorage.getValue()) ?? []
  const enabledMcpServers = mcpServers
    .filter((s) => s.type === 'managed')
    .map((s) => s.managedServerName)
    .filter((name): name is string => !!name)
  const customMcpServers = mcpServers
    .filter((s) => s.type === 'custom' && !!s.config?.url)
    // biome-ignore lint/style/noNonNullAssertion: filter guarantees url exists
    .map((s) => ({ name: s.displayName, url: s.config!.url }))

  const response = await fetch(`${agentServerUrl}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    // Important: this chat logic is also used in apps/agent/entrypoints/sidepanel/index/useChatSession.ts for sidepanel conversation. Make sure to keep them in sync for any future changes.
    body: JSON.stringify({
      messages: [{ role: 'user', content: request.message }],
      message: request.message,
      provider: provider?.type,
      providerType: provider?.type,
      providerName: provider?.name,
      apiKey: provider?.apiKey,
      baseUrl: provider?.baseUrl,
      conversationId,
      model: provider?.modelId ?? 'default',
      mode: request.mode ?? 'agent',
      resourceName: provider?.resourceName,
      accessKeyId: provider?.accessKeyId,
      secretAccessKey: provider?.secretAccessKey,
      region: provider?.region,
      sessionToken: provider?.sessionToken,
      browserContext:
        request.activeTab ||
        request.windowId ||
        enabledMcpServers.length ||
        customMcpServers.length
          ? {
              windowId: request.windowId,
              activeTab: request.activeTab,
              enabledMcpServers:
                enabledMcpServers.length > 0 ? enabledMcpServers : undefined,
              customMcpServers:
                customMcpServers.length > 0 ? customMcpServers : undefined,
            }
          : undefined,
      userSystemPrompt: `${personalization}\n${scheduleSystemPrompt}`,
      isScheduledTask: true,
    }),
  })

  if (!response.ok) {
    throw new Error(
      `Chat request failed: ${response.status} ${response.statusText}`,
    )
  }

  const text = await parseSSEStream(response)

  return { text, conversationId }
}

async function parseSSEStream(response: Response): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('Response body is not readable')
  }

  const decoder = new TextDecoder()
  let result = ''
  let buffer = ''
  let streamError: string | null = null

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue

        const data = line.slice(6)
        if (data === '[DONE]') continue

        try {
          const event: StreamEvent = JSON.parse(data)
          if (event.type === 'text-delta' && event.delta) {
            result += event.delta
          } else if (event.type === 'error' && event.errorText) {
            streamError = event.errorText
          }
        } catch {
          // Ignore JSON parse errors for malformed chunks
        }
      }
    }

    // Process remaining buffer
    if (buffer.startsWith('data: ')) {
      const data = buffer.slice(6)
      if (data !== '[DONE]') {
        try {
          const event: StreamEvent = JSON.parse(data)
          if (event.type === 'text-delta' && event.delta) {
            result += event.delta
          } else if (event.type === 'error' && event.errorText) {
            streamError = event.errorText
          }
        } catch {
          // Ignore JSON parse errors for malformed chunks
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  if (streamError) {
    throw new Error(streamError)
  }

  return result
}

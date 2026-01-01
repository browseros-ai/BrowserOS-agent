import { processAssistantStream } from '@ai-sdk/ui-utils'
import type { ChatMode } from '@/entrypoints/sidepanel/index/chatTypes'
import { getAgentServerUrl } from '@/lib/browseros/helpers'
import {
  defaultProviderIdStorage,
  providersStorage,
} from '@/lib/llm-providers/storage'
import type { LlmProviderConfig } from '@/lib/llm-providers/types'

interface ChatServerRequest {
  message: string
  mode?: ChatMode
  conversationId?: string
}

interface ChatServerResponse {
  text: string
  conversationId?: string
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

  const response = await fetch(`${agentServerUrl}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
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
    }),
  })

  if (!response.ok) {
    throw new Error(
      `Chat request failed: ${response.status} ${response.statusText}`,
    )
  }

  let result = ''

  await processAssistantStream({
    stream: response.body!,
    onTextPart: (text) => {
      result += text
    },
  })

  return { text: result, conversationId }
}

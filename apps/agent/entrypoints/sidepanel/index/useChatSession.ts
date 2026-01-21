import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage } from 'ai'
import { compact } from 'es-toolkit/array'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import useDeepCompareEffect from 'use-deep-compare-effect'
import type { Provider } from '@/components/chat/chatComponentTypes'
import { useAgentServerUrl } from '@/lib/browseros/useBrowserOSProviders'
import type { ChatAction } from '@/lib/chat-actions/types'
import {
  CONVERSATION_RESET_EVENT,
  MESSAGE_DISLIKE_EVENT,
  MESSAGE_LIKE_EVENT,
  MESSAGE_SENT_EVENT,
  PROVIDER_SELECTED_EVENT,
} from '@/lib/constants/analyticsEvents'
import {
  conversationStorage,
  useConversations,
} from '@/lib/conversations/conversationStorage'
import { formatConversationHistory } from '@/lib/conversations/formatConversationHistory'
import { useLlmProviders } from '@/lib/llm-providers/useLlmProviders'
import { track } from '@/lib/metrics/track'
import { searchActionsStorage } from '@/lib/search-actions/searchActionsStorage'
import type { ChatMode } from './chatTypes'
import { useChatRefs } from './useChatRefs'
import { useNotifyActiveTab } from './useNotifyActiveTab'

const getLastMessageText = (messages: UIMessage[]) => {
  const lastMessage = messages[messages.length - 1]
  if (!lastMessage) return ''
  return lastMessage.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('')
}

export const getResponseAndQueryFromMessageId = (
  messages: UIMessage[],
  messageId: string,
) => {
  const messageIndex = messages.findIndex((each) => each.id === messageId)
  const response = messages?.[messageIndex] ?? []
  const query = messages?.[messageIndex - 1] ?? []
  const responseText = response.parts
    .filter((each) => each.type === 'text')
    .map((each) => each.text)
    .join('\n\n')
  const queryText = query.parts
    .filter((each) => each.type === 'text')
    .map((each) => each.text)
    .join('\n')

  return {
    responseText,
    queryText,
  }
}

export const useChatSession = () => {
  const {
    selectedLlmProviderRef,
    enabledMcpServersRef,
    enabledCustomServersRef,
    personalizationRef,
    selectedLlmProvider,
    isLoadingProviders,
  } = useChatRefs()

  const { providers: llmProviders, setDefaultProvider } = useLlmProviders()

  const {
    baseUrl: agentServerUrl,
    isLoading: isLoadingAgentUrl,
    error: agentUrlError,
  } = useAgentServerUrl()

  const { saveConversation } = useConversations()
  const [searchParams, setSearchParams] = useSearchParams()
  const conversationIdParam = searchParams.get('conversationId')

  const agentUrlRef = useRef(agentServerUrl)

  useEffect(() => {
    agentUrlRef.current = agentServerUrl
  }, [agentServerUrl])

  const providers: Provider[] = llmProviders.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
  }))

  const [mode, setMode] = useState<ChatMode>('agent')
  const [textToAction, setTextToAction] = useState<Map<string, ChatAction>>(
    new Map(),
  )
  const [liked, setLiked] = useState<Record<string, boolean>>({})
  const [disliked, setDisliked] = useState<Record<string, boolean>>({})
  const [conversationId, setConversationId] = useState(crypto.randomUUID())
  const conversationIdRef = useRef(conversationId)

  useEffect(() => {
    conversationIdRef.current = conversationId
  }, [conversationId])

  const onClickLike = (messageId: string) => {
    const { responseText, queryText } = getResponseAndQueryFromMessageId(
      messages,
      messageId,
    )

    track(MESSAGE_LIKE_EVENT, { responseText, queryText, messageId })

    setLiked((prev) => ({
      ...prev,
      [messageId]: !prev[messageId],
    }))
  }

  const onClickDislike = (messageId: string, comment?: string) => {
    const { responseText, queryText } = getResponseAndQueryFromMessageId(
      messages,
      messageId,
    )

    track(MESSAGE_DISLIKE_EVENT, {
      responseText,
      queryText,
      messageId,
      comment,
    })

    setDisliked((prev) => ({
      ...prev,
      [messageId]: !prev[messageId],
    }))
  }

  const modeRef = useRef<ChatMode>(mode)
  const textToActionRef = useRef<Map<string, ChatAction>>(textToAction)
  const workingDirRef = useRef<string | undefined>(undefined)
  const messagesRef = useRef<UIMessage[]>([])

  useDeepCompareEffect(() => {
    modeRef.current = mode
    textToActionRef.current = textToAction
  }, [mode, textToAction])

  const selectedProvider = selectedLlmProvider
    ? {
        id: selectedLlmProvider.id,
        name: selectedLlmProvider.name,
        type:
          selectedLlmProvider.id === 'browseros'
            ? ('browseros' as const)
            : selectedLlmProvider.type,
      }
    : providers[0]

  const {
    messages,
    sendMessage: baseSendMessage,
    setMessages,
    status,
    stop,
    error: chatError,
  } = useChat({
    transport: new DefaultChatTransport({
      // Important: this chat logic is also used in apps/agent/lib/schedules/getChatServerResponse.ts for scheduled jobs. Make sure to keep them in sync for any future changes.
      prepareSendMessagesRequest: async ({ messages }) => {
        const activeTabsList = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        })
        const activeTab = activeTabsList?.[0] ?? undefined
        const message = getLastMessageText(messages)
        const provider = selectedLlmProviderRef.current
        const currentMode = modeRef.current
        const enabledMcpServers = enabledMcpServersRef.current
        const customMcpServers = enabledCustomServersRef.current

        const getActionForMessage = (messageText: string) => {
          return textToActionRef.current.get(messageText)
        }

        const action = getActionForMessage(message)

        const browserContext: {
          windowId?: number
          activeTab?: {
            id?: number
            url?: string
            title?: string
          }
          selectedTabs?: {
            id?: number
            url?: string
            title?: string
          }[]
          enabledMcpServers?: string[]
          customMcpServers?: {
            name: string
            url: string
          }[]
        } = {}

        if (activeTab) {
          browserContext.windowId = activeTab.windowId
          browserContext.activeTab = {
            id: activeTab.id,
            url: activeTab.url,
            title: activeTab.title,
          }
        }

        if (action?.tabs?.length) {
          browserContext.selectedTabs = action?.tabs?.map((tab) => ({
            id: tab.id,
            url: tab.url,
            title: tab.title,
          }))
        }

        if (enabledMcpServers.length) {
          browserContext.enabledMcpServers = compact(enabledMcpServers)
        }

        if (customMcpServers.length) {
          browserContext.customMcpServers = customMcpServers as {
            name: string
            url: string
          }[]
        }

        // Format previous messages from ref (messagesRef doesn't include current message yet)
        const previousMessages = messagesRef.current
        const previousConversation =
          previousMessages.length > 0
            ? formatConversationHistory(previousMessages)
            : undefined

        return {
          api: `${agentUrlRef.current}/chat`,
          body: {
            message,
            provider: provider?.type,
            providerType: provider?.type,
            providerName: provider?.name,
            apiKey: provider?.apiKey,
            baseUrl: provider?.baseUrl,
            conversationId: conversationIdRef.current,
            model: provider?.modelId ?? 'default',
            mode: currentMode,
            contextWindowSize: provider?.contextWindow,
            temperature: provider?.temperature,
            // Azure-specific
            resourceName: provider?.resourceName,
            // Bedrock-specific
            accessKeyId: provider?.accessKeyId,
            secretAccessKey: provider?.secretAccessKey,
            region: provider?.region,
            sessionToken: provider?.sessionToken,
            browserContext,
            userSystemPrompt: personalizationRef.current,
            userWorkingDir: workingDirRef.current,
            supportsImages: provider?.supportsImages,
            previousConversation,
          },
        }
      },
    }),
  })

  useNotifyActiveTab({
    messages,
    status,
    conversationId: conversationIdRef.current,
  })

  useEffect(() => {
    if (!conversationIdParam) return

    const restoreConversation = async () => {
      const conversations = await conversationStorage.getValue()
      const conversation = conversations?.find(
        (c) => c.id === conversationIdParam,
      )

      if (conversation) {
        setConversationId(
          conversation.id as ReturnType<typeof crypto.randomUUID>,
        )
        setMessages(conversation.messages)
      }

      setSearchParams({}, { replace: true })
    }

    restoreConversation()
  }, [conversationIdParam, setMessages, setSearchParams])

  // biome-ignore lint/correctness/useExhaustiveDependencies: only need to run when messages change
  useEffect(() => {
    messagesRef.current = messages
    if (messages.length > 0) {
      saveConversation(conversationIdRef.current, messages)
    }
  }, [messages])

  const sendMessage = (params: { text: string; action?: ChatAction }) => {
    track(MESSAGE_SENT_EVENT, {
      mode,
      provider_type: selectedLlmProvider?.type,
      model: selectedLlmProvider?.modelId,
    })
    if (params.action) {
      const action = params.action
      setTextToAction((prev) => {
        const next = new Map(prev)
        next.set(params.text, action)
        return next
      })
    }
    baseSendMessage({ text: params.text })
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: only need to run this once
  useEffect(() => {
    const unwatch = searchActionsStorage.watch((storageAction) => {
      if (storageAction) {
        setMode(storageAction.mode)
        workingDirRef.current = storageAction.workingDir
        sendMessage({ text: storageAction.query, action: storageAction.action })
      }
    })
    return () => unwatch()
  }, [])

  const handleSelectProvider = (provider: Provider) => {
    track(PROVIDER_SELECTED_EVENT, {
      provider_id: provider.id,
      provider_type: provider.type,
    })
    setDefaultProvider(provider.id)
  }

  const getActionForMessage = (message: UIMessage) => {
    if (message.role !== 'user') return undefined
    const text = message.parts
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('')
    return textToAction.get(text)
  }

  const resetConversation = () => {
    track(CONVERSATION_RESET_EVENT, { message_count: messages.length })
    stop()
    setConversationId(crypto.randomUUID())
    setMessages([])
    setTextToAction(new Map())
    setLiked({})
    setDisliked({})
  }

  return {
    mode,
    setMode,
    messages,
    sendMessage,
    status,
    stop,
    providers,
    selectedProvider,
    isLoading: isLoadingProviders || isLoadingAgentUrl,
    agentUrlError,
    chatError,
    handleSelectProvider,
    getActionForMessage,
    resetConversation,
    liked,
    onClickLike,
    disliked,
    onClickDislike,
    conversationId,
  }
}

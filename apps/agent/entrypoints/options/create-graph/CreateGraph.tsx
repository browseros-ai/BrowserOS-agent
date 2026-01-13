import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage } from 'ai'
import { compact } from 'es-toolkit/array'
import type { FC } from 'react'
import { useEffect } from 'react'
import useDeepCompareEffect from 'use-deep-compare-effect'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { useChatRefs } from '@/entrypoints/sidepanel/index/useChatRefs'
import { useAgentServerUrl } from '@/lib/browseros/useBrowserOSProviders'
import { GraphCanvas } from './GraphCanvas'
import { GraphChat } from './GraphChat'

type MessageType = 'create-graph' | 'update-graph' | 'run-graph'

export type GraphData = {
  nodes: {
    id: string
    type: string
    data: {
      label: string
    }
  }[]
  edges: {
    id: string
    source: string
    target: string
  }[]
}

const getLastMessageText = (messages: UIMessage[]) => {
  const lastMessage = messages[messages.length - 1]
  if (!lastMessage) return ''
  return lastMessage.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('')
}

export const CreateGraph: FC = () => {
  const [graphName, setGraphName] = useState('')
  const [codeId, setCodeId] = useState<string | undefined>(undefined)
  const [graphData, setGraphData] = useState<GraphData | undefined>(undefined)
  const [backgroundWindow, setBackgroundWindow] = useState<
    chrome.windows.Window | undefined
  >(undefined)

  const [query, setQuery] = useState('')

  const updateQuery = (newQuery: string) => {
    setQuery(newQuery)
  }

  const onSubmit = () => {
    if (codeId) {
      sendMessage({
        text: query,
        metadata: {
          messageType: 'update-graph' as MessageType,
          codeId,
        },
      })
    } else {
      sendMessage({
        text: query,
        metadata: {
          messageType: 'create-graph' as MessageType,
        },
      })
    }
    setQuery('')
  }

  const {
    baseUrl: agentServerUrl,
    isLoading: _isLoadingAgentUrl,
    error: _agentUrlError,
  } = useAgentServerUrl()

  const {
    selectedLlmProviderRef,
    enabledMcpServersRef,
    enabledCustomServersRef,
  } = useChatRefs()

  const agentUrlRef = useRef(agentServerUrl)
  const codeIdRef = useRef(codeId)

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally only trigger on corresponding value changes
  useEffect(() => {
    agentUrlRef.current = agentServerUrl
    codeIdRef.current = codeId
  }, [agentServerUrl, codeId])

  const { sendMessage, stop, status, messages } = useChat({
    transport: new DefaultChatTransport({
      prepareSendMessagesRequest: async ({ messages }) => {
        const lastMessage = messages[messages.length - 1]
        const lastMessageText = getLastMessageText(messages)
        if (lastMessage.metadata?.messageType === 'create-graph') {
          return {
            api: `${agentUrlRef.current}/graph`,
            body: {
              query: lastMessageText,
            },
          }
        } else if (
          lastMessage.metadata?.messageType === 'update-graph' &&
          codeIdRef.current
        ) {
          return {
            api: `${agentUrlRef.current}/graph/${codeIdRef.current}`,
            body: {
              query: lastMessageText,
            },
          }
        } else if (
          lastMessage.metadata?.messageType === 'run-graph' &&
          codeIdRef.current
        ) {
          const provider = selectedLlmProviderRef.current
          const enabledMcpServers = enabledMcpServersRef.current
          const customMcpServers = enabledCustomServersRef.current

          return {
            api: `${agentUrlRef.current}/graph/${codeIdRef.current}/run`,
            body: {
              provider: provider?.type,
              providerType: provider?.type,
              providerName: provider?.name,
              model: provider?.modelId ?? 'browseros',
              contextWindowSize: provider?.contextWindow,
              temperature: provider?.temperature,
              // Azure-specific
              resourceName: provider?.resourceName,
              // Bedrock-specific
              accessKeyId: provider?.accessKeyId,
              secretAccessKey: provider?.secretAccessKey,
              region: provider?.region,
              sessionToken: provider?.sessionToken,
              browserContext: {
                windowId: lastMessage.metadata?.window?.id,
                activeTab: lastMessage.metadata?.window?.tabs?.[0],
                enabledMcpServers: compact(enabledMcpServers),
                customMcpServers,
              },
            },
          }
        }
      },
    }),
  })

  const lastAssistantMessage = messages.findLast((m) => m.role === 'assistant')

  const onClickTest = async () => {
    const backgroundWindow = await chrome.windows.create({
      url: 'chrome://newtab',
      focused: true,
      type: 'normal',
    })

    setBackgroundWindow(backgroundWindow)

    sendMessage({
      text: 'Run a test of the graph you just created.',
      metadata: {
        messageType: 'run-graph' as MessageType,
        codeId,
        window: backgroundWindow,
      },
    })
  }

  useDeepCompareEffect(() => {
    if (status === 'ready' && lastAssistantMessage) {
      const codeId = lastAssistantMessage?.metadata?.codeId
      setCodeId(codeId)
      const graph = lastAssistantMessage?.metadata?.graph
      setGraphData(graph)
    }
  }, [status, lastAssistantMessage ?? {}])

  return (
    <div className="h-dvh w-dvw bg-background text-foreground">
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel>
          <GraphCanvas
            graphName={graphName}
            onGraphNameChange={(val) => setGraphName(val)}
            graphData={graphData}
            onClickTest={onClickTest}
          />
        </ResizablePanel>

        {/* Resizable Handle */}
        <ResizableHandle withHandle />

        <ResizablePanel>
          <GraphChat
            messages={messages}
            onSubmit={onSubmit}
            onInputChange={updateQuery}
            onStop={stop}
            input={query}
            status={status}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}

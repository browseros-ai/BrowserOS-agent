import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage } from 'ai'
import type { FC } from 'react'
import { useEffect } from 'react'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { useAgentServerUrl } from '@/lib/browseros/useBrowserOSProviders'
import { GraphCanvas } from './GraphCanvas'
import { GraphChat } from './GraphChat'

type MessageType = 'create-graph' | 'update-graph' | 'run-graph'

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
  const [_graphId, _setGraphId] = useState<string | undefined>(
    'code_jwsShssYSyue',
  )

  const [query, setQuery] = useState('')

  const updateQuery = (newQuery: string) => {
    setQuery(newQuery)
  }

  const onSubmit = () => {
    sendMessage({
      text: query,
      metadata: {
        messageType: 'create-graph' as MessageType,
      },
    })
    setQuery('')
  }

  const {
    baseUrl: agentServerUrl,
    isLoading: _isLoadingAgentUrl,
    error: _agentUrlError,
  } = useAgentServerUrl()

  const agentUrlRef = useRef(agentServerUrl)

  useEffect(() => {
    agentUrlRef.current = agentServerUrl
  }, [agentServerUrl, agentUrlRef])

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
            keepAlive: true,
          }
        }
        if (messages.length === 0) {
          return {
            api: `${agentUrlRef.current}/graph`,
            body: {
              query:
                'Create a new graph to open gmail and visit the updates tab',
            },
          }
        } else {
          return {
            api: `${agentUrlRef.current}/graph`,
            body: {
              query:
                'Create a new graph to open gmail and visit the updates tab',
            },
          }
        }
      },
    }),
  })

  return (
    <div className="h-dvh w-dvw bg-background text-foreground">
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel>
          <GraphCanvas
            graphName={graphName}
            onGraphNameChange={(val) => setGraphName(val)}
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

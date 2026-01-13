import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import type { FC } from 'react'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { useAgentServerUrl } from '@/lib/browseros/useBrowserOSProviders'
import { GraphCanvas } from './GraphCanvas'
import { GraphChat } from './GraphChat'

export const CreateGraph: FC = () => {
  const [graphName, setGraphName] = useState('')
  const [graphId, _setGraphId] = useState<string | undefined>(
    'code_2-DxNueis4AP',
  )

  const {
    baseUrl: agentServerUrl,
    isLoading: _isLoadingAgentUrl,
    error: _agentUrlError,
  } = useAgentServerUrl()

  const agentUrlRef = useRef(agentServerUrl)

  useEffect(() => {
    agentUrlRef.current = agentServerUrl
  }, [agentServerUrl])

  const { sendMessage } = useChat({
    transport: new DefaultChatTransport({
      prepareSendMessagesRequest: async ({ messages }) => {
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

  useEffect(() => {
    if (agentServerUrl) {
      sendMessage({
        text: 'Create a new graph to open gmail and visit the updates tab',
        metadata: {},
      })
    }
  }, [agentServerUrl])

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
          <GraphChat />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage } from 'ai'
import { compact } from 'es-toolkit/array'
import type { FC, FormEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import useDeepCompareEffect from 'use-deep-compare-effect'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { useChatRefs } from '@/entrypoints/sidepanel/index/useChatRefs'
import { useAgentServerUrl } from '@/lib/browseros/useBrowserOSProviders'
import { useRpcClient } from '@/lib/rpc/RpcClientProvider'
import { sentry } from '@/lib/sentry/sentry'
import { useWorkflows } from '@/lib/workflows/workflowStorage'
import { GraphCanvas } from './GraphCanvas'
import { GraphChat } from './GraphChat'

type MessageType = 'create-graph' | 'update-graph' | 'run-graph'

type GraphMessageMetadata = {
  messageType?: MessageType
  codeId?: string
  graph?: GraphData
  window?: chrome.windows.Window
}

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
  const [searchParams] = useSearchParams()
  const workflowIdParam = searchParams.get('workflowId')

  const [graphName, setGraphName] = useState('')
  const [codeId, setCodeId] = useState<string | undefined>(undefined)
  const [graphData, setGraphData] = useState<GraphData | undefined>(undefined)
  const [savedWorkflowId, setSavedWorkflowId] = useState<string | undefined>(
    undefined,
  )
  const [savedCodeId, setSavedCodeId] = useState<string | undefined>(undefined)
  const [isInitialized, setIsInitialized] = useState(!workflowIdParam)
  const [canvasPanelSize, setCanvasPanelSize] = useState<
    { asPercentage: number; inPixels: number } | undefined
  >(undefined)

  const [query, setQuery] = useState('')

  const { workflows, addWorkflow, editWorkflow } = useWorkflows()
  const rpcClient = useRpcClient()

  // Initialize edit mode when workflowId is provided
  useDeepCompareEffect(() => {
    if (!workflowIdParam || isInitialized) return

    const workflow = workflows.find((w) => w.id === workflowIdParam)
    if (!workflow) return

    const initializeEditMode = async () => {
      setGraphName(workflow.workflowName)
      setCodeId(workflow.codeId)
      setSavedWorkflowId(workflow.id)
      setSavedCodeId(workflow.codeId)

      try {
        const response = await rpcClient.graph[':id'].$get({
          param: { id: workflow.codeId },
        })

        if (response.ok) {
          const data = await response.json()
          if ('graph' in data && data.graph) {
            setGraphData(data.graph as GraphData)
          }
        }
      } catch (error) {
        sentry.captureException(error, {
          extra: {
            message: 'Failed to fetch graph data from the server',
            codeId: workflow.codeId,
          },
        })
      }

      setIsInitialized(true)
    }

    initializeEditMode()
  }, [workflowIdParam, workflows, isInitialized, rpcClient])

  const updateQuery = (newQuery: string) => {
    setQuery(newQuery)
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
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
    error: agentUrlError,
  } = useAgentServerUrl()

  const {
    selectedLlmProviderRef,
    enabledMcpServersRef,
    enabledCustomServersRef,
    personalizationRef,
  } = useChatRefs()

  const agentUrlRef = useRef(agentServerUrl)
  const codeIdRef = useRef(codeId)

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally only trigger on corresponding value changes
  useEffect(() => {
    agentUrlRef.current = agentServerUrl
    codeIdRef.current = codeId
  }, [agentServerUrl, codeId])

  const { sendMessage, stop, status, messages, error } = useChat({
    transport: new DefaultChatTransport({
      prepareSendMessagesRequest: async ({ messages }) => {
        const lastMessage = messages[messages.length - 1]
        const lastMessageText = getLastMessageText(messages)
        const metadata = lastMessage.metadata as
          | GraphMessageMetadata
          | undefined

        if (metadata?.messageType === 'create-graph') {
          return {
            api: `${agentUrlRef.current}/graph`,
            body: {
              query: lastMessageText,
            },
          }
        }

        if (metadata?.messageType === 'update-graph' && codeIdRef.current) {
          return {
            api: `${agentUrlRef.current}/graph/${codeIdRef.current}`,
            body: {
              query: lastMessageText,
            },
          }
        }

        if (metadata?.messageType === 'run-graph' && codeIdRef.current) {
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
              resourceName: provider?.resourceName,
              // Bedrock-specific
              accessKeyId: provider?.accessKeyId,
              secretAccessKey: provider?.secretAccessKey,
              region: provider?.region,
              sessionToken: provider?.sessionToken,
              apiKey: provider?.apiKey,
              baseUrl: provider?.baseUrl,
              browserContext: {
                windowId: metadata?.window?.id,
                activeTab: metadata?.window?.tabs?.[0],
                enabledMcpServers: compact(enabledMcpServers),
                customMcpServers,
              },
              userSystemPrompt: personalizationRef.current,
            },
          }
        }

        return {
          api: `${agentUrlRef.current}/graph`,
          body: {
            query: lastMessageText,
          },
        }
      },
    }),
  })

  const lastAssistantMessageWithGraph = messages.findLast((m) => {
    if (m.role !== 'assistant') return false
    const metadata = m.metadata as GraphMessageMetadata | undefined
    return metadata?.graph !== undefined
  })

  const onClickTest = async () => {
    const backgroundWindow = await chrome.windows.create({
      url: 'chrome://newtab',
      focused: true,
      type: 'normal',
    })

    sendMessage({
      text: 'Run a test of the graph you just created.',
      metadata: {
        messageType: 'run-graph' as MessageType,
        codeId,
        window: backgroundWindow,
      },
    })
  }

  const hasUnsavedChanges = savedWorkflowId ? codeId !== savedCodeId : true
  const shouldBlockNavigation = !!codeId && hasUnsavedChanges

  // Handle browser refresh/close
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (shouldBlockNavigation) {
        e.preventDefault()
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [shouldBlockNavigation])

  const onClickSave = async () => {
    if (!graphName || !codeId) return

    if (savedWorkflowId) {
      await editWorkflow(savedWorkflowId, {
        workflowName: graphName,
        codeId,
      })
      setSavedCodeId(codeId)
    } else {
      const newWorkflow = await addWorkflow({
        workflowName: graphName,
        codeId,
      })
      setSavedWorkflowId(newWorkflow.id)
      setSavedCodeId(codeId)
    }
  }

  useDeepCompareEffect(() => {
    if (status === 'ready' && lastAssistantMessageWithGraph) {
      const metadata = lastAssistantMessageWithGraph.metadata as
        | GraphMessageMetadata
        | undefined
      setCodeId(metadata?.codeId)
      setGraphData(metadata?.graph)
    }
  }, [status, lastAssistantMessageWithGraph ?? {}])

  if (!isInitialized) {
    return (
      <div className="flex h-dvh w-dvw items-center justify-center bg-background text-foreground">
        <div className="text-muted-foreground">Loading workflow...</div>
      </div>
    )
  }

  return (
    <div className="h-dvh w-dvw bg-background text-foreground">
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel
          id="graph-canvas"
          defaultSize={'70%'}
          minSize={'30%'}
          maxSize={'70%'}
          onResize={(size) => setCanvasPanelSize(size)}
        >
          <GraphCanvas
            graphName={graphName}
            onGraphNameChange={(val) => setGraphName(val)}
            graphData={graphData}
            codeId={codeId}
            onClickTest={onClickTest}
            onClickSave={onClickSave}
            isSaved={!!savedWorkflowId}
            hasUnsavedChanges={hasUnsavedChanges}
            shouldBlockNavigation={shouldBlockNavigation}
            panelSize={canvasPanelSize}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel
          id="graph-chat"
          defaultSize={'30%'}
          maxSize={'70%'}
          minSize={'30%'}
        >
          <GraphChat
            messages={messages}
            onSubmit={onSubmit}
            onInputChange={updateQuery}
            onStop={stop}
            input={query}
            status={status}
            agentUrlError={agentUrlError}
            chatError={error}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}

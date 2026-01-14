import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { compact } from 'es-toolkit/array'
import { useEffect, useRef, useState } from 'react'
import { useChatRefs } from '@/entrypoints/sidepanel/index/useChatRefs'
import { useAgentServerUrl } from '@/lib/browseros/useBrowserOSProviders'

type WorkflowMessageMetadata = {
  window?: chrome.windows.Window
}

export const useRunWorkflow = () => {
  const [isRunning, setIsRunning] = useState(false)
  const [runningWorkflowName, setRunningWorkflowName] = useState<string>('')
  const [wasCancelled, setWasCancelled] = useState(false)
  const codeIdRef = useRef<string | undefined>(undefined)

  const { baseUrl: agentServerUrl } = useAgentServerUrl()

  const {
    selectedLlmProviderRef,
    enabledMcpServersRef,
    enabledCustomServersRef,
    personalizationRef,
  } = useChatRefs()

  const agentUrlRef = useRef(agentServerUrl)

  useEffect(() => {
    agentUrlRef.current = agentServerUrl
  }, [agentServerUrl])

  const { sendMessage, stop, status, messages, setMessages, error } = useChat({
    transport: new DefaultChatTransport({
      prepareSendMessagesRequest: async ({ messages }) => {
        const lastMessage = messages[messages.length - 1]
        const metadata = lastMessage.metadata as
          | WorkflowMessageMetadata
          | undefined
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
            accessKeyId: provider?.accessKeyId,
            secretAccessKey: provider?.secretAccessKey,
            region: provider?.region,
            sessionToken: provider?.sessionToken,
            browserContext: {
              windowId: metadata?.window?.id,
              activeTab: metadata?.window?.tabs?.[0],
              enabledMcpServers: compact(enabledMcpServers),
              customMcpServers,
            },
            userSystemPrompt: personalizationRef.current,
          },
        }
      },
    }),
  })

  const startWorkflowRun = async () => {
    setMessages([])
    setWasCancelled(false)

    const backgroundWindow = await chrome.windows.create({
      url: 'chrome://newtab',
      focused: true,
      type: 'normal',
    })

    sendMessage({
      text: 'Run the workflow.',
      metadata: {
        window: backgroundWindow,
      },
    })
  }

  const runWorkflow = async (codeId: string, workflowName: string) => {
    codeIdRef.current = codeId
    setRunningWorkflowName(workflowName)
    setIsRunning(true)
    await startWorkflowRun()
  }

  const stopRun = () => {
    setWasCancelled(true)
    stop()
  }

  const retry = async () => {
    await startWorkflowRun()
  }

  const closeDialog = () => {
    setIsRunning(false)
    setRunningWorkflowName('')
    setWasCancelled(false)
    setMessages([])
  }

  return {
    isRunning,
    runningWorkflowName,
    messages,
    status,
    wasCancelled,
    error,
    runWorkflow,
    stopRun,
    retry,
    closeDialog,
  }
}

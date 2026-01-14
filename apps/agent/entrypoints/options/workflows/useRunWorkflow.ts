import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { compact } from 'es-toolkit/array'
import { useEffect, useRef, useState } from 'react'
import { useChatRefs } from '@/entrypoints/sidepanel/index/useChatRefs'
import { useAgentServerUrl } from '@/lib/browseros/useBrowserOSProviders'

export const useRunWorkflow = () => {
  const [isRunning, setIsRunning] = useState(false)
  const [runningWorkflowName, setRunningWorkflowName] = useState<string>('')
  const codeIdRef = useRef<string | undefined>(undefined)

  const { baseUrl: agentServerUrl } = useAgentServerUrl()

  const {
    selectedLlmProviderRef,
    enabledMcpServersRef,
    enabledCustomServersRef,
  } = useChatRefs()

  const agentUrlRef = useRef(agentServerUrl)

  useEffect(() => {
    agentUrlRef.current = agentServerUrl
  }, [agentServerUrl])

  const { sendMessage, stop, status, messages, setMessages } = useChat({
    transport: new DefaultChatTransport({
      prepareSendMessagesRequest: async ({ messages }) => {
        const lastMessage = messages[messages.length - 1]
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
              windowId: lastMessage.metadata?.window?.id,
              activeTab: lastMessage.metadata?.window?.tabs?.[0],
              enabledMcpServers: compact(enabledMcpServers),
              customMcpServers,
            },
          },
        }
      },
    }),
  })

  const runWorkflow = async (codeId: string, workflowName: string) => {
    codeIdRef.current = codeId
    setRunningWorkflowName(workflowName)
    setIsRunning(true)
    setMessages([])

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

  const stopRun = () => {
    stop()
  }

  const closeDialog = () => {
    setIsRunning(false)
    setRunningWorkflowName('')
    setMessages([])
  }

  return {
    isRunning,
    runningWorkflowName,
    messages,
    status,
    runWorkflow,
    stopRun,
    closeDialog,
  }
}

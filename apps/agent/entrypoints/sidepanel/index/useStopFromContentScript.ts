import { useEffect } from 'react'
import { CONTENT_SCRIPT_STOP_CLICKED_EVENT } from '@/lib/constants/analyticsEvents'
import { track } from '@/lib/metrics/track'

interface StopAgentMessage {
  type: 'BROWSEROS_STOP_AGENT'
  conversationId: string
}

function isStopAgentMessage(message: unknown): message is StopAgentMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as StopAgentMessage).type === 'BROWSEROS_STOP_AGENT' &&
    typeof (message as StopAgentMessage).conversationId === 'string'
  )
}

export const useStopFromContentScript = ({
  conversationId,
  stop,
}: {
  conversationId: string
  stop: () => void
}) => {
  useEffect(() => {
    const listener = (message: unknown) => {
      if (!isStopAgentMessage(message)) return
      if (message.conversationId !== conversationId) return

      track(CONTENT_SCRIPT_STOP_CLICKED_EVENT)
      stop()
    }

    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [conversationId, stop])
}

import type { ChatStatus, ToolUIPart, UIMessage } from 'ai'
import { useEffect, useRef } from 'react'
import type { GlowMessage } from '@/entrypoints/glow.content/GlowMessage'

export const useNotifyActiveTab = ({
  messages,
  status,
  conversationId,
}: {
  messages: UIMessage[]
  status: ChatStatus
  conversationId: string
}) => {
  // Ref to store the last active tab ID
  const lastTabIdRef = useRef<number | null>(null)

  const lastMessage = messages?.[messages.length - 1]

  const latestTool =
    lastMessage?.parts?.findLast((part) => part?.type?.startsWith('tool-')) ??
    null

  const latestTabId = (
    latestTool as ToolUIPart & { input?: { tabId?: number } }
  )?.input?.tabId

  useEffect(() => {
    const isStreaming = status === 'streaming'
    const previousTabId = lastTabIdRef.current

    // Streaming stopped - turn off glow on the last active tab
    const stoppedStreaming = !isStreaming && previousTabId

    // Switched to a different tab while streaming - need to turn off glow on old tab
    const switchedTabs =
      isStreaming &&
      latestTabId &&
      previousTabId &&
      latestTabId !== previousTabId

    if (stoppedStreaming || switchedTabs) {
      if (previousTabId) {
        const deactivateMessage: GlowMessage = {
          conversationId,
          isActive: false,
        }
        chrome.tabs.sendMessage(previousTabId, deactivateMessage).catch(() => {
          // no action needed if the tab is closed or does not exist
        })
      }
    }

    // Activate glow on current tab while streaming
    if (isStreaming && latestTabId) {
      const activateMessage: GlowMessage = {
        conversationId,
        isActive: true,
      }
      chrome.tabs.sendMessage(latestTabId, activateMessage).catch(() => {
        // no action needed if the tab is closed or does not exist
      })
    }

    // Track the latest tab for future comparisons
    if (latestTabId) {
      lastTabIdRef.current = latestTabId
    }
  }, [conversationId, status, latestTabId])

  return
}

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
  const lastTabIdRef = useRef<number | null>(null)
  const pageToTabRef = useRef<Map<number, number>>(new Map())

  const lastMessage = messages?.[messages.length - 1]

  const latestTool =
    lastMessage?.parts?.findLast((part) => part?.type?.startsWith('tool-')) ??
    null

  const latestInput = (
    latestTool as ToolUIPart & {
      input?: { tabId?: number; page?: number; pageId?: number }
    }
  )?.input

  const latestPageId = latestInput?.pageId ?? latestInput?.page
  const latestTabId =
    latestInput?.tabId ??
    (latestPageId !== undefined
      ? pageToTabRef.current.get(latestPageId)
      : undefined)

  useEffect(() => {
    if (latestInput?.tabId && latestPageId !== undefined) {
      pageToTabRef.current.set(latestPageId, latestInput.tabId)
    }

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
  }, [conversationId, status, latestInput?.tabId, latestPageId, latestTabId])

  return
}

import type { ChatStatus, ToolUIPart, UIMessage } from 'ai'
import { useEffect, useRef } from 'react'
import type { GlowMessage } from '@/entrypoints/glow.content/GlowMessage'
import { firstRunConfettiShownStorage } from '@/lib/onboarding/onboardingStorage'

function extractTabId(toolPart: ToolUIPart | null): number | undefined {
  if (!toolPart) return undefined

  // CDP tools: server includes tabId in tool output metadata
  const output = (
    toolPart as ToolUIPart & {
      output?: { metadata?: { tabId?: number } }
    }
  )?.output
  if (output?.metadata?.tabId) return output.metadata.tabId

  // Legacy controller tools: tabId in input
  const input = (toolPart as ToolUIPart & { input?: { tabId?: number } })?.input
  return input?.tabId
}

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
  const knownTabsRef = useRef<Set<number>>(new Set())

  const lastMessage = messages?.[messages.length - 1]

  const latestTool =
    lastMessage?.parts?.findLast((part) => part?.type?.startsWith('tool-')) ??
    null

  const hasToolCalls = !!latestTool
  const toolTabId = extractTabId(latestTool as ToolUIPart | null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally reset when conversationId changes
  useEffect(() => {
    knownTabsRef.current = new Set()
  }, [conversationId])

  useEffect(() => {
    const isStreaming = status === 'streaming'
    const previousTabId = lastTabIdRef.current

    if (!isStreaming) {
      if (previousTabId) {
        const deactivate = async () => {
          const alreadyShown = await firstRunConfettiShownStorage.getValue()
          const deactivateMessage: GlowMessage = {
            conversationId,
            isActive: false,
            showConfetti: !alreadyShown,
          }
          chrome.tabs
            .sendMessage(previousTabId, deactivateMessage)
            .catch(() => {})
          if (!alreadyShown) {
            await firstRunConfettiShownStorage.setValue(true)
          }
        }
        deactivate()
        lastTabIdRef.current = null
      }
      return
    }

    if (!hasToolCalls) return

    let cancelled = false

    const activate = async () => {
      let targetTabId = toolTabId ?? previousTabId ?? undefined

      if (!targetTabId) {
        const tabs = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        })
        targetTabId = tabs[0]?.id
      }

      if (cancelled || !targetTabId) return

      // Open side panel on tabs the agent hasn't seen yet
      if (!knownTabsRef.current.has(targetTabId)) {
        knownTabsRef.current.add(targetTabId)
        chrome.runtime
          .sendMessage({
            type: 'open-sidepanel-on-tab',
            tabId: targetTabId,
            conversationId,
          })
          .catch(() => {})
      }

      if (previousTabId && previousTabId !== targetTabId) {
        const deactivateMessage: GlowMessage = {
          conversationId,
          isActive: false,
        }
        chrome.tabs
          .sendMessage(previousTabId, deactivateMessage)
          .catch(() => {})
      }

      const activateMessage: GlowMessage = {
        conversationId,
        isActive: true,
      }
      chrome.tabs.sendMessage(targetTabId, activateMessage).catch(() => {})
      lastTabIdRef.current = targetTabId
    }

    activate()

    return () => {
      cancelled = true
    }
  }, [conversationId, status, hasToolCalls, toolTabId])

  return
}

import type { ChatStatus, ToolUIPart, UIMessage } from 'ai'
import { useEffect, useRef } from 'react'
import type { GlowMessage } from '@/entrypoints/glow.content/GlowMessage'
import { openSidePanel } from '@/lib/browseros/toggleSidePanel'
import { firstRunConfettiShownStorage } from '@/lib/onboarding/onboardingStorage'
import { linkTabToSharedSidepanelSession } from '@/lib/sidepanel/shared-sidepanel-session'

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

function extractTabIds(parts: UIMessage['parts'] | undefined): number[] {
  if (!parts) return []

  return [
    ...new Set(
      parts
        .filter((part): part is ToolUIPart => part.type?.startsWith('tool-'))
        .map((part) => extractTabId(part))
        .filter((tabId): tabId is number => tabId !== undefined),
    ),
  ]
}

export const useNotifyActiveTab = ({
  messages,
  status,
  conversationId,
  hostTabId,
}: {
  messages: UIMessage[]
  status: ChatStatus
  conversationId: string
  hostTabId: number | null
}) => {
  const lastTabIdRef = useRef<number | null>(null)

  const lastMessage = messages?.[messages.length - 1]
  const toolTabIds = extractTabIds(lastMessage?.parts)
  const hasToolCalls = toolTabIds.length > 0
  const toolTabId = toolTabIds.at(-1)

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
      let targetTabId = toolTabId

      if (!targetTabId) {
        targetTabId = hostTabId ?? undefined
      }

      if (cancelled || !targetTabId) return

      if (hostTabId) {
        for (const linkedTabId of toolTabIds) {
          await linkTabToSharedSidepanelSession({
            sourceTabId: hostTabId,
            targetTabId: linkedTabId,
            conversationId,
          }).catch(() => null)
          await openSidePanel(linkedTabId).catch(() => null)
        }
      }

      await openSidePanel(targetTabId).catch(() => null)

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
  }, [conversationId, hostTabId, status, hasToolCalls, toolTabId, toolTabIds])

  return
}

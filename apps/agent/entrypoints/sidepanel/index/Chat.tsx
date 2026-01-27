import { useEffect, useRef, useState } from 'react'
import { SwarmPanel } from '@/components/swarm/SwarmPanel'
import { createBrowserOSAction } from '@/lib/chat-actions/types'
import { SIDEPANEL_AI_TRIGGERED_EVENT } from '@/lib/constants/analyticsEvents'
import { useJtbdPopup } from '@/lib/jtbd-popup/useJtbdPopup'
import { track } from '@/lib/metrics/track'
import { useSwarm } from '@/lib/swarm/useSwarm'
import { useChatSessionContext } from '../layout/ChatSessionContext'
import { ChatEmptyState } from './ChatEmptyState'
import { ChatError } from './ChatError'
import { ChatFooter } from './ChatFooter'
import { ChatMessages } from './ChatMessages'

/**
 * @public
 */
export const Chat = () => {
  const {
    mode,
    setMode,
    messages,
    sendMessage,
    status,
    stop,
    agentUrlError,
    chatError,
    getActionForMessage,
    liked,
    onClickLike,
    disliked,
    onClickDislike,
  } = useChatSessionContext()

  const {
    popupVisible,
    recordMessageSent,
    triggerIfEligible,
    onTakeSurvey,
    onDismiss: onDismissJtbdPopup,
  } = useJtbdPopup()

  // Swarm state
  const [swarmEnabled, setSwarmEnabled] = useState(false)
  const [swarmWorkerCount] = useState(3)
  const { swarm, startSwarm, stopSwarm, error: swarmError } = useSwarm()

  const [input, setInput] = useState('')
  const [attachedTabs, setAttachedTabs] = useState<chrome.tabs.Tab[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    ;(async () => {
      const currentTab = (
        await chrome.tabs.query({
          active: true,
          currentWindow: true,
        })
      ).filter((tab) => tab.url?.startsWith('http'))
      setAttachedTabs(currentTab)
    })()
  }, [])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll only when messages change
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Trigger JTBD popup when AI finishes responding
  const previousChatStatus = useRef(status)
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally only trigger on status change
  useEffect(() => {
    const aiWasProcessing =
      previousChatStatus.current === 'streaming' ||
      previousChatStatus.current === 'submitted'
    const aiJustFinished = aiWasProcessing && status === 'ready'

    if (aiJustFinished && messages.length > 0) {
      triggerIfEligible()
    }
    previousChatStatus.current = status
  }, [status])

  const toggleTabSelection = (tab: chrome.tabs.Tab) => {
    setAttachedTabs((prev) => {
      const isSelected = prev.some((t) => t.id === tab.id)
      if (isSelected) {
        return prev.filter((t) => t.id !== tab.id)
      }
      return [...prev, tab]
    })
  }

  const removeTab = (tabId?: number) => {
    setAttachedTabs((prev) => prev.filter((t) => t.id !== tabId))
  }

  const executeMessage = async (customMessageText?: string) => {
    const messageText = customMessageText ? customMessageText : input.trim()
    if (!messageText) return

    recordMessageSent()

    // If swarm mode is enabled and in agent mode, use swarm
    if (swarmEnabled && mode === 'agent') {
      setInput('')
      await startSwarm(messageText, { maxWorkers: swarmWorkerCount })
      return
    }

    if (attachedTabs.length) {
      const action = createBrowserOSAction({
        mode,
        message: messageText,
        tabs: attachedTabs,
      })
      sendMessage({ text: messageText, action })
    } else {
      sendMessage({ text: messageText })
    }
    setInput('')
    setAttachedTabs([])
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (messages.length === 0) {
      track(SIDEPANEL_AI_TRIGGERED_EVENT, {
        mode,
        tabs_count: attachedTabs.length,
      })
    }
    executeMessage()
  }

  const handleSuggestionClick = (suggestion: string) => {
    executeMessage(suggestion)
  }

  return (
    <>
      <main className="mt-4 flex h-full flex-1 flex-col space-y-4 overflow-y-auto">
        {messages.length === 0 ? (
          <ChatEmptyState
            mode={mode}
            mounted={mounted}
            onSuggestionClick={handleSuggestionClick}
          />
        ) : (
          <ChatMessages
            messages={messages}
            status={status}
            messagesEndRef={messagesEndRef}
            getActionForMessage={getActionForMessage}
            liked={liked}
            onClickLike={onClickLike}
            disliked={disliked}
            onClickDislike={onClickDislike}
            showJtbdPopup={popupVisible}
            onTakeSurvey={onTakeSurvey}
            onDismissJtbdPopup={onDismissJtbdPopup}
          />
        )}
        {agentUrlError && <ChatError error={agentUrlError} />}
        {chatError && <ChatError error={chatError} />}
        {swarmError && <ChatError error={swarmError} />}
      </main>

      {/* Swarm progress panel */}
      {swarm && (
        <div className="px-3 pb-2">
          <SwarmPanel swarm={swarm} onTerminate={stopSwarm} />
        </div>
      )}

      <ChatFooter
        mode={mode}
        onModeChange={setMode}
        input={input}
        onInputChange={setInput}
        onSubmit={handleSubmit}
        status={status}
        onStop={stop}
        attachedTabs={attachedTabs}
        onToggleTab={toggleTabSelection}
        onRemoveTab={removeTab}
        swarmEnabled={swarmEnabled}
        swarmWorkerCount={swarmWorkerCount}
        onSwarmToggle={setSwarmEnabled}
      />
    </>
  )
}

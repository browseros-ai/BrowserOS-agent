import { Loader2 } from 'lucide-react'
import { type FC, useEffect, useRef, useState } from 'react'
import { ChatEmptyState } from '@/entrypoints/sidepanel/index/ChatEmptyState'
import { ChatError } from '@/entrypoints/sidepanel/index/ChatError'
import { ChatFooter } from '@/entrypoints/sidepanel/index/ChatFooter'
import { ChatMessages } from '@/entrypoints/sidepanel/index/ChatMessages'
import type { ChatMode } from '@/entrypoints/sidepanel/index/chatTypes'
import { useChatSessionContext } from '@/entrypoints/sidepanel/layout/ChatSessionContext'
import { createBrowserOSAction } from '@/lib/chat-actions/types'
import {
  NEWTAB_CHAT_MODE_CHANGED_EVENT,
  NEWTAB_CHAT_RESET_EVENT,
  NEWTAB_CHAT_STOPPED_EVENT,
  NEWTAB_CHAT_SUGGESTION_CLICKED_EVENT,
  NEWTAB_TAB_REMOVED_EVENT,
  NEWTAB_TAB_TOGGLED_EVENT,
} from '@/lib/constants/analyticsEvents'
import { track } from '@/lib/metrics/track'
import { NewTabChatHeader } from './NewTabChatHeader'

interface NewTabChatProps {
  onBackToSearch: () => void
}

export const NewTabChat: FC<NewTabChatProps> = ({ onBackToSearch }) => {
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
    isRestoringConversation,
    conversationId,
    providers,
    selectedProvider,
    handleSelectProvider,
    resetConversation,
  } = useChatSessionContext()

  const [input, setInput] = useState('')
  const [attachedTabs, setAttachedTabs] = useState<chrome.tabs.Tab[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll only when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleModeChange = (newMode: ChatMode) => {
    track(NEWTAB_CHAT_MODE_CHANGED_EVENT, { from: mode, to: newMode })
    setMode(newMode)
  }

  const handleStop = () => {
    track(NEWTAB_CHAT_STOPPED_EVENT)
    stop()
  }

  const toggleTabSelection = (tab: chrome.tabs.Tab) => {
    setAttachedTabs((prev) => {
      const isSelected = prev.some((t) => t.id === tab.id)
      track(NEWTAB_TAB_TOGGLED_EVENT, {
        action: isSelected ? 'removed' : 'added',
      })
      if (isSelected) {
        return prev.filter((t) => t.id !== tab.id)
      }
      return [...prev, tab]
    })
  }

  const removeTab = (tabId?: number) => {
    track(NEWTAB_TAB_REMOVED_EVENT)
    setAttachedTabs((prev) => prev.filter((t) => t.id !== tabId))
  }

  const executeMessage = (customMessageText?: string) => {
    const messageText = customMessageText ? customMessageText : input.trim()
    if (!messageText) return

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
    executeMessage()
  }

  const handleSuggestionClick = (suggestion: string) => {
    track(NEWTAB_CHAT_SUGGESTION_CLICKED_EVENT, { mode })
    executeMessage(suggestion)
  }

  const handleNewConversation = () => {
    track(NEWTAB_CHAT_RESET_EVENT, { message_count: messages.length })
    resetConversation()
  }

  if (!selectedProvider) return null

  return (
    <div className="flex h-[calc(100vh-2rem)] flex-col">
      <NewTabChatHeader
        selectedProvider={selectedProvider}
        providers={providers}
        onSelectProvider={handleSelectProvider}
        onNewConversation={handleNewConversation}
        onBackToSearch={onBackToSearch}
        hasMessages={messages.length > 0}
      />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col space-y-4 overflow-y-auto px-4 pt-4">
        {isRestoringConversation ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
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
            conversationId={conversationId}
            getActionForMessage={getActionForMessage}
            liked={liked}
            onClickLike={onClickLike}
            disliked={disliked}
            onClickDislike={onClickDislike}
            showJtbdPopup={false}
            showDontShowAgain={false}
            onTakeSurvey={() => {}}
            onDismissJtbdPopup={() => {}}
          />
        )}
        {agentUrlError && <ChatError error={agentUrlError} />}
        {chatError && <ChatError error={chatError} />}
      </main>

      <div className="mx-auto w-full max-w-3xl px-4">
        <ChatFooter
          mode={mode}
          onModeChange={handleModeChange}
          input={input}
          onInputChange={setInput}
          onSubmit={handleSubmit}
          status={status}
          onStop={handleStop}
          attachedTabs={attachedTabs}
          onToggleTab={toggleTabSelection}
          onRemoveTab={removeTab}
        />
      </div>
    </div>
  )
}

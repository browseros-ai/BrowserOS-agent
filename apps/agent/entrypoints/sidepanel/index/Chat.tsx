import { useEffect, useRef, useState } from 'react'
import { createBrowserOSAction } from '@/lib/chat-actions/types'
import { ChatEmptyState } from './ChatEmptyState'
import { ChatError } from './ChatError'
import { ChatFooter } from './ChatFooter'
import { ChatHeader } from './ChatHeader'
import { ChatMessages } from './ChatMessages'
import { useChatSession } from './useChatSession'

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
    providers,
    selectedProvider,
    isLoading,
    agentUrlError,
    chatError,
    handleSelectProvider,
    getActionForMessage,
    resetConversation,
    liked,
    onClickLike,
    disliked,
    onClickDislike,
  } = useChatSession()

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
    executeMessage(suggestion)
  }

  if (isLoading || !selectedProvider) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="mx-auto flex h-screen w-screen flex-col bg-background text-foreground">
      <ChatHeader
        selectedProvider={selectedProvider}
        onSelectProvider={handleSelectProvider}
        providers={providers}
        onNewConversation={resetConversation}
        hasMessages={messages.length > 0}
      />

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
          />
        )}
        {agentUrlError && <ChatError error={agentUrlError} />}
        {chatError && <ChatError error={chatError} />}
      </main>

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
      />
    </div>
  )
}

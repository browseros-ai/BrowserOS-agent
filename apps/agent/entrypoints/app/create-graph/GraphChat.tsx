import type { UIMessage } from 'ai'
import { Send, SquareStop } from 'lucide-react'
import type { FC, FormEventHandler, KeyboardEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { ChatError } from '@/entrypoints/sidepanel/index/ChatError'
import { ChatMessages } from '@/entrypoints/sidepanel/index/ChatMessages'
import { getResponseAndQueryFromMessageId } from '@/entrypoints/sidepanel/index/useChatSession'
import {
  GRAPH_MESSAGE_DISLIKE_EVENT,
  GRAPH_MESSAGE_LIKE_EVENT,
} from '@/lib/constants/analyticsEvents'
import { useJtbdPopup } from '@/lib/jtbd-popup/useJtbdPopup'
import { track } from '@/lib/metrics/track'
import { cn } from '@/lib/utils'
import { GraphEmptyState } from './GraphEmptyState'
import { getWorkflowDisplayMessages } from './workflow-tidbit-messages'

interface GraphChatProps {
  onSubmit: FormEventHandler<HTMLFormElement>
  onInputChange: (value: string) => void
  onStop: () => void
  input: string
  status: 'streaming' | 'submitted' | 'ready' | 'error'
  messages: UIMessage[]
  chatError?: Error
  agentUrlError?: Error | null
  onSuggestionClick: (prompt: string) => void
}

export const GraphChat: FC<GraphChatProps> = ({
  onSubmit,
  onInputChange,
  onStop,
  input,
  status,
  messages,
  chatError,
  agentUrlError,
  onSuggestionClick,
}) => {
  const [liked, setLiked] = useState<Record<string, boolean>>({})
  const [disliked, setDisliked] = useState<Record<string, boolean>>({})
  const [mounted, setMounted] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const displayMessages = getWorkflowDisplayMessages(messages)

  useEffect(() => {
    setMounted(true)
  }, [])

  const {
    popupVisible,
    recordMessageSent,
    triggerIfEligible,
    onTakeSurvey: onTakeSurveyBase,
    onDismiss: onDismissJtbdPopup,
  } = useJtbdPopup()

  const onTakeSurvey = () =>
    onTakeSurveyBase({ experimentId: 'workflow_survey' })

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

  const onClickLike = (messageId: string) => {
    const { responseText, queryText } = getResponseAndQueryFromMessageId(
      messages,
      messageId,
    )

    track(GRAPH_MESSAGE_LIKE_EVENT, { responseText, queryText, messageId })

    setLiked((prev) => ({
      ...prev,
      [messageId]: !prev[messageId],
    }))
  }

  const onClickDislike = (messageId: string, comment?: string) => {
    const { responseText, queryText } = getResponseAndQueryFromMessageId(
      messages,
      messageId,
    )

    track(GRAPH_MESSAGE_DISLIKE_EVENT, {
      responseText,
      queryText,
      messageId,
      comment,
    })

    setDisliked((prev) => ({
      ...prev,
      [messageId]: !prev[messageId],
    }))
  }

  const handleSubmit: FormEventHandler<HTMLFormElement> = (e) => {
    recordMessageSent()
    onSubmit(e)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      e.key === 'Enter' &&
      !e.shiftKey &&
      !e.metaKey &&
      !e.ctrlKey &&
      !e.nativeEvent.isComposing
    ) {
      e.preventDefault()
      if (input.trim()) {
        e.currentTarget.form?.requestSubmit()
      }
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="styled-scrollbar min-h-0 flex-1 overflow-y-auto pb-2">
        {displayMessages.length === 0 ? (
          <GraphEmptyState
            mounted={mounted}
            onSuggestionClick={onSuggestionClick}
          />
        ) : (
          <ChatMessages
            liked={liked}
            disliked={disliked}
            onClickDislike={onClickDislike}
            onClickLike={onClickLike}
            messages={displayMessages}
            status={status}
            messagesEndRef={messagesEndRef}
            showJtbdPopup={popupVisible}
            onTakeSurvey={onTakeSurvey}
            onDismissJtbdPopup={onDismissJtbdPopup}
          />
        )}
      </div>
      {agentUrlError && <ChatError error={agentUrlError} />}
      {chatError && <ChatError error={chatError} />}
      <div className="shrink-0 border-border/40 border-t bg-background/80 p-2 backdrop-blur-md">
        <form
          onSubmit={handleSubmit}
          className="relative flex w-full items-end gap-2"
        >
          <textarea
            className={cn(
              'field-sizing-content max-h-60 min-h-[42px] flex-1 resize-none overflow-hidden rounded-2xl border border-border/50 bg-muted/50 px-4 py-2.5 pr-11 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 hover:border-border focus:border-[var(--accent-orange)]',
            )}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              'Visit Amazon and add sensodyne toothpaste to the cart.'
            }
            rows={1}
          />
          {status === 'streaming' ? (
            <button
              type="button"
              onClick={onStop}
              className="absolute right-1.5 bottom-1.5 cursor-pointer rounded-full bg-red-600 p-2 text-white shadow-sm transition-all duration-200 hover:bg-red-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <SquareStop className="h-3.5 w-3.5" />
              <span className="sr-only">Stop</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="absolute right-1.5 bottom-1.5 cursor-pointer rounded-full bg-[var(--accent-orange)] p-2 text-white shadow-sm transition-all duration-200 hover:bg-[var(--accent-orange-bright)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              <span className="sr-only">Send</span>
            </button>
          )}
        </form>
      </div>
    </div>
  )
}

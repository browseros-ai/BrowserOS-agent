import type { UIMessage } from 'ai'
import { Lightbulb, Send, SquareStop } from 'lucide-react'
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

const EXAMPLE_WORKFLOWS = [
  'Go to Amazon, search for toothpaste, select 1 pack filter and add the first result to cart',
  'Open LinkedIn and go to my connection requests, accept one by one in a loop for 25 times',
  'Go to Gmail, navigate to manage subscriptions and unsubscribe from all',
]

const WelcomePanel: FC = () => (
  <div className="shrink-0 border-border/40 border-b bg-muted/30 p-4">
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-orange)]/10">
        <Lightbulb className="h-4 w-4 text-[var(--accent-orange)]" />
      </div>
      <div className="space-y-2">
        <p className="text-foreground text-sm">
          Describe the workflow you want to automate. I'll generate a visual
          graph you can refine and run.
        </p>
        <div className="space-y-1">
          <p className="font-medium text-muted-foreground text-xs">Examples:</p>
          <ul className="space-y-1">
            {EXAMPLE_WORKFLOWS.map((example) => (
              <li
                key={example}
                className="text-muted-foreground/80 text-xs before:mr-2 before:content-['•']"
              >
                {example}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  </div>
)

interface GraphChatProps {
  onSubmit: FormEventHandler<HTMLFormElement>
  onInputChange: (value: string) => void
  onStop: () => void
  input: string
  status: 'streaming' | 'submitted' | 'ready' | 'error'
  messages: UIMessage[]
  chatError?: Error
  agentUrlError?: Error | null
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
}) => {
  const [liked, setLiked] = useState<Record<string, boolean>>({})
  const [disliked, setDisliked] = useState<Record<string, boolean>>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const {
    popupVisible,
    triggerIfEligible,
    onTakeSurvey,
    onDismiss: onDismissJtbdPopup,
  } = useJtbdPopup()

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
      <WelcomePanel />
      <div className="styled-scrollbar min-h-0 flex-1 overflow-y-auto pb-2">
        <ChatMessages
          liked={liked}
          disliked={disliked}
          onClickDislike={onClickDislike}
          onClickLike={onClickLike}
          messages={messages}
          status={status}
          messagesEndRef={messagesEndRef}
          showJtbdPopup={popupVisible}
          onTakeSurvey={onTakeSurvey}
          onDismissJtbdPopup={onDismissJtbdPopup}
        />
      </div>
      {agentUrlError && <ChatError error={agentUrlError} />}
      {chatError && <ChatError error={chatError} />}
      <div className="shrink-0 border-border/40 border-t bg-background/80 p-2 backdrop-blur-md">
        <form
          onSubmit={onSubmit}
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

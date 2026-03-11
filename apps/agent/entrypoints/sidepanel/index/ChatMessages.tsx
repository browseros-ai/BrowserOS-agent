import type { UIMessage } from 'ai'
import { Bot } from 'lucide-react'
import { type FC, Fragment, memo, type RefObject, useMemo } from 'react'
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation'
import {
  Message,
  MessageContent,
  MessageResponse,
} from '@/components/ai-elements/message'
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from '@/components/ai-elements/reasoning'
import type { ChatAction } from '@/lib/chat-actions/types'
import { ChatMessageActions } from './ChatMessageActions'
import { ConnectAppCard } from './ConnectAppCard'
import { getMessageSegments } from './getMessageSegments'
import { JtbdPopup } from './JtbdPopup'
import { ScheduleSuggestionCard } from './ScheduleSuggestionCard'
import { ToolBatch } from './ToolBatch'
import { UserActionMessage } from './UserActionMessage'

interface ChatMessagesProps {
  messages: UIMessage[]
  status: 'streaming' | 'submitted' | 'ready' | 'error'
  messagesEndRef: RefObject<HTMLDivElement | null>
  getActionForMessage?: (message: UIMessage) => ChatAction | undefined
  liked: Record<string, boolean>
  onClickLike: (messageId: string) => void
  disliked: Record<string, boolean>
  onClickDislike: (messageId: string, comment?: string) => void
  showJtbdPopup: boolean
  showDontShowAgain: boolean
  onTakeSurvey: (opts?: { dontShowAgain?: boolean }) => void
  onDismissJtbdPopup: (dontShowAgain: boolean) => void
}

interface ChatMessageItemProps {
  message: UIMessage
  isLastMessage: boolean
  isStreaming: boolean
  action?: ChatAction
  liked: boolean
  disliked: boolean
  onClickLike: (messageId: string) => void
  onClickDislike: (messageId: string, comment?: string) => void
}

const ChatMessageItem = memo<ChatMessageItemProps>(
  ({
    message,
    isLastMessage,
    isStreaming,
    action,
    liked,
    disliked,
    onClickLike,
    onClickDislike,
  }) => {
    const segments = useMemo(
      () => getMessageSegments(message, isLastMessage, isStreaming),
      [message, isLastMessage, isStreaming],
    )

    const toolBatches = segments.filter((s) => s.type === 'tool-batch')
    const lastToolBatchKey = toolBatches[toolBatches.length - 1]?.key

    const messageText = segments
      .filter((each) => each.type === 'text')
      .map((each) => each.text)
      .join('\n\n')

    const showActions =
      message.role === 'assistant' && (!isLastMessage || !isStreaming)

    return (
      <Fragment key={message.id}>
        <Message from={message.role}>
          <MessageContent>
            {action ? (
              <UserActionMessage action={action} />
            ) : (
              segments.map((segment) => {
                switch (segment.type) {
                  case 'text':
                    return (
                      <MessageResponse key={segment.key}>
                        {segment.text}
                      </MessageResponse>
                    )
                  case 'reasoning':
                    return (
                      <Reasoning
                        key={segment.key}
                        className="w-full"
                        isStreaming={segment.isStreaming}
                      >
                        <ReasoningTrigger />
                        <ReasoningContent>{segment.text}</ReasoningContent>
                      </Reasoning>
                    )
                  case 'tool-batch':
                    return (
                      <ToolBatch
                        key={segment.key}
                        tools={segment.tools}
                        isLastBatch={segment.key === lastToolBatchKey}
                        isLastMessage={isLastMessage}
                        isStreaming={isStreaming}
                      />
                    )
                  case 'nudge':
                    return segment.nudgeType === 'schedule_suggestion' ? (
                      <ScheduleSuggestionCard
                        key={segment.key}
                        data={segment.data}
                        isLastMessage={isLastMessage}
                      />
                    ) : (
                      <ConnectAppCard
                        key={segment.key}
                        data={segment.data}
                        isLastMessage={isLastMessage}
                      />
                    )
                  default:
                    return null
                }
              })
            )}
          </MessageContent>
        </Message>
        {showActions ? (
          <ChatMessageActions
            messageId={message.id}
            messageText={messageText}
            liked={liked}
            disliked={disliked}
            onClickLike={() => onClickLike(message.id)}
            onClickDislike={(comment?: string) =>
              onClickDislike(message.id, comment)
            }
          />
        ) : null}
      </Fragment>
    )
  },
  (prev, next) => {
    if (prev.message !== next.message) return false
    if (prev.isLastMessage !== next.isLastMessage) return false
    if (prev.isStreaming !== next.isStreaming) return false
    if (prev.action !== next.action) return false
    if (prev.liked !== next.liked) return false
    if (prev.disliked !== next.disliked) return false
    return true
  },
)

ChatMessageItem.displayName = 'ChatMessageItem'

export const ChatMessages: FC<ChatMessagesProps> = ({
  messages,
  status,
  messagesEndRef,
  getActionForMessage,
  liked,
  disliked,
  onClickLike,
  onClickDislike,
  showJtbdPopup,
  showDontShowAgain,
  onTakeSurvey,
  onDismissJtbdPopup,
}) => {
  const isStreaming = status === 'streaming' || status === 'submitted'

  return (
    <>
      <Conversation className="ph-mask">
        <ConversationContent>
          {messages.map((message, messageIndex) => (
            <ChatMessageItem
              key={message.id}
              message={message}
              isLastMessage={messageIndex === messages.length - 1}
              isStreaming={isStreaming}
              action={getActionForMessage?.(message)}
              liked={liked[message.id] ?? false}
              disliked={disliked[message.id] ?? false}
              onClickLike={onClickLike}
              onClickDislike={onClickDislike}
            />
          ))}
          {showJtbdPopup && (
            <JtbdPopup
              onTakeSurvey={onTakeSurvey}
              onDismiss={onDismissJtbdPopup}
              showDontShowAgain={showDontShowAgain}
            />
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {isStreaming && (
        <div className="flex animate-fadeInUp gap-2 px-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent-orange)] text-white">
            <Bot className="h-3.5 w-3.5" />
          </div>
          <div className="flex items-center gap-1 rounded-xl rounded-tl-none border border-border/50 bg-card px-3 py-2.5 shadow-sm">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--accent-orange)] [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--accent-orange)] [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--accent-orange)]" />
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </>
  )
}

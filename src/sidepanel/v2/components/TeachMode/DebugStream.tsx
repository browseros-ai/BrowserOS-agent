import React, { useEffect, useRef } from 'react'
import { useSidePanelPortMessaging } from '@/sidepanel/hooks'
import { MessageType } from '@/lib/types/messaging'

interface DebugStreamProps {
  messages: string[]
  isRecording: boolean
  onNewMessage: (message: string, messageId?: string) => void
  onClear?: () => void
}

/**
 * Live debug stream showing teach mode events
 * Auto-scrolls to bottom as new messages arrive
 */
export function DebugStream({ messages, isRecording, onNewMessage, onClear }: DebugStreamProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { addMessageListener, removeMessageListener } = useSidePanelPortMessaging()
  const seenMessageIds = useRef<Set<string>>(new Set())

  // Clear seen message IDs when recording state changes
  useEffect(() => {
    seenMessageIds.current.clear()
  }, [isRecording])

  // Listen for teach mode messages from PubSub
  useEffect(() => {
    const handleStreamUpdate = (payload: any) => {
      // Handle new architecture events
      if (payload?.event) {
        const event = payload.event

        // Filter for teach mode messages
        if (event.type === 'message' && event.payload?.content) {
          const content = event.payload.content
          if (content.includes('[TEACH MODE]')) {
            // Use msgId if available, otherwise use content hash
            const messageId = event.payload.msgId || event.id || `${content}_${Date.now()}`

            // Check if we've seen this message before
            if (!seenMessageIds.current.has(messageId)) {
              seenMessageIds.current.add(messageId)
              onNewMessage(content, messageId)
            }
          }
        }
      }
    }

    // Add listener for stream updates
    addMessageListener(MessageType.AGENT_STREAM_UPDATE, handleStreamUpdate)

    return () => {
      removeMessageListener(MessageType.AGENT_STREAM_UPDATE, handleStreamUpdate)
    }
  }, [addMessageListener, removeMessageListener, onNewMessage])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Debug Stream</span>
          {isRecording && (
            <span className="px-2 py-0.5 text-xs bg-green-500/10 text-green-500 rounded">
              LIVE
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {messages.length} messages
          </span>
          {messages.length > 0 && onClear && (
            <button
              onClick={onClear}
              className="p-1 hover:bg-muted rounded transition-colors"
              title="Clear messages"
              aria-label="Clear debug messages"
            >
              <svg className="w-3.5 h-3.5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Messages Container */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-2 space-y-1 font-mono text-xs"
      >
        {messages.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            {isRecording
              ? 'Waiting for events...'
              : 'Start recording to see debug messages'}
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={`msg-${index}`}
              className="px-2 py-1 rounded bg-muted/50 text-foreground/80 break-all animate-in fade-in slide-in-from-bottom-1 duration-200"
            >
              {formatMessage(msg)}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

/**
 * Format debug messages for display
 */
function formatMessage(message: string): string {
  // Remove [TEACH MODE] prefix for cleaner display
  let formatted = message.replace('[TEACH MODE] ', '')

  // Add visual indicators for different event types
  if (formatted.includes('click')) {
    formatted = '🖱️ ' + formatted
  } else if (formatted.includes('navigation')) {
    formatted = '🔗 ' + formatted
  } else if (formatted.includes('change')) {
    formatted = '⌨️ ' + formatted
  } else if (formatted.includes('keydown') || formatted.includes('keyup')) {
    formatted = '⌨️ ' + formatted
  } else if (formatted.includes('Capturing state')) {
    formatted = '📸 ' + formatted
  } else if (formatted.includes('session_start')) {
    formatted = '▶️ ' + formatted
  } else if (formatted.includes('session_end')) {
    formatted = '⏹️ ' + formatted
  } else if (formatted.includes('setViewport')) {
    formatted = '📐 ' + formatted
  }

  return formatted
}
import React, { memo } from 'react'
import { MarkdownContent } from './shared/Markdown'
import { cn } from '@/sidepanel/lib/utils'
import type { Message } from '../stores/chatStore'

interface MessageItemProps {
  message: Message
}

/**
 * MessageItem component
 * Renders individual messages with role-based styling
 * Memoized to prevent re-renders when message hasn't changed
 */
export const MessageItem = memo(function MessageItem({ message }: MessageItemProps) {
  const isUser = message.role === 'user'
  const isError = message.metadata?.error
  
  return (
    <div 
      className={cn(
        'flex w-full animate-in fade-in-0 slide-in-from-bottom-2 duration-300',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      <div 
        className={cn(
          'max-w-[80%] rounded-lg p-3 shadow-sm transition-all duration-200 hover:shadow-md',
          isUser 
            ? 'ml-12 bg-primary text-primary-foreground' 
            : 'mr-12 bg-muted text-foreground',
          isError && 'bg-destructive/10 text-destructive border border-destructive/20'
        )}
      >
        {/* Tool name indicator */}
        {message.metadata?.toolName && (
          <div className="text-xs opacity-70 mb-1">
            Tool: {message.metadata.toolName}
          </div>
        )}
        
        {/* Message content */}
        {isUser ? (
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
        ) : (
          <MarkdownContent 
            content={message.content} 
            className="break-words"
          />
        )}
      </div>
    </div>
  )
})
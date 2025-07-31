import React from 'react'
import { MarkdownContent } from './shared/Markdown'
import { cn } from '@/sidepanel/lib/utils'
import styles from '../styles/components/MessageItem.module.scss'

// Message type - temporary until chatStore is implemented
interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  metadata?: {
    toolName?: string
    error?: boolean
  }
}

interface MessageItemProps {
  message: Message
}

/**
 * MessageItem component
 * Renders individual messages with role-based styling
 */
export function MessageItem({ message }: MessageItemProps) {
  const isUser = message.role === 'user'
  const isError = message.metadata?.error
  
  return (
    <div 
      className={cn(
        styles.messageItem,
        'flex',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      <div 
        className={cn(
          styles.messageContent,
          'max-w-[80%] p-3 rounded-lg',
          isUser 
            ? 'bg-blue-100 text-blue-900 ml-12' 
            : 'bg-gray-100 text-gray-900 mr-12',
          isError && 'bg-red-100 text-red-900'
        )}
      >
        {/* Tool name indicator */}
        {message.metadata?.toolName && (
          <div className="text-xs text-gray-500 mb-1">
            Tool: {message.metadata.toolName}
          </div>
        )}
        
        {/* Message content */}
        {isUser ? (
          <div className="whitespace-pre-wrap">{message.content}</div>
        ) : (
          <MarkdownContent 
            content={message.content} 
            className={styles.markdownContent}
          />
        )}
      </div>
    </div>
  )
}
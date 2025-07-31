import React, { useRef, useEffect } from 'react'
import { MessageItem } from './MessageItem'
import { Button } from '@/sidepanel/components/ui/button'
import { cn } from '@/sidepanel/lib/utils'
import styles from '../styles/components/MessageList.module.scss'

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

interface MessageListProps {
  messages: Message[]
}

/**
 * MessageList component
 * Displays a list of chat messages with auto-scroll and empty state
 */
export function MessageList({ messages }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (containerRef.current) {
      const element = containerRef.current
      element.scrollTo({
        top: element.scrollHeight,
        behavior: 'smooth'
      })
    }
  }, [messages])

  // Example prompts for empty state
  const examplePrompts = [
    'Summarize this page',
    'Find all links on this page',
    'Fill out this form',
    'Extract data from this table'
  ]

  const handleExampleClick = (prompt: string) => {
    // Will be connected to actual input handling later
    console.log('Example prompt clicked:', prompt)
  }
  
  if (messages.length === 0) {
    return (
      <div className={cn(styles.emptyState, 'flex-1 flex flex-col items-center justify-center p-8')}>
        <h2 className="text-xl font-semibold mb-6">What can I help you with?</h2>
        <div className={cn(styles.examples, 'grid grid-cols-2 gap-3 max-w-md')}>
          {examplePrompts.map((prompt, index) => (
            <Button
              key={index}
              variant="outline"
              className="text-sm"
              onClick={() => handleExampleClick(prompt)}
            >
              {prompt}
            </Button>
          ))}
        </div>
      </div>
    )
  }
  
  return (
    <div 
      className={cn(styles.messageList, 'flex-1 overflow-y-auto')}
      ref={containerRef}
    >
      <div className="p-4 space-y-4">
        {messages.map(message => (
          <MessageItem key={message.id} message={message} />
        ))}
      </div>
    </div>
  )
}
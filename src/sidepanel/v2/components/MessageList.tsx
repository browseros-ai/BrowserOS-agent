import React, { useRef, useEffect } from 'react'
import { MessageItem } from './MessageItem'
import { Button } from '@/sidepanel/components/ui/button'

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
    // Create a custom event to set input value
    const event = new CustomEvent('setInputValue', { detail: prompt })
    window.dispatchEvent(event)
  }
  
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <h2 className="text-xl font-semibold text-foreground mb-6">What can I help you with?</h2>
        <div className="grid grid-cols-2 gap-3 max-w-md w-full">
          {examplePrompts.map((prompt, index) => (
            <Button
              key={index}
              variant="outline"
              className="text-sm h-auto py-3 px-4 whitespace-normal hover:bg-accent hover:text-accent-foreground transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
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
      className="flex-1 overflow-y-auto bg-background scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
      ref={containerRef}
    >
      <div className="p-4 space-y-4 pb-2">
        {messages.map(message => (
          <MessageItem key={message.id} message={message} />
        ))}
      </div>
    </div>
  )
}
import React, { useEffect, useState, useMemo } from 'react'
import { MessageItem } from './MessageItem'
import { Button } from '@/sidepanel/components/ui/button'
import { useAutoScroll } from '../hooks/useAutoScroll'
import { useAnalytics } from '../hooks/useAnalytics'
import type { Message } from '../stores/chatStore'

interface MessageListProps {
  messages: Message[]
}

// Example prompts grouped by category
const EXAMPLE_PROMPTS = [
  // Page interaction
  'Summarize this page',
  'Find all links on this page',
  'Extract all email addresses',
  'Copy all images to clipboard',
  
  // Form interaction
  'Fill out this form',
  'Check all checkboxes',
  'Select the first option in dropdowns',
  
  // Data extraction
  'Extract data from this table',
  'Get all prices on this page',
  'Find phone numbers',
  
  // Navigation
  'Click the login button',
  'Go to the next page',
  'Open the first link in a new tab',
  
  // Analysis
  'What does this page do?',
  'Is this page mobile-friendly?',
  'Find broken links'
]

/**
 * MessageList component
 * Displays a list of chat messages with auto-scroll and empty state
 */
export function MessageList({ messages }: MessageListProps) {
  const [promptIndex, setPromptIndex] = useState(0)
  const { containerRef, isUserScrolling, scrollToBottom } = useAutoScroll<HTMLDivElement>([messages])
  const { trackFeature } = useAnalytics()

  // Rotate example prompts every 5 seconds
  useEffect(() => {
    if (messages.length === 0) {
      const timer = setInterval(() => {
        setPromptIndex((prev) => (prev + 4) % EXAMPLE_PROMPTS.length)
      }, 5000)
      
      return () => clearInterval(timer)
    }
  }, [messages.length])

  // Get current set of example prompts
  const currentPrompts = useMemo(() => {
    const prompts = []
    for (let i = 0; i < 4; i++) {
      prompts.push(EXAMPLE_PROMPTS[(promptIndex + i) % EXAMPLE_PROMPTS.length])
    }
    return prompts
  }, [promptIndex])

  const handleExampleClick = (prompt: string) => {
    trackFeature('example_prompt', { prompt })
    // Create a custom event to set input value
    const event = new CustomEvent('setInputValue', { detail: prompt })
    window.dispatchEvent(event)
  }
  
  if (messages.length === 0) {
    return (
      <div 
        className="flex-1 flex flex-col items-center justify-center p-8 text-center"
        role="region"
        aria-label="Welcome screen with example prompts"
      >
        <h2 className="text-xl font-semibold text-foreground mb-6">What can I help you with?</h2>
        <div 
          className="grid grid-cols-2 gap-3 max-w-md w-full"
          role="group"
          aria-label="Example prompts"
        >
          {currentPrompts.map((prompt, index) => (
            <Button
              key={`${promptIndex}-${index}`}
              variant="outline"
              className="text-sm h-auto py-3 px-4 whitespace-normal hover:bg-accent hover:text-accent-foreground transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md animate-in fade-in duration-500 focus:ring-2 focus:ring-primary"
              onClick={() => handleExampleClick(prompt)}
              aria-label={`Use example: ${prompt}`}
            >
              {prompt}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-4" aria-live="polite">
          Examples refresh every few seconds
        </p>
      </div>
    )
  }
  
  return (
    <div className="flex-1 relative">
      <div 
        className="h-full overflow-y-auto bg-background scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
        ref={containerRef}
        role="log"
        aria-label="Chat messages"
        aria-live="polite"
        tabIndex={0}
      >
        <div className="p-4 space-y-4 pb-2">
          {messages.map(message => (
            <MessageItem key={message.id} message={message} />
          ))}
        </div>
      </div>
      
      {/* Scroll to bottom button */}
      {isUserScrolling && (
        <button
          onClick={() => {
            trackFeature('scroll_to_bottom')
            scrollToBottom()
          }}
          className="absolute bottom-4 right-4 p-2 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 focus:ring-2 focus:ring-primary focus:ring-offset-2"
          aria-label="Scroll to bottom of messages"
          type="button"
        >
          <svg 
            className="w-5 h-5" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M19 14l-7 7m0 0l-7-7m7 7V3" 
            />
          </svg>
        </button>
      )}
    </div>
  )
}
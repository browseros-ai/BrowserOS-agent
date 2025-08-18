import React, { useRef, useState, useEffect, useCallback, memo } from 'react'
import { MessageItem } from './MessageItem'
import { useAutoScroll } from '../hooks/useAutoScroll'
import type { Message } from '../stores/chatStore'

interface VirtualMessageListProps {
  messages: Message[]
  itemHeight?: number  // Estimated height of each message
  overscan?: number  // Number of items to render outside visible area
}

/**
 * Virtual scrolling message list for performance with large message counts
 * Only renders visible messages plus overscan buffer
 */
export const VirtualMessageList = memo(function VirtualMessageList({ 
  messages, 
  itemHeight = 80,  // Estimated average message height
  overscan = 5 
}: VirtualMessageListProps) {
  const { containerRef, isUserScrolling, scrollToBottom } = useAutoScroll<HTMLDivElement>([messages])
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 })
  const heightMapRef = useRef<Map<string, number>>(new Map())
  
  // Calculate which messages should be visible
  const calculateVisibleRange = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    
    const scrollTop = container.scrollTop
    const clientHeight = container.clientHeight
    
    // Simple calculation based on estimated height
    const estimatedStart = Math.floor(scrollTop / itemHeight)
    const estimatedEnd = Math.ceil((scrollTop + clientHeight) / itemHeight)
    
    // Add overscan
    const start = Math.max(0, estimatedStart - overscan)
    const end = Math.min(messages.length, estimatedEnd + overscan)
    
    setVisibleRange({ start, end })
  }, [messages.length, itemHeight, overscan])
  
  // Update visible range on scroll
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    
    const handleScroll = () => {
      requestAnimationFrame(calculateVisibleRange)
    }
    
    container.addEventListener('scroll', handleScroll, { passive: true })
    calculateVisibleRange()  // Initial calculation
    
    return () => {
      container.removeEventListener('scroll', handleScroll)
    }
  }, [calculateVisibleRange])
  
  // Recalculate when messages change
  useEffect(() => {
    calculateVisibleRange()
  }, [messages, calculateVisibleRange])
  
  // Calculate total height for scrollbar
  const totalHeight = messages.length * itemHeight
  
  // Only render visible messages
  const visibleMessages = messages.slice(visibleRange.start, visibleRange.end)
  const offsetY = visibleRange.start * itemHeight
  
  // Performance optimization: Skip virtualization for small lists
  if (messages.length < 50) {
    return (
      <div className="flex-1 relative">
        <div 
          className="h-full overflow-y-auto bg-background"
          ref={containerRef}
        >
          <div className="p-4 space-y-4 pb-2">
            {messages.map(message => (
              <MessageItem key={message.msgId} message={message} />
            ))}
          </div>
        </div>
        
        {isUserScrolling && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-4 right-4 p-2 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-all duration-200 animate-in fade-in slide-in-from-bottom-2"
            aria-label="Scroll to bottom"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </button>
        )}
      </div>
    )
  }
  
  // Virtual scrolling for large lists
  return (
    <div className="flex-1 relative">
      <div 
        className="h-full overflow-y-auto bg-background"
        ref={containerRef}
      >
        {/* Total height spacer for proper scrollbar */}
        <div style={{ height: totalHeight, position: 'relative' }}>
          {/* Rendered messages container */}
          <div 
            className="p-4 space-y-4"
            style={{
              transform: `translateY(${offsetY}px)`,
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0
            }}
          >
            {visibleMessages.map((message, index) => (
              <MessageItem 
                key={message.msgId} 
                message={message} 
              />
            ))}
          </div>
        </div>
      </div>
      
      {isUserScrolling && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 right-4 p-2 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-all duration-200 animate-in fade-in slide-in-from-bottom-2"
          aria-label="Scroll to bottom"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
      )}
    </div>
  )
})
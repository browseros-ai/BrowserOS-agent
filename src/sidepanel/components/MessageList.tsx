import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { MessageItem } from './MessageItem'
import { CollapsibleThoughts } from './CollapsibleThoughts'
import { Button } from '@/sidepanel/components/ui/button'
import { useAutoScroll } from '../hooks/useAutoScroll'
import { useAnalytics } from '../hooks/useAnalytics'
import { cn } from '@/sidepanel/lib/utils'
import type { Message } from '../stores/chatStore'

interface MessageListProps {
  messages: Message[]
  onScrollStateChange?: (isUserScrolling: boolean) => void
  scrollToBottom?: () => void
  containerRef?: React.RefObject<HTMLDivElement>
}

// Example prompts grouped by category
const ALL_EXAMPLES = [
  // Tab Management
  "Group my tabs by app or purpose",
  "Find tabs related to machine learning",
  // "Close tabs I haven't touched in 7 days",
  "Highlight the tab where I was last shopping",
  "Save all Facebook tabs to a reading list",
  // "Pin tabs I use daily",
  // "Archive tabs from last week's research",
  // "Reopen the tab I accidentally closed",
  // "Mute all tabs except the one playing music",

  // Page Analysis
  "Summarize this article for me",
  "What are the key points on this page?",
  // "Check if this article is AI-generated",
  "Extract all links and sources from this page",
  "Extract all news headlines from this page",
  // "List all images and their alt text",
  // "Detect the reading level of this article",
  // "Highlight quotes or cited studies",
  // "Compare this page to another tab I'm viewing",

  // Search & Discovery
  "Find top-rated headphones under $100",
  // "Find the cheapest flight to San Francisco",
  "Search YouTube for videos explaining BrowserOS",
  // "Look up reviews for this product",
  "Search Reddit for discussions about this topic",
  // "Find recipes using the ingredients in my tabs",
  // "Show me recent news about this company",
  // "Search for open-source alternatives to this tool",

  // Actions & Automation
  "Open amazon.com and order Sensodyne toothpaste",
  "Write a tweet saying Hello World",
  // "Add this page to my bookmarks",
  // "Download the PDF linked on this page",
  // "Translate this page to Spanish",
  // "Email this article to myself",
  // "Create a calendar event based on this page",
  // "Copy all code snippets from this tab",

  // AI & Content Tools
  // "Rewrite this paragraph to be more concise",
  "Generate a summary tweet for this article",
  // "Explain this code like I'm five",
  // "Draft a reply to this comment",
  "Rate the tone of this blog post",
  // "Suggest improvements to this documentation",
  "Turn this article into a LinkedIn post",
  // "Detect bias or opinionated language in this page",
]

// Animation constants  
const DEFAULT_DISPLAY_COUNT = 5 // Default number of examples to show

/**
 * MessageList component
 * Displays a list of chat messages with auto-scroll and empty state
 */
export function MessageList({ messages, onScrollStateChange, scrollToBottom: externalScrollToBottom, containerRef: externalContainerRef }: MessageListProps) {
  const { containerRef: internalContainerRef, isUserScrolling, scrollToBottom } = useAutoScroll<HTMLDivElement>([messages], externalContainerRef)
  const { trackFeature } = useAnalytics()
  const [, setIsAtBottom] = useState(true)
  const [currentExamples, setCurrentExamples] = useState<string[]>([])
  const [shuffledPool, setShuffledPool] = useState<string[]>([])
  const [isAnimating] = useState(false)
  const [displayCount, setDisplayCount] = useState(DEFAULT_DISPLAY_COUNT)
  
  // Track previously seen message IDs to determine which are new
  const previousMessageIdsRef = useRef<Set<string>>(new Set())
  const newMessageIdsRef = useRef<Set<string>>(new Set())

  // Use external container ref if provided, otherwise use internal one
  const containerRef = externalContainerRef || internalContainerRef
  
  // Adjust display count based on viewport height
  useEffect(() => {
    const updateDisplayCount = () => {
      const height = window.innerHeight
      setDisplayCount(height < 700 ? 3 : DEFAULT_DISPLAY_COUNT)
    }
    
    updateDisplayCount()
    window.addEventListener('resize', updateDisplayCount)
    return () => window.removeEventListener('resize', updateDisplayCount)
  }, [])

  // Track new messages for animation
  useEffect(() => {
    const currentMessageIds = new Set(messages.map(msg => msg.msgId))
    const previousIds = previousMessageIdsRef.current
    
    // Find new messages (in current but not in previous)
    const newIds = new Set<string>()
    currentMessageIds.forEach(id => {
      if (!previousIds.has(id)) {
        newIds.add(id)
      }
    })
    
    newMessageIdsRef.current = newIds
    previousMessageIdsRef.current = currentMessageIds
  }, [messages])

  // Process messages and group narrations
  const { processedBlocks } = useMemo(() => {
    const blocks: Array<{ type: 'message' | 'narration-group' | 'collapsed-thoughts', messages: Message[] }> = []
    const allNarrations: Message[] = []  // All narration messages
    let hasSeenAssistant = false
    
    // Process messages in order
    messages.forEach((message) => {
      const isNarration = message.role === 'narration'
      const isAssistant = message.role === 'assistant'
      const isThinking = message.role === 'thinking'
      // const isTodoTable = message.content.includes('| # | Status | Task |')
      
      // When we see an assistant message, collapse all previous narrations
      if (isAssistant) {
        hasSeenAssistant = true
        
        // If we have narrations, put them ALL in collapsed thoughts
        if (allNarrations.length > 0) {
          blocks.push({ type: 'collapsed-thoughts', messages: [...allNarrations] })
          allNarrations.length = 0  // Clear for any future narrations
        }
        
        // Add the assistant message
        blocks.push({ type: 'message', messages: [message] })
      }
      // Handle narration messages
      else if (isNarration) {
        if (hasSeenAssistant) {
          // After assistant message, clear old narrations and start fresh
          allNarrations.length = 0
          hasSeenAssistant = false
        }
        
        allNarrations.push(message)
      }
      // Handle thinking messages (including TODO tables)
      else if (isThinking) {
        
        // Add thinking message
        blocks.push({ type: 'message', messages: [message] })
      }
      // Handle other message types
      else {
        blocks.push({ type: 'message', messages: [message] })
      }
    })
    
    // Process narrations at the end - always use CollapsibleThoughts for consistency
    if (allNarrations.length > 0 && !hasSeenAssistant) {
      if (allNarrations.length > 3) {
        // More than 3: split into collapsed and visible
        const collapsedCount = allNarrations.length - 3
        const collapsedMessages = allNarrations.slice(0, collapsedCount)
        const visibleMessages = allNarrations.slice(collapsedCount)
        
        blocks.push({ type: 'collapsed-thoughts', messages: collapsedMessages })
        blocks.push({ type: 'narration-group', messages: visibleMessages })
      } else {
        // 3 or fewer: show empty CollapsibleThoughts header + all messages visible
        blocks.push({ type: 'collapsed-thoughts', messages: [] })
        blocks.push({ type: 'narration-group', messages: allNarrations })
      }
    }
    
    return { processedBlocks: blocks }
  }, [messages])
  
  // Track the currently executing narration message
  const currentlyExecutingNarration = useMemo(() => {
    // Find the last narration message that doesn't have a following assistant message
    const lastNarrationIndex = messages.findLastIndex(m => m.role === 'narration')
    if (lastNarrationIndex === -1) return null
    
    // Check if there's an assistant message after this narration
    const hasAssistantAfter = messages.slice(lastNarrationIndex + 1).some(m => m.role === 'assistant')
    if (hasAssistantAfter) return null
    
    return messages[lastNarrationIndex]?.msgId
  }, [messages])

  // Initialize shuffled pool and current examples
  useEffect(() => {
    const shuffled = [...ALL_EXAMPLES].sort(() => 0.5 - Math.random())
    setShuffledPool(shuffled)
    
    // Get initial examples based on display count
    const initialExamples: string[] = []
    for (let i = 0; i < displayCount; i++) {
      if (shuffled.length > 0) {
        initialExamples.push(shuffled.pop()!)
      }
    }
    setCurrentExamples(initialExamples)
  }, [displayCount])

  // Function to get random examples from pool
  const _getRandomExample = useCallback((count: number = 1): string[] => {
    const result: string[] = []
    let pool = [...shuffledPool]

    while (result.length < count) {
      // If exhausted, reshuffle
      if (pool.length === 0) {
        pool = [...ALL_EXAMPLES].sort(() => 0.5 - Math.random())
      }
      result.push(pool.pop()!)
    }

    // Update the pool
    setShuffledPool(pool)
    return result
  }, [shuffledPool])

  // Refresh examples only when the welcome view is shown (on mount or when messages become empty)
  const wasEmptyRef = useRef<boolean>(messages.length === 0)
  useEffect(() => {
    const isEmpty = messages.length === 0
    if (isEmpty && !wasEmptyRef.current) {
      // Reinitialize examples when transitioning back to empty state
      const shuffled = [...ALL_EXAMPLES].sort(() => 0.5 - Math.random())
      setShuffledPool(shuffled)
      const initialExamples: string[] = []
      for (let i = 0; i < displayCount; i++) {
        if (shuffled.length > 0) initialExamples.push(shuffled.pop()!)
      }
      setCurrentExamples(initialExamples)
    }
    wasEmptyRef.current = isEmpty
  }, [messages.length, displayCount])

  // Check if we're at the bottom of the scroll container
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const checkIfAtBottom = () => {
      const scrollDistance = container.scrollHeight - container.scrollTop - container.clientHeight
      const isNearBottom = scrollDistance < 100 // Increased threshold for better detection
      setIsAtBottom(isNearBottom)
      
      const shouldShowScrollButton = !isNearBottom && isUserScrolling
      onScrollStateChange?.(shouldShowScrollButton)
    }

    // Check initially after a small delay to ensure container is rendered
    setTimeout(checkIfAtBottom, 100)

    // Check on scroll
    container.addEventListener('scroll', checkIfAtBottom, { passive: true })
    
    // Also check when messages change
    checkIfAtBottom()
    
    return () => {
      container.removeEventListener('scroll', checkIfAtBottom)
    }
  }, [containerRef, onScrollStateChange, messages.length, isUserScrolling]) // Added isUserScrolling dependency

  // Use external scroll function if provided, otherwise use internal one
  const _handleScrollToBottom = () => {
    trackFeature('scroll_to_bottom')
    if (externalScrollToBottom) {
      externalScrollToBottom()
    } else {
      scrollToBottom()
    }
  }

  const handleExampleClick = (prompt: string) => {
    trackFeature('example_prompt', { prompt })
    // Create a custom event to set input value
    const event = new CustomEvent('setInputValue', { detail: prompt })
    window.dispatchEvent(event)
  }
  
  // Landing View
  if (messages.length === 0) {
    return (
      <div 
        className="flex-1 flex flex-col items-center justify-start p-8 text-center relative overflow-hidden pt-16"
        style={{ paddingBottom: '180px' }}
        role="region"
        aria-label="Welcome screen with example prompts"
      >
              {/* Animated paw prints running across the screen */}
      {/*<AnimatedPawPrints />*/}

      {/* Orange glow spotlights removed */}

        {/* Main content */}
        <div className="relative z-0">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-foreground animate-fade-in-up">
              Welcome to BrowserOS
            </h2>
            <p className="text-muted-foreground text-lg animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              Your <span className="text-brand">agentic</span> web assistant
            </p>
          </div>

          {/* Example Prompts */}
          <div className="mb-8 mt-16">
            <h3 className="text-lg font-semibold text-foreground mb-6 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
              What would you like to do?
            </h3>
            <div 
              className={`flex flex-col items-center max-w-md w-full space-y-3 transition-transform duration-500 ease-in-out ${
                isAnimating ? 'translate-y-5' : ''
              }`}
              role="group"
              aria-label="Example prompts"
            >
              {currentExamples.map((prompt, index) => (
                <div 
                  key={`${prompt}-${index}`} 
                  className={`relative w-full transition-all duration-500 ease-in-out ${
                    isAnimating && index === 0 ? 'animate-fly-in-top' : 
                    isAnimating && index === currentExamples.length - 1 ? 'animate-fly-out-bottom' : ''
                  }`}
                >
                  <Button
                    variant="outline"
                    className="group relative text-sm h-auto py-3 px-4 whitespace-normal bg-background/50 backdrop-blur-sm border-2 border-brand/30 hover:border-brand hover:bg-brand/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none overflow-hidden w-full"
                    onClick={() => handleExampleClick(prompt)}
                    aria-label={`Use example: ${prompt}`}
                  >
                    {/* Animated background */}
                    <div className="absolute inset-0 bg-gradient-to-r from-brand/0 via-brand/5 to-brand/0 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                    
                    {/* Content */}
                    <span className="relative z-10 font-medium text-foreground group-hover:text-brand transition-colors duration-300">
                      {prompt}
                    </span>
                    
                    {/* Glow effect */}
                    <div className="absolute inset-0 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-brand/20 to-transparent"></div>
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }
  
  // Chat View
  return (
    <div className="h-full flex flex-col">
      
      {/* Messages container */}
      <div 
        className="flex-1 overflow-y-auto overflow-x-hidden bg-[hsl(var(--background))]"
        ref={containerRef}
        role="log"
        aria-label="Chat messages"
        aria-live="polite"
        tabIndex={0}
      >
        {/* Messages List */}
        <div className="p-6 space-y-3 pb-4">
          {(() => {
            // Group consecutive collapsed-thoughts and narration-group blocks
            const renderedBlocks: React.ReactNode[] = []
            let i = 0
            
            while (i < processedBlocks.length) {
              const block = processedBlocks[i]
              const nextBlock = processedBlocks[i + 1]
              
              // Check if we have a collapsed-thoughts followed by narration-group
              if (block.type === 'collapsed-thoughts' && nextBlock?.type === 'narration-group') {
                // Render them together
                renderedBlocks.push(
                  <div key={`thoughts-narrations-${i}`}>
                    {/* Thoughts header */}
                    <CollapsibleThoughts
                      messages={block.messages}
                    />
                    
                    {/* Visible narrations with thread line */}
                    <div className="relative">
                      {/* Thread line aligned with messages */}
                      <div className="absolute left-[16px] top-0 bottom-0 w-px bg-gradient-to-b from-brand/40 via-brand/30 to-brand/20" />
                      
                      {nextBlock.messages.map((message, index) => {
                        const isCurrentlyExecuting = message.msgId === currentlyExecutingNarration
                        const isNewMessage = newMessageIdsRef.current.has(message.msgId)
                        
                        return (
                          <div
                            key={message.msgId}
                            className={cn(
                              "relative pl-8",
                              isNewMessage ? 'animate-fade-in' : ''
                            )}
                            style={{ animationDelay: isNewMessage ? `${index * 0.1}s` : undefined }}
                          >
                            {/* Active indicator dot */}
                            {isCurrentlyExecuting && (
                              <div 
                                className="absolute left-[12px] top-[8px] w-2 h-2 rounded-full animate-pulse"
                                style={{ backgroundColor: '#FB661F' }}
                                aria-label="Currently executing"
                              />
                            )}
                            
                            <MessageItem 
                              message={message} 
                              shouldIndent={false}
                              showLocalIndentLine={false}
                              applyIndentMargin={false}
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
                i += 2  // Skip both blocks
              }
              // Standalone collapsed-thoughts (when assistant message collapsed all)
              else if (block.type === 'collapsed-thoughts') {
                renderedBlocks.push(
                  <div key={`collapsed-${i}`}>
                    <CollapsibleThoughts
                      messages={block.messages}
                    />
                  </div>
                )
                i++
              }
              // Standalone narration-group (when <= 3 narrations)
              else if (block.type === 'narration-group') {
                renderedBlocks.push(
                  <div 
                    key={`narration-group-${i}`}
                    className="relative"
                  >
                    {/* Thread line connecting all narrations */}
                    <div className="absolute left-[16px] top-0 bottom-0 w-px bg-gradient-to-b from-brand/40 via-brand/30 to-brand/20" />
                    
                    {block.messages.map((message, index) => {
                      const isCurrentlyExecuting = message.msgId === currentlyExecutingNarration
                      const isNewMessage = newMessageIdsRef.current.has(message.msgId)
                      
                      return (
                        <div
                          key={message.msgId}
                          className={cn(
                            "relative pl-8",
                            isNewMessage ? 'animate-fade-in' : ''
                          )}
                          style={{ animationDelay: isNewMessage ? `${index * 0.1}s` : undefined }}
                        >
                          {/* Active indicator dot */}
                          {isCurrentlyExecuting && (
                            <div 
                              className="absolute left-[12px] top-[8px] w-2 h-2 rounded-full animate-pulse"
                              style={{ backgroundColor: '#FB661F' }}
                              aria-label="Currently executing"
                            />
                          )}
                          
                          <MessageItem 
                            message={message} 
                            shouldIndent={false}
                            showLocalIndentLine={false}
                            applyIndentMargin={false}
                          />
                        </div>
                      )
                    })}
                  </div>
                )
                i++
              }
              else {
                // Handle other block types (messages, thinking, etc.)
                const message = block.messages[0]
                if (!message) {
                  i++
                  continue
                }
                
                const isNewMessage = newMessageIdsRef.current.has(message.msgId)
                const isTodoTable = message.content.includes('| # | Status | Task |')
                const isThinking = message.role === 'thinking'
                const shouldIndent = isThinking && !isTodoTable
                
                renderedBlocks.push(
                  <div
                    key={message.msgId}
                    className={isNewMessage ? 'animate-fade-in' : ''}
                    style={{ animationDelay: isNewMessage ? '0.1s' : undefined }}
                  >
                    {shouldIndent ? (
                      <div className="relative before:content-[''] before:absolute before:left-[8px] before:top-0 before:bottom-0 before:w-px before:bg-gradient-to-b before:from-brand/40 before:via-brand/30 before:to-brand/20">
                        <MessageItem 
                          message={message} 
                          shouldIndent={true}
                          showLocalIndentLine={false}
                          applyIndentMargin={false}
                        />
                      </div>
                    ) : (
                      <MessageItem 
                        message={message} 
                        shouldIndent={false}
                        showLocalIndentLine={false}
                      />
                    )}
                  </div>
                )
                i++
              }
            }
            
            return renderedBlocks
          })()}
        </div>
      </div>
      
    </div>
  )
}

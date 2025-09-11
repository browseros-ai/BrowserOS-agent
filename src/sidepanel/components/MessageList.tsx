import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { MessageItem } from './MessageItem'
import { CollapsibleThoughts } from './CollapsibleThoughts'
import { TypingIndicator } from './TypingIndicator'
import { GroupedThinkingSection } from './GroupedThinkingSection'
import { GroupedPlanningSection } from './GroupedPlanningSection'
import { GroupedExecutionSection } from './GroupedExecutionSection'
import { ParentCollapsibleWrapper } from './ParentCollapsibleWrapper'
import { AgentActivitySkeleton } from './skeleton/AgentActivitySkeleton'
import { ThinkingSkeleton } from './skeleton/ThinkingSkeleton'
import { PlanningSkeleton } from './skeleton/PlanningSkeleton'
import { ExecutionSkeleton } from './skeleton/ExecutionSkeleton'
import { Button } from '@/sidepanel/components/ui/button'
import { useAutoScroll } from '../hooks/useAutoScroll'
import { useAnalytics } from '../hooks/useAnalytics'
import { cn } from '@/sidepanel/lib/utils'
import type { Message } from '../stores/chatStore'

interface MessageListProps {
  messages: Message[]
  isProcessing?: boolean
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
export function MessageList({ messages, isProcessing = false, onScrollStateChange, scrollToBottom: externalScrollToBottom, containerRef: externalContainerRef }: MessageListProps) {
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

  // Group consecutive thinking, planning, and execution messages
  const messageGroups = useMemo(() => {
    const groups: Array<{ type: 'thinking-group' | 'planning-group' | 'execution-group' | 'single', messages: Message[] }> = []
    let currentGroup: Message[] = []
    let currentGroupType: 'thinking' | 'planning' | 'execution' | null = null
    
    const isThinkingMessage = (message: Message) => {
      return message.role === 'thinking' && 
             !message.content.includes('| # | Status | Task |') && // Not a TODO table
             !message.metadata?.toolName && // Not a tool result
             !message.content.includes('_tool') // Not a tool-related message
    }
    
    const isPlanCreatedMessage = (message: Message) => {
      return message.role === 'thinking' && 
             /Created plan with \d+ steps?/i.test(message.content)
    }
    
    const isPlanningMessage = (message: Message) => {
      if (message.role !== 'thinking') return false
      
      // Check for planning patterns
      const planningPatterns = [
        /Created \d+ step execution plan/i,    // Created 5 step execution plan
        /^- \[ \]/m,                          // Unchecked task items (plan steps)
        /Navigate to/i,                       // Plan steps like "Navigate to Amazon.com"
        /Search for/i,                        // Plan steps like "Search for 'pen'"
        /Select a suitable/i,                 // Plan steps like "Select a suitable pen"
        /Add the selected/i,                  // Plan steps like "Add the selected pen to cart"
        /Proceed to checkout/i,               // Plan steps like "Proceed to checkout"
        /execution plan/i                     // General execution plan mentions
      ]
      
      return planningPatterns.some(pattern => pattern.test(message.content))
    }
    
    const isExecutionMessage = (message: Message) => {
      if (message.role !== 'thinking') return false
      
      // Check for actual execution patterns from the logs
      const executionPatterns = [
        /Navigating to:/i,           // Navigating to: https://...
        /Finding element/i,          // Finding element to click/type
        /Typed .* into/i,            // Typed "text" into element
        /Clicked element/i,          // Clicked element: button
        /Pressing key/i,             // Pressing key
        /Scrolling/i,                // Scrolling
        /Taking screenshot/i,        // Taking screenshot
        /## Step \d+/,              // ## Step 1
        /### Step \d+/,             // ### Step 1  
        /\*\*Step \d+/,             // **Step 1
        /Step \d+:/,                // Step 1:
        /Executing step/i,          // Executing step
        /\*\*Execution Plan\*\*/,   // **Execution Plan**
        /_tool/,                    // Tool-related
        /Calling tool/i,            // Calling tool
        /Tool call/i,               // Tool call
        /Using tool/i,              // Using tool
        /^- \[x\]/m,                // Completed task checkboxes (execution updates)
        /Current URL:/i,            // Browser state updates
        /next uncompleted task/i    // Task execution updates
      ]
      
      // Check metadata for tool usage
      if (message.metadata?.toolName) {
        return true
      }
      
      // Check content patterns
      return executionPatterns.some(pattern => pattern.test(message.content))
    }
    
    const finishCurrentGroup = () => {
      if (currentGroup.length > 0) {
        if (currentGroup.length > 1 && currentGroupType) {
          const groupType = currentGroupType === 'thinking' ? 'thinking-group' : 
                           currentGroupType === 'planning' ? 'planning-group' : 'execution-group'
          groups.push({ 
            type: groupType, 
            messages: [...currentGroup] 
          })
        } else {
          groups.push({ type: 'single', messages: [...currentGroup] })
        }
        currentGroup = []
        currentGroupType = null
      }
    }
    
    messages.forEach(message => {
      const isThinking = isThinkingMessage(message)
      const isPlanning = isPlanningMessage(message)
      const isExecution = isExecutionMessage(message)
      
      if (isThinking && !isPlanning && !isExecution) {
        // Check if this is a plan creation message that ends thinking phase
        if (isPlanCreatedMessage(message)) {
          // Add this message to current thinking group (if any)
          if (currentGroupType === 'thinking') {
            currentGroup.push(message)
          } else {
            // Start a new thinking group with just this message
            finishCurrentGroup()
            currentGroup = [message]
            currentGroupType = 'thinking'
          }
          // Finish the thinking group after plan creation
          finishCurrentGroup()
        } else {
          // Regular thinking message
          if (currentGroupType === 'thinking') {
            currentGroup.push(message)
          } else {
            finishCurrentGroup()
            currentGroup = [message]
            currentGroupType = 'thinking'
          }
        }
      } else if (isPlanning) {
        // Planning message
        if (currentGroupType === 'planning') {
          currentGroup.push(message)
        } else {
          finishCurrentGroup()
          currentGroup = [message]
          currentGroupType = 'planning'
        }
      } else if (isExecution) {
        // Execution message
        if (currentGroupType === 'execution') {
          currentGroup.push(message)
        } else {
          finishCurrentGroup()
          currentGroup = [message]
          currentGroupType = 'execution'
        }
      } else {
        // Other message types (user, assistant, etc.)
        finishCurrentGroup()
        groups.push({ type: 'single', messages: [message] })
      }
    })
    
    // Handle remaining messages in group
    finishCurrentGroup()
    
    return groups
  }, [messages])
  
  // Track currently executing narration for legacy narration blocks only
  const currentlyExecutingNarration = useMemo(() => {
    const lastNarrationIndex = messages.findLastIndex(m => m.role === 'narration')
    return lastNarrationIndex !== -1 && 
      !messages.slice(lastNarrationIndex + 1).some(m => m.role === 'assistant') ? 
      messages[lastNarrationIndex]?.msgId : null
  }, [messages])
  
  // Process narrations separately (only for narration messages, not thinking/execution)
  const narrationBlocks = useMemo(() => {
    const blocks: Array<{ type: 'narration-group' | 'collapsed-thoughts', messages: Message[] }> = []
    const allNarrations: Message[] = []
    let hasSeenAssistant = false
    
    // Only process narration messages (exclude thinking/execution which are handled by messageGroups)
    messages.forEach((message) => {
      if (message.role === 'assistant') {
        hasSeenAssistant = true
        if (allNarrations.length > 0) {
          blocks.push({ type: 'collapsed-thoughts', messages: [...allNarrations] })
          allNarrations.length = 0
        }
      } else if (message.role === 'narration') {
        if (!hasSeenAssistant) {
          allNarrations.push(message)
        }
      }
    })
    
    // Process remaining narrations
    if (allNarrations.length > 0 && !hasSeenAssistant) {
      if (allNarrations.length > 3) {
        const collapsedCount = allNarrations.length - 3
        const collapsedMessages = allNarrations.slice(0, collapsedCount)
        const visibleMessages = allNarrations.slice(collapsedCount)
        blocks.push({ type: 'collapsed-thoughts', messages: collapsedMessages })
        blocks.push({ type: 'narration-group', messages: visibleMessages })
      } else {
        blocks.push({ type: 'collapsed-thoughts', messages: [] })
        blocks.push({ type: 'narration-group', messages: allNarrations })
      }
    }
    
    return blocks
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
                    className="group relative text-sm h-auto py-3 px-4 whitespace-normal bg-background/50 backdrop-blur-sm border-2 border-brand/30 hover:border-brand hover:bg-brand/5 smooth-hover smooth-transform hover:scale-105 hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none overflow-hidden w-full message-enter"
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
          {/* Render thinking groups and other messages */}
          {(() => {
            const elements = []
            const groupedSections = []
            
            for (let groupIndex = 0; groupIndex < messageGroups.length; groupIndex++) {
              const group = messageGroups[groupIndex]
              const key = `group-${groupIndex}`
              
              if (group.type === 'thinking-group' || group.type === 'planning-group' || group.type === 'execution-group') {
                // Collect ALL grouped sections for single parent wrapper (all cycles)
                if (group.type === 'thinking-group') {
                  groupedSections.push(
                    <GroupedThinkingSection
                      key={key}
                      messages={group.messages}
                      isLatest={groupIndex === messageGroups.length - 1}
                    />
                  )
                } else if (group.type === 'planning-group') {
                  groupedSections.push(
                    <GroupedPlanningSection
                      key={key}
                      messages={group.messages}
                      isLatest={groupIndex === messageGroups.length - 1}
                    />
                  )
                } else if (group.type === 'execution-group') {
                  groupedSections.push(
                    <GroupedExecutionSection
                      key={key}
                      messages={group.messages}
                      isLatest={groupIndex === messageGroups.length - 1}
                    />
                  )
                }
              } else {
                // Only break parent wrapper for actual user/assistant messages (not between cycles)
                const message = group.messages[0]
                if (message && message.role !== 'thinking' && (message.role === 'user' || message.role === 'assistant' || message.role === 'error')) {
                  // Before adding user/assistant message, wrap any collected grouped sections
                  if (groupedSections.length > 0) {
                    elements.push(
                      <ParentCollapsibleWrapper key={`parent-${elements.length}`}>
                        {groupedSections.splice(0)}
                      </ParentCollapsibleWrapper>
                    )
                  }
                  
                  const isNewMessage = newMessageIdsRef.current.has(message.msgId)
                  
                  elements.push(
                    <div
                      key={message.msgId}
                      className={isNewMessage ? 'animate-fade-in' : ''}
                      style={{ animationDelay: isNewMessage ? '0.1s' : undefined }}
                    >
                      <MessageItem 
                        message={message} 
                        shouldIndent={false}
                        showLocalIndentLine={false}
                      />
                    </div>
                  )
                }
              }
            }
            
            // Add any remaining grouped sections at the end (all remaining cycles)
            if (groupedSections.length > 0) {
              elements.push(
                <ParentCollapsibleWrapper key={`parent-${elements.length}`}>
                  {groupedSections}
                </ParentCollapsibleWrapper>
              )
            }
            
            return elements
          })()}
          
          {/* Narration blocks rendering (only for actual narration messages) */}
          {narrationBlocks.map((block, index) => {
            if (block.type === 'collapsed-thoughts') {
              return (
                <div key={`narration-collapsed-${index}`}>
                  <CollapsibleThoughts messages={block.messages} />
                </div>
              )
            } else if (block.type === 'narration-group') {
              return (
                <div key={`narration-group-${index}`} className="relative">
                  <div className="absolute left-[16px] top-0 bottom-0 w-px bg-gradient-to-b from-brand/40 via-brand/30 to-brand/20" />
                  {block.messages.map((message: Message, msgIndex: number) => {
                    const isCurrentlyExecuting = message.msgId === currentlyExecutingNarration
                    const isNewMessage = newMessageIdsRef.current.has(message.msgId)
                    
                    return (
                      <div
                        key={message.msgId}
                        className={cn("relative pl-8", isNewMessage ? 'animate-fade-in' : '')}
                        style={{ animationDelay: isNewMessage ? `${msgIndex * 0.1}s` : undefined }}
                      >
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
            }
            return null
          })}
          
          {/* Smart skeleton logic - full initially, then section-wise */}
          {isProcessing && (() => {
            const hasThinking = messageGroups.some(g => g.type === 'thinking-group')
            const hasPlanning = messageGroups.some(g => g.type === 'planning-group')
            const hasExecution = messageGroups.some(g => g.type === 'execution-group')
            
            // If no sections exist yet, show full skeleton
            if (!hasThinking && !hasPlanning && !hasExecution) {
              return <AgentActivitySkeleton />
            }
            
            // Otherwise show skeleton for next expected section
            if (!hasThinking) {
              return <ThinkingSkeleton />
            } else if (!hasPlanning) {
              return <PlanningSkeleton />
            } else if (!hasExecution) {
              return <ExecutionSkeleton />
            }
            
            // If all sections exist, show execution skeleton (for ongoing execution)
            return <ExecutionSkeleton />
          })()}
        </div>
      </div>
      
    </div>
  )
}

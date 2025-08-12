import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { MessageItem } from './MessageItem'
import { Button } from '@/sidepanel/components/ui/button'
import { useAutoScroll } from '../hooks/useAutoScroll'
import { useAnalytics } from '../hooks/useAnalytics'
import type { Message } from '../stores/chatStore'
import { AnimatedPawPrints } from './ui/Icons'

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
const DISPLAY_COUNT = 5 // Show 5 examples at a time

/**
 * MessageList component
 * Displays a list of chat messages with auto-scroll and empty state
 */
export function MessageList({ messages, onScrollStateChange, scrollToBottom: externalScrollToBottom, containerRef: externalContainerRef }: MessageListProps) {
  const { containerRef: internalContainerRef, isUserScrolling, scrollToBottom } = useAutoScroll<HTMLDivElement>([messages], externalContainerRef)
  const { trackFeature } = useAnalytics()
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [currentExamples, setCurrentExamples] = useState<string[]>([])
  const [shuffledPool, setShuffledPool] = useState<string[]>([])
  const [isAnimating, setIsAnimating] = useState(false)
  
  // Track previously seen message IDs to determine which are new
  const previousMessageIdsRef = useRef<Set<string>>(new Set())
  const newMessageIdsRef = useRef<Set<string>>(new Set())

  // Use external container ref if provided, otherwise use internal one
  const containerRef = externalContainerRef || internalContainerRef

  // Track new messages for animation
  useEffect(() => {
    const currentMessageIds = new Set(messages.map(msg => msg.id))
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

  // Memoize filtered and processed messages to avoid recalculation on every render
  const processedMessages = useMemo(() => {
    const todoTableMessages = messages.filter(msg => msg.content.includes('| # | Status | Task |'))
    const todoTableIds = new Set(todoTableMessages.map(msg => msg.id))

    const findPrevIndex = (pred: (m: Message) => boolean, start: number): number => {
      for (let i = start; i >= 0; i--) if (pred(messages[i])) return i
      return -1
    }

    // Create a map of message positions for efficient lookup
    const messagePositions = new Map<string, {
      isTodoTable: boolean
      todoIndex: number
      isFirst: boolean
      isLast: boolean
      hasPreviousTodo: boolean
      hasNextTodo: boolean
      isBetweenTodos: boolean
      shouldIndent: boolean
    }>()

    messages.forEach((message, index) => {
      const isTodoTable = todoTableIds.has(message.id)
      const todoIndex = isTodoTable ? todoTableMessages.findIndex(msg => msg.id === message.id) : -1
      const isExecuting = message.metadata?.isExecuting === true

      const prevTodoIndex = findPrevIndex(m => todoTableIds.has(m.id), index - 1)
      const nextTodoIndex = (() => {
        for (let i = index + 1; i < messages.length; i++) if (todoTableIds.has(messages[i].id)) return i
        return -1
      })()
      const prevUserIndex = findPrevIndex(m => m.role === 'user', index - 1)

      let shouldIndent = false
      if (!isTodoTable && !isExecuting && message.role !== 'user') {
        const content = message.content
        const isTaskSummary = content.includes('## Task Summary:') || content.includes('## Task Summary')
        const isTaskFailed = content.includes('## Task Failed')
        const isTaskCompleted = content.includes('## Task Completed') || content.includes('Task Complete') || content.includes('Task Completed') || content.includes('Task completed successfully') || content.includes('Task completed.')
        const isTopLevelHeading = content.trim().startsWith('## ') || content.includes('\n## ')
        const isTaskAnalysisOrPlanning = content.includes('Analyzing task complexity') || content.includes('Creating a step-by-step plan') || content.includes('Analyzing task') || content.includes('Creating plan')

        if (!isTaskSummary && !isTaskFailed && !isTaskCompleted && !isTaskAnalysisOrPlanning && !isTopLevelHeading) {
          // Indent only if there is a Task Manager after the last user message
          shouldIndent = prevTodoIndex !== -1 && prevTodoIndex > prevUserIndex
        }
      }

      messagePositions.set(message.id, {
        isTodoTable,
        todoIndex,
        isFirst: isTodoTable && todoIndex === 0,
        isLast: isTodoTable && todoIndex === todoTableMessages.length - 1,
        hasPreviousTodo: prevTodoIndex !== -1,
        hasNextTodo: nextTodoIndex !== -1,
        isBetweenTodos: prevTodoIndex !== -1 && nextTodoIndex !== -1,
        shouldIndent
      })
    })

    return messages
      .filter(message => {
        if (message.metadata?.toolName === 'todo_manager') {
          return message.content.includes('| # | Status | Task |')
        }
        return true
      })
      .map((message, index) => {
        const position = messagePositions.get(message.id)!
        if (position.isTodoTable && !position.isFirst && !position.isLast) return null
        const isNewMessage = newMessageIdsRef.current.has(message.id)
        const animationDelay = isNewMessage ? index * 0.1 : 0
        return { message, position: position!, animationDelay, isNewMessage }
      })
      .filter(Boolean) as Array<{ message: Message, position: NonNullable<ReturnType<typeof messagePositions.get>>, animationDelay: number, isNewMessage: boolean }>
  }, [messages])

  // Initialize shuffled pool and current examples
  useEffect(() => {
    const shuffled = [...ALL_EXAMPLES].sort(() => 0.5 - Math.random())
    setShuffledPool(shuffled)
    
    // Get initial 5 examples
    const initialExamples: string[] = []
    for (let i = 0; i < DISPLAY_COUNT; i++) {
      if (shuffled.length > 0) {
        initialExamples.push(shuffled.pop()!)
      }
    }
    setCurrentExamples(initialExamples)
  }, [])

  // Function to get random examples from pool
  const getRandomExample = useCallback((count: number = 1): string[] => {
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
      for (let i = 0; i < DISPLAY_COUNT; i++) {
        if (shuffled.length > 0) initialExamples.push(shuffled.pop()!)
      }
      setCurrentExamples(initialExamples)
    }
    wasEmptyRef.current = isEmpty
  }, [messages.length])

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
  const handleScrollToBottom = () => {
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
        className="flex-1 flex flex-col items-center justify-center p-8 text-center relative overflow-hidden mt-20"
        style={{ paddingBottom: '120px' }}
        role="region"
        aria-label="Welcome screen with example prompts"
      >
              {/* Animated paw prints running across the screen */}
      {/*<AnimatedPawPrints />*/}

      {/* Orange glow spotlights removed */}

        {/* Main content */}
        <div className="relative z-10">
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
        className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-brand/30 scrollbar-track-transparent bg-[hsl(var(--background))]"
        ref={containerRef}
        role="log"
        aria-label="Chat messages"
        aria-live="polite"
        tabIndex={0}
      >
        {/* Messages List */}
        <div className="p-6 space-y-3 pb-4">
          {(() => {
            const blocks: React.ReactNode[] = []
            let inGroup = false
            let groupChildren: React.ReactNode[] = []

            const pushGroup = () => {
              if (groupChildren.length > 0) {
                blocks.push(
                  <div key={`group-${blocks.length}`} className="relative before:content-[''] before:absolute before:left-[8px] before:top-0 before:bottom-0 before:w-px before:bg-gradient-to-b before:from-brand/40 before:via-brand/30 before:to-brand/20">
                    {groupChildren}
                  </div>
                )
                groupChildren = []
              }
            }

            processedMessages.forEach(({ message, position, animationDelay, isNewMessage }) => {
              const commonAttrs = {
                key: message.id,
                className: isNewMessage ? 'animate-fade-in' : '',
                style: { animationDelay: isNewMessage ? `${animationDelay}s` : undefined },
                'data-todo-position': position.isFirst ? 'first' : position.isLast ? 'last' : null,
                'data-todo-index': position.todoIndex,
                'data-between-todos': position.isBetweenTodos ? 'true' : 'false',
                'data-has-previous-todo': position.hasPreviousTodo ? 'true' : 'false',
                'data-has-next-todo': position.hasNextTodo ? 'true' : 'false',
                'data-should-indent': position.shouldIndent ? 'true' : 'false'
              } as any

              if (position.shouldIndent) {
                if (!inGroup) inGroup = true
                groupChildren.push(
                  <div {...commonAttrs}>
                    <MessageItem message={message} shouldIndent={true} showLocalIndentLine={false} applyIndentMargin={false} />
                  </div>
                )
              } else {
                if (inGroup) { pushGroup(); inGroup = false }
                blocks.push(
                  <div {...commonAttrs}>
                    <MessageItem message={message} shouldIndent={false} showLocalIndentLine={false} />
                  </div>
                )
              }
            })

            if (inGroup) pushGroup()

            return <>{blocks}</>
          })()}
        </div>
      </div>
      
    </div>
  )
}

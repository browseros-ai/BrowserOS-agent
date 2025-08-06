import React, { memo, useEffect, useState, useMemo, useCallback } from 'react'
import { MarkdownContent } from './shared/Markdown'
import { cn } from '@/sidepanel/lib/utils'
import type { Message } from '../stores/chatStore'
import { useChatStore } from '../stores/chatStore'
//import { UserIcon } from './ui/Icons'
import { DogHeadSpinner } from './ui/DogHeadSpinner'
import { TaskManagerDropdown } from './TaskManagerDropdown'

interface MessageItemProps {
  message: Message
  shouldIndent?: boolean
}

/**
 * MessageItem component
 * Renders individual messages with role-based styling
 * Memoized to prevent re-renders when message hasn't changed
 */
export const MessageItem = memo(function MessageItem({ message, shouldIndent = false }: MessageItemProps) {
  const isUser = message.role === 'user'
  const isError = message.metadata?.error || message.content.includes('## Task Failed')
  const isSystem = message.role === 'system'
  const isExecuting = message.metadata?.isExecuting || message.content.includes('executing') || message.content.includes('Executing')
  const isCompleting = message.metadata?.isCompleting
  const [isAnimating, setIsAnimating] = useState(false)
  const [slideUpAmount, setSlideUpAmount] = useState(0)
  
  const { markMessageAsCompleting, removeExecutingMessage, messages, executingMessageRemoving } = useChatStore()

  // Memoize expensive content checks to avoid recalculation on every render
  const contentChecks = useMemo(() => {
    const content = message.content
    return {
      isTodoTable: content.includes('| # | Status | Task |'),
      isTaskSummary: content.includes('## Task Summary:') || content.includes('## Task Summary'),
      isTaskFailed: content.includes('## Task Failed'),
      isTaskAnalysisOrPlanning: content.includes('Analyzing task complexity') || 
                                content.includes('Creating a step-by-step plan') ||
                                content.includes('Analyzing task') ||
                                content.includes('Creating plan'),
      isTaskComplete: content.includes('🎉 Task Complete')
    }
  }, [message.content])

  // Memoize message styling to avoid recalculation
  const messageStyling = useMemo(() => {
    // User message styling
    if (isUser) {
      return {
        bubble: 'ml-4 bg-gradient-to-br from-brand/90 to-brand/80 text-white rounded-br-md backdrop-blur-sm border border-transparent',
        glow: 'bg-gradient-to-bl from-brand/20 to-transparent',
        shadow: 'shadow-lg hover:shadow-xl'  // User messages get hover shadow
      }
    }

    // Special styling for TODO lists (task manager)
    if (contentChecks.isTodoTable) {
      return {
        bubble: 'mr-4 bg-gradient-to-br from-card/80 to-card/60 text-foreground rounded-bl-md border-border/50',
        glow: '',  // Remove hover gradient for task manager
        shadow: 'shadow-lg'  // Task manager gets static shadow, no hover effect
      }
    }

    // Default styling (should not be used since only user and TODO messages get bubbles)
    return {
      bubble: 'mr-4 bg-gradient-to-br from-card/80 to-card/60 text-foreground rounded-bl-md border-border/50',
      glow: 'bg-gradient-to-bl from-primary/10 to-transparent',
      shadow: 'shadow-lg hover:shadow-xl'
    }
  }, [isUser, contentChecks.isTodoTable])

  // Determine content renderer based on tool name
  const getToolContentRenderer = useCallback((toolName: string) => {
    switch (toolName) {
      case 'classification_tool':
      case 'planner_tool':
      case 'navigation_tool':
      case 'tab_operations_tool':
      case 'refresh_state_tool':
      case 'find_element_tool':
      case 'interaction_tool':
      case 'scroll_tool':
      case 'search_tool':
      case 'extract_tool':
      case 'screenshot_tool':
      case 'done_tool':
      case 'result_tool':
      case 'todo_manager':
      case 'validator_tool':
        return 'tool-result'
      default:
        return 'markdown'
    }
  }, [])

  // Memoize content renderer to avoid recalculation
  const contentRenderer = useMemo(() => {
    // User messages - plain text
    if (isUser) {
      return 'plain-text'
    }

    // TODO lists - custom table rendering
    if (contentChecks.isTodoTable) {
      return 'todo-table'
    }

    // Task summaries - markdown with special styling
    if (contentChecks.isTaskSummary) {
      return 'task-summary'
    }

    // Task failed - markdown with error styling
    if (contentChecks.isTaskFailed) {
      return 'task-failed'
    }

    // Task completion - special single line display
    if (contentChecks.isTaskComplete) {
      return 'task-complete'
    }

    // Tool-specific messages - check metadata
    if (message.metadata?.toolName) {
      return getToolContentRenderer(message.metadata.toolName)
    }

    // Default to markdown for assistant messages
    if (message.role === 'assistant') {
      return 'markdown'
    }

    // Plain text for system messages
    return 'plain-text'
  }, [isUser, contentChecks, message.metadata?.toolName, message.role, getToolContentRenderer])

  // Memoize whether to show bubble and timestamp
  const displayOptions = useMemo(() => {
    const shouldShowBubble = isUser || contentChecks.isTodoTable
    const shouldShowTimestamp = isUser || contentChecks.isTodoTable
    const shouldShowToolName = false // Tool names are not shown since only user and TODO messages get bubbles
    
    return {
      shouldShowBubble,
      shouldShowTimestamp,
      shouldShowToolName
    }
  }, [isUser, contentChecks.isTodoTable])

  // Calculate slide-up amount when executing message is being removed
  useEffect(() => {
    if (executingMessageRemoving && !isExecuting) {
      // Find the executing message that's being removed
      const executingMessage = messages.find(msg => msg.metadata?.isCompleting)
      if (executingMessage) {
        // Find the executing message element and get its height
        const executingElement = document.querySelector(`[data-message-id="${executingMessage.id}"]`)
        if (executingElement) {
          const height = executingElement.getBoundingClientRect().height
          setSlideUpAmount(height)
        }
      }
    } else {
      setSlideUpAmount(0)
    }
  }, [executingMessageRemoving, isExecuting, messages])
  
  // Handle executing message completion
  useEffect(() => {
    if (isExecuting && !isCompleting && !isAnimating) {
      // Check if there's a newer message after this executing message
      const currentIndex = messages.findIndex(msg => msg.id === message.id)
      const hasNewerMessages = currentIndex !== -1 && currentIndex < messages.length - 1
      
      if (hasNewerMessages) {
        // There's a newer message, so this executing message should complete
        markMessageAsCompleting(message.id)
        setIsAnimating(true)
        
        // Remove the message after animation completes
        setTimeout(() => {
          removeExecutingMessage(message.id)
        }, 400) // Match the CSS animation duration
      }
    }
  }, [isExecuting, isCompleting, isAnimating, message.id, messages, markMessageAsCompleting, removeExecutingMessage])
  
  // Extract the executing text (remove "executing - " prefix)
  const executingText = isExecuting ? message.content.replace(/^executing\s*-\s*/i, '') : ''
  
  // Render content based on the determined renderer
  const renderContent = useCallback(() => {
    switch (contentRenderer) {
      case 'plain-text':
        return (
          <div className="whitespace-pre-wrap break-words font-medium">
            {message.content}
          </div>
        )

      case 'todo-table':
        return <TaskManagerDropdown 
          key={`task-manager-${message.id}`} 
          content={message.content} 
        />

      case 'task-complete':
        return (
          <div className="flex items-center gap-3 py-2 px-3 bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30">
              <span className="text-lg">🎉</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-green-800 dark:text-green-200">Task Complete</span>
              <span className="text-sm text-green-600 dark:text-green-400">The task has been completed successfully.</span>
            </div>
          </div>
        )

      case 'task-summary':
      case 'task-failed':
      case 'tool-result':
      case 'markdown':
        return (
          <MarkdownContent
            content={message.content}
            className="break-words"
            compact={false}
          />
        )

      default:
        return (
          <MarkdownContent
            content={message.content}
            className="break-words"
            compact={false}
          />
        )
    }
  }, [contentRenderer, message.content, message.id])
  
  return (
    <div 
      data-message-id={message.id}
      className={cn(
        'flex w-full group message-container',
        isUser ? 'justify-end' : 'justify-start',
        isCompleting && 'animate-dash-off-left',
        // Add indentation for messages that should be indented
        shouldIndent && 'ml-8 relative',
        // Add special styling for TODO table messages
        contentChecks.isTodoTable && 'relative'
      )}
      style={!isExecuting && executingMessageRemoving && slideUpAmount > 0 ? {
        transform: `translateY(-${slideUpAmount}px)`,
        transition: 'transform 0.4s ease-out'
      } : undefined}
    >
      
      {/* Vertical connecting line for indented messages */}
      {shouldIndent && (
        <div className="absolute left-[-16px] top-0 bottom-0 w-px bg-gradient-to-b from-brand/30 via-brand/20 to-brand/10" />
      )}

      {/* Task manager indicators - these will be handled by parent component data attributes */}
      {/* Removed DOM queries for these - they're now handled by parent component */}

      {/* User avatar - disabled
      {isUser && (
        <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ml-1 mt-1 bg-gradient-to-br from-brand to-brand/80 text-white shadow-lg">
          <UserIcon />
        </div>
      )} */}

      {/* Message content - with or without bubble */}
      {displayOptions.shouldShowBubble ? (
        // Message bubble layout
        <div className={cn(
          'relative max-w-[85%] rounded-2xl px-3 py-1 transition-all duration-300',
          messageStyling.shadow,
          isUser ? 'group-hover:scale-[1.02]' : '',
          messageStyling.bubble,
          // Add subtle styling for indented messages
          shouldIndent && 'opacity-90'
        )}>
          {/* Glow effect */}
          <div className={cn(
            'absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300',
            messageStyling.glow
          )} />

          {/* Tool name */}
          {displayOptions.shouldShowToolName && message.metadata?.toolName && (
            <div className="text-xs opacity-80 mb-2 font-medium flex items-center gap-1">
              {message.metadata.toolName}
            </div>
          )}

          {/* Markdown content */}
          <div className="relative z-10">
            {renderContent()}
          </div>

          {/* Timestamp - only show for specific message types */}
          {displayOptions.shouldShowTimestamp && (
            <div className={cn('text-xs opacity-50', isUser ? 'text-right' : 'text-left')}>
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      ) : (
        // Non-bubble messages (system messages, tool results, task summaries, etc.)
        <div className={cn(
          'mr-4 mt-1 max-w-[85%]',
          isCompleting && 'animate-dash-off-left',
          // Add subtle styling for indented messages
          shouldIndent && 'opacity-90'
        )}>
          {isExecuting ? (
            <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
              <DogHeadSpinner size={24} className="text-brand" />
              <span>{executingText}</span>
            </div>
          ) : (
            <div className="text-sm text-foreground">
              {renderContent()}
            </div>
          )}
        </div>
      )}
    </div>
  )
})
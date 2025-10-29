import React, { useState, useEffect } from 'react'
import { cn } from '@/sidepanel/lib/utils'
import { ChevronDown, ChevronRight, Brain } from 'lucide-react'
import { MarkdownContent } from './shared/Markdown'
import type { Message } from '../stores/chatStore'

interface GroupedThinkingSectionProps {
  messages: Message[]
  isLatest?: boolean  // For shimmer effect on last message
  isTaskCompleted?: boolean  // Auto-collapse when task is completed
  className?: string
}

/**
 * GroupedThinkingSection - groups consecutive thinking messages under single collapsible block
 * Like Windsurf/Cursor behavior where all thinking is consolidated
 */
export function GroupedThinkingSection({ messages, isLatest = false, isTaskCompleted = false, className }: GroupedThinkingSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true)  // Default expanded
  
  // Auto-collapse immediately when task is completed
  useEffect(() => {
    if (isTaskCompleted && !isLatest) {
      // Immediate smooth collapse when result appears
      setIsExpanded(false)
    }
  }, [isTaskCompleted, isLatest])
  
  if (messages.length === 0) return null

  return (
    <div className={cn('w-full', className)}>
      {/* Minimal Thinking Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'flex items-center gap-2 w-full py-1 px-2 rounded transition-colors duration-200',
          'hover:bg-muted/20 text-left group'
        )}
      >
        <div className="flex items-center gap-2 flex-1">
          {/* Brain icon */}
          <Brain className="w-5 h-5 text-muted-foreground" />
          
          {/* Enhanced title with gradient */}
          <span className="text-sm font-medium text-muted-foreground">
            Thinking
          </span>
        </div>

        {/* Minimal expand/collapse icon */}
        <div className="text-muted-foreground/50 transition-transform duration-200">
          {isExpanded ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
        </div>
      </button>

      {/* Grouped Thinking Content with smooth collapse animation */}
      <div className={cn(
        "transition-all duration-500 ease-out overflow-hidden",
        isExpanded ? "max-h-none opacity-100 mt-1" : "max-h-0 opacity-0 mt-0"
      )}>
        <div className="ml-4 pl-2 border-l-2 border-muted-foreground/20 space-y-2">
          {messages.map((message, index) => {
            const isLastMessage = index === messages.length - 1
            const showShimmer = isLatest && isLastMessage
            
            return (
              <div key={message.msgId} className="relative">
                {showShimmer ? (
                  // Latest thinking with subtle shimmer
                  <div className="relative">
                    <MarkdownContent
                      content={message.content}
                      className="break-words text-xs text-muted-foreground/80"
                      compact={true}
                    />
                    {/* Minimal shimmer effect */}
                    <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-transparent via-background/10 to-transparent animate-shimmer bg-[length:200%_100%]" />
                  </div>
                ) : (
                  // Regular thinking content
                  <MarkdownContent
                    content={message.content}
                    className="break-words text-xs text-muted-foreground/80"
                    compact={true}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

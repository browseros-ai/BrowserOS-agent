import React, { useState } from 'react'
import { cn } from '@/sidepanel/lib/utils'
import { ChevronDown, ChevronRight, ClipboardList } from 'lucide-react'
import { MarkdownContent } from './shared/Markdown'
import type { Message } from '../stores/chatStore'

interface GroupedPlanningSectionProps {
  messages: Message[]
  isLatest?: boolean  // For shimmer effect on last message
  className?: string
}

/**
 * GroupedPlanningSection - groups consecutive planning messages under single collapsible block
 * Similar styling to ThinkingSection but specifically for planning content
 */
export function GroupedPlanningSection({ messages, isLatest = false, className }: GroupedPlanningSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true)  // Default expanded for planning visibility
  
  if (messages.length === 0) return null

  return (
    <div className={cn('w-full', className)}>
      {/* Minimal Planning Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'flex items-center gap-2 w-full py-1 px-2 rounded transition-colors duration-200',
          'hover:bg-muted/20 text-left group'
        )}
      >
        <div className="flex items-center gap-2 flex-1">
          {/* Clipboard list icon */}
          <ClipboardList className="w-5 h-5 text-muted-foreground" />
          
          {/* Enhanced title with gradient */}
          <span className="text-xs font-extrabold text-muted-foreground">
            Planning
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

      {/* Grouped Planning Content */}
      {isExpanded && (
        <div className="mt-1 ml-4 pl-2 border-l-2 border-muted-foreground/20 space-y-2">
          {messages.map((message, index) => {
            const isLastMessage = index === messages.length - 1
            const showShimmer = isLatest && isLastMessage
            
            return (
              <div key={message.msgId} className="relative">
                {showShimmer ? (
                  // Latest planning with subtle shimmer
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
                  // Regular planning content
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
      )}
    </div>
  )
}

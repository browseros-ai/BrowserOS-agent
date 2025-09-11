import React, { useState } from 'react'
import { cn } from '@/sidepanel/lib/utils'
import { ChevronDown, ChevronRight, Zap } from 'lucide-react'
import { MarkdownContent } from './shared/Markdown'
import type { Message } from '../stores/chatStore'

interface GroupedExecutionSectionProps {
  messages: Message[]
  isLatest?: boolean  // For shimmer effect on last message
  className?: string
}

/**
 * GroupedExecutionSection - groups consecutive execution messages under single collapsible block
 * Similar styling to ThinkingSection but specifically for execution steps
 */
export function GroupedExecutionSection({ messages, isLatest = false, className }: GroupedExecutionSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true)  // Default expanded for execution visibility
  
  if (messages.length === 0) return null

  // Extract current step from latest message if currently executing
  const getCurrentStep = () => {
    if (!isLatest || messages.length === 0) return null
    
    const latestMessage = messages[messages.length - 1]
    const content = latestMessage.content
    
    // Extract step patterns
    if (content.includes('Navigating to:')) return 'Navigating'
    if (content.includes('Finding element')) return 'Finding element'
    if (content.includes('Typed') && content.includes('into')) return 'Typing'
    if (content.includes('Clicked element')) return 'Clicking'
    if (content.includes('Pressing key')) return 'Pressing key'
    if (content.includes('Scrolling')) return 'Scrolling'
    if (content.includes('Taking screenshot')) return 'Taking screenshot'
    
    return 'Executing'
  }
  
  const currentStep = getCurrentStep()

  return (
    <div className={cn('w-full', className)}>
      {/* Minimal Execution Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'flex items-center gap-2 w-full py-1 px-2 rounded transition-colors duration-200',
          'hover:bg-muted/20 text-left group'
        )}
      >
        <div className="flex items-center gap-2 flex-1">
          {/* Zap icon */}
          <Zap className="w-5 h-5 text-muted-foreground" />
          
          {/* Enhanced title with current step */}
          <div className="flex flex-col">
            <span className="text-xs font-extrabold text-muted-foreground">
              Execution
            </span>
            {currentStep && isLatest && (
              <span className="text-xs text-muted-foreground font-medium">
                {currentStep}
              </span>
            )}
          </div>
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

      {/* Grouped Execution Content */}
      {isExpanded && (
        <div className="mt-1 ml-4 pl-2 border-l-2 border-muted-foreground/20 space-y-2">
          {messages.map((message, index) => {
            const isLastMessage = index === messages.length - 1
            const showShimmer = isLatest && isLastMessage
            
            return (
              <div key={message.msgId} className="relative">
                {showShimmer ? (
                  // Latest execution with subtle shimmer
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
                  // Regular execution content
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

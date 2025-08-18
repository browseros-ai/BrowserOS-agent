import React, { useState } from 'react'
import { MessageItem } from './MessageItem'
import { ChevronRight, ChevronDown } from 'lucide-react'
import type { Message } from '../stores/chatStore'
import { cn } from '@/sidepanel/lib/utils'

interface CollapsibleThoughtsProps {
  messages: Message[]  // Older narration messages to collapse
  isExpanded?: boolean  // External control for expansion state
  onToggle?: (expanded: boolean) => void
}

export function CollapsibleThoughts({ messages, isExpanded: controlledExpanded, onToggle }: CollapsibleThoughtsProps) {
  // Start expanded by default (will show as expanded even when empty for clean UI)
  const [localExpanded, setLocalExpanded] = useState(true)
  
  // Use controlled state if provided, otherwise use local state
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : localExpanded
  
  const handleToggle = () => {
    const newState = !isExpanded
    if (controlledExpanded === undefined) {
      setLocalExpanded(newState)
    }
    onToggle?.(newState)
  }
  
  return (
    <div className="relative">
      {/* Collapse/Expand button - always show with chevron */}
      <button
        onClick={handleToggle}
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 text-xs font-medium",
          "text-muted-foreground hover:text-foreground",
          "transition-all duration-200 rounded-md",
          messages.length > 0 ? "hover:bg-muted/50 cursor-pointer" : "cursor-default opacity-70"
        )}
        aria-expanded={isExpanded}
        aria-label={isExpanded ? "Collapse thoughts" : "Expand thoughts"}
        disabled={messages.length === 0}
      >
        <span className="transition-transform duration-200">
          {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </span>
        <span>Thoughts{messages.length > 0 && ` (${messages.length})`}</span>
      </button>
      
      {/* Collapsed indicator line */}
      {!isExpanded && (
        <div className="ml-4 mt-1 h-px bg-gradient-to-r from-brand/20 via-brand/10 to-transparent" />
      )}
      
      {/* Expanded messages - only show if expanded AND has messages */}
      {isExpanded && messages.length > 0 && (
        <div className="relative">
          {messages.map((message) => (
            <div key={message.msgId} className="relative">
              <MessageItem 
                message={message} 
                shouldIndent={true}
                showLocalIndentLine={false}
                applyIndentMargin={false}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
import React, { useState } from 'react'
import { cn } from '@/sidepanel/lib/utils'
import { ChevronDown, ChevronRight, Activity } from 'lucide-react'

interface ParentCollapsibleWrapperProps {
  children: React.ReactNode
  className?: string
}

/**
 * ParentCollapsibleWrapper - wraps all grouped sections (thinking, planning, execution) 
 * under a single collapsible parent section
 */
export function ParentCollapsibleWrapper({ children, className }: ParentCollapsibleWrapperProps) {
  const [isExpanded, setIsExpanded] = useState(true)  // Default expanded

  return (
    <div className={cn('w-full', className)}>
      {/* Parent Collapse Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'flex items-center gap-2 w-full py-1 px-2 rounded transition-colors duration-200',
          'hover:bg-muted/20 text-left group mb-2'
        )}
      >
        <div className="flex items-center gap-2 flex-1">
          {/* Activity icon */}
          <Activity className="w-4 h-4 text-muted-foreground" />
          
          {/* Parent title */}
          <span className="text-xs font-bold text-muted-foreground">
            Agent Activity
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

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="ml-2 pl-2 border-l-2 border-muted-foreground/20 space-y-2">
          {children}
        </div>
      )}
    </div>
  )
}

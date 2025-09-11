import React from 'react'
import { cn } from '@/sidepanel/lib/utils'

interface ExecutionSkeletonProps {
  className?: string
}

/**
 * ExecutionSkeleton - Individual skeleton for execution section only
 */
export function ExecutionSkeleton({ className }: ExecutionSkeletonProps) {
  return (
    <div className={cn('w-full animate-pulse space-y-3', className)}>
      {/* Execution Section Skeleton */}
      <div className="space-y-3">
        {/* Section Header */}
        <div className="flex items-center gap-2">
          <div className="h-4 bg-muted-foreground/20 rounded w-5"></div>  {/* Icon */}
          <div className="space-y-1">
            <div className="h-3 bg-muted-foreground/20 rounded w-20"></div>  {/* Title */}
            <div className="h-2 bg-muted-foreground/20 rounded w-16"></div>  {/* Subtitle */}
          </div>
          <div className="ml-auto h-3 w-3 bg-muted-foreground/20 rounded"></div>  {/* Chevron */}
        </div>
        {/* Section Content */}
        <div className="space-y-2 pl-6">
          <div className="h-2 bg-muted-foreground/20 rounded w-full"></div>
          <div className="h-2 bg-muted-foreground/20 rounded w-2/3"></div>
          <div className="h-2 bg-muted-foreground/20 rounded w-3/5"></div>
        </div>
      </div>
    </div>
  )
}

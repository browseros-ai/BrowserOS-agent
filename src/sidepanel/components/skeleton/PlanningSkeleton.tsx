import React from 'react'
import { cn } from '@/sidepanel/lib/utils'

interface PlanningSkeletonProps {
  className?: string
}

/**
 * PlanningSkeleton - Individual skeleton for planning section only
 */
export function PlanningSkeleton({ className }: PlanningSkeletonProps) {
  return (
    <div className={cn('w-full animate-pulse space-y-3', className)}>
      {/* Planning Section Skeleton */}
      <div className="space-y-3">
        {/* Section Header */}
        <div className="flex items-center gap-2">
          <div className="h-4 bg-muted-foreground/20 rounded w-5"></div>  {/* Icon */}
          <div className="h-3 bg-muted-foreground/20 rounded w-18"></div>  {/* Title */}
          <div className="ml-auto h-3 w-3 bg-muted-foreground/20 rounded"></div>  {/* Chevron */}
        </div>
        {/* Section Content */}
        <div className="space-y-2 pl-6">
          <div className="h-2 bg-muted-foreground/20 rounded w-full"></div>
          <div className="h-2 bg-muted-foreground/20 rounded w-5/6"></div>
        </div>
      </div>
    </div>
  )
}

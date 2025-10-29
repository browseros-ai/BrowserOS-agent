import React from 'react'
import { cn } from '@/sidepanel/lib/utils'

interface AgentActivitySkeletonProps {
  className?: string
}

/**
 * AgentActivitySkeleton - Pure loading skeleton with animated placeholders
 * No icons or lines, just clean skeleton animation
 */
export function AgentActivitySkeleton({ className }: AgentActivitySkeletonProps) {
  return (
    <div className={cn('w-full animate-pulse space-y-4', className)}>
      {/* Parent Header Skeleton */}
      <div className="flex items-center gap-2 w-full py-2">
        <div className="h-4 bg-muted-foreground/20 rounded w-6"></div>  {/* Icon placeholder */}
        <div className="h-3 bg-muted-foreground/20 rounded w-28"></div>  {/* Header text */}
        <div className="ml-auto h-3 w-3 bg-muted-foreground/20 rounded"></div>  {/* Chevron */}
      </div>

      {/* Content Sections */}
      <div className="space-y-6 pl-4">
        
        {/* First Section Skeleton */}
        <div className="space-y-3">
          {/* Section Header */}
          <div className="flex items-center gap-2">
            <div className="h-4 bg-muted-foreground/20 rounded w-5"></div>  {/* Icon */}
            <div className="h-3 bg-muted-foreground/20 rounded w-20"></div>  {/* Title */}
            <div className="ml-auto h-3 w-3 bg-muted-foreground/20 rounded"></div>  {/* Chevron */}
          </div>
          {/* Section Content */}
          <div className="space-y-2 pl-6">
            <div className="h-2 bg-muted-foreground/20 rounded w-full"></div>
            <div className="h-2 bg-muted-foreground/20 rounded w-4/5"></div>
            <div className="h-2 bg-muted-foreground/20 rounded w-3/4"></div>
          </div>
        </div>

        {/* Second Section Skeleton */}
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

        {/* Third Section Skeleton */}
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
    </div>
  )
}

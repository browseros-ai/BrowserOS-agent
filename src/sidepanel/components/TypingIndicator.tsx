import React from 'react'
import { cn } from '@/sidepanel/lib/utils'
import { ANIMATION_DURATIONS } from '@/sidepanel/lib/animations'

interface TypingIndicatorProps {
  className?: string
  variant?: 'dots' | 'pulse' | 'wave'
  size?: 'sm' | 'md' | 'lg'
}

/**
 * Simple gray pulsing dots animation
 * Clean loading indicator with gray dots
 */
export function TypingIndicator({ 
  className, 
  variant = 'dots', 
  size = 'md' 
}: TypingIndicatorProps) {
  // Simple gray pulsing dots
  return (
    <div className={cn(
      'flex items-center gap-1 px-3 py-2',
      className
    )}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"
          style={{
            animationDelay: `${i * 200}ms`,
            animationDuration: '1.5s'
          }}
        />
      ))}
    </div>
  )
}

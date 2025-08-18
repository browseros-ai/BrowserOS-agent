import React, { useState } from 'react'
import { cn } from '@/sidepanel/lib/utils'
import { z } from 'zod'

// Props schema (children is not represented in Zod)
export const ExpandableSectionPropsSchema = z.object({
  itemCount: z.number().int().nonnegative(),  // Number of items rendered inside
  threshold: z.number().int().positive().optional(),  // When to show the toggle
  collapsedMaxHeight: z.number().int().positive().optional(),  // Max height in px when collapsed
  initiallyExpanded: z.boolean().optional(),  // Initial expanded state
  className: z.string().optional()  // Optional classes
})

type ExpandableSectionProps = z.infer<typeof ExpandableSectionPropsSchema> & {
  children: React.ReactNode
}

/**
 * ExpandableSection
 * Collapsible container that caps height for long lists and shows a toggle.
 */
export function ExpandableSection ({
  children,
  itemCount,
  threshold = 6,
  collapsedMaxHeight = 192,  // ~12rem
  initiallyExpanded = false,
  className
}: ExpandableSectionProps) {
  const [expanded, setExpanded] = useState<boolean>(initiallyExpanded)

  if (itemCount <= threshold) {
    return (
      <div className={className}>
        {children}
      </div>
    )
  }

  return (
    <div className={cn('relative', className)}>
      {/* Content container */}
      <div
        className={cn(
          expanded ? 'max-h-none' : 'overflow-y-auto rounded-md'
        )}
        style={!expanded ? { maxHeight: `${collapsedMaxHeight}px` } : undefined}
      >
        {children}
      </div>

      {/* Fade overlay when collapsed */}
      {!expanded && (
        <div className='pointer-events-none absolute left-0 right-0 bottom-8 h-8 bg-gradient-to-t from-[hsl(var(--background))] to-transparent rounded-b-md' />
      )}

      {/* Toggle */}
      <div className='mt-2 flex justify-center'>
        <button
          type='button'
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
          className='text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded transition-colors'
        >
          {expanded ? 'Show less' : `Show more (${itemCount})`}
        </button>
      </div>
    </div>
  )
}



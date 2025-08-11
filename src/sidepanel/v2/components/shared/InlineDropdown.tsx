import React, { useEffect, useState } from 'react'
import { z } from 'zod'
import { cn } from '@/sidepanel/lib/utils'
import { ChevronDownIcon, ChevronUpIcon } from '../ui/Icons'
import { useSettingsStore } from '@/sidepanel/v2/stores/settingsStore'

// Props schema for InlineDropdown
export const InlineDropdownPropsSchema = z.object({
  title: z.string(),  // Header title text
  defaultExpanded: z.boolean().optional(),  // Whether to start expanded
  countText: z.string().optional(),  // Optional small count text
  className: z.string().optional(),  // Optional container classes
  autoCollapseAfterMs: z.number().int().positive().optional(),  // Optional auto-collapse delay
  collapseKey: z.string().optional()  // Per-dropdown key for selective auto-collapse
})

type InlineDropdownProps = z.infer<typeof InlineDropdownPropsSchema> & {
  children: React.ReactNode
}

// Compact inline dropdown header with chevron and expandable content
export function InlineDropdown ({
  title,
  defaultExpanded = true,
  countText,
  className,
  autoCollapseAfterMs,
  collapseKey,
  children
}: InlineDropdownProps) {
  const [expanded, setExpanded] = useState<boolean>(defaultExpanded)
  const autoCollapseDelayMs = useSettingsStore(s => s.autoCollapseDelayMs)
  const autoCollapseKeys = useSettingsStore(s => s.autoCollapseKeys)

  // Auto-collapse support (honors settingsStore.autoCollapseTools)
  useEffect(() => {
    const delay = typeof autoCollapseAfterMs === 'number' ? autoCollapseAfterMs : autoCollapseDelayMs
    const allowByKey = !collapseKey || autoCollapseKeys.length === 0 || autoCollapseKeys.includes(collapseKey)
    if (!delay || delay <= 0 || !allowByKey) return
    let timer: ReturnType<typeof setTimeout> | null = null
    setExpanded(true)
    timer = setTimeout(() => {
      setExpanded(false)
    }, delay)
    return () => { if (timer) clearTimeout(timer) }
  }, [autoCollapseAfterMs, autoCollapseDelayMs, title, collapseKey, autoCollapseKeys])

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Header toggle */}
      <button
        type='button'
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
        className='text-[10px] uppercase tracking-wide text-muted-foreground/80 leading-tight inline-flex items-center cursor-pointer focus:outline-none'
      >
        <span>{title}</span>
        {countText && (
          <span className='ml-1 opacity-70'>
            {countText}
          </span>
        )}
        <span className='shrink-0 text-muted-foreground/70'>
          {expanded ? <ChevronUpIcon className='w-3 h-3' /> : <ChevronDownIcon className='w-3 h-3' />}
        </span>
      </button>

      {/* Content */}
      {expanded && (
        <div className='mt-0.5'>
          {children}
        </div>
      )}
    </div>
  )
}



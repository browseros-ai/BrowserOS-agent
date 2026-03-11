'use client'

import { BrainIcon, ChevronDownIcon } from 'lucide-react'
import type { HTMLAttributes } from 'react'
import { createContext, memo, useContext, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Shimmer } from './shimmer'

type ReasoningContextValue = {
  isStreaming: boolean
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  duration: number | undefined
}

const ReasoningContext = createContext<ReasoningContextValue | null>(null)

const useReasoning = () => {
  const context = useContext(ReasoningContext)
  if (!context) {
    throw new Error('Reasoning components must be used within Reasoning')
  }
  return context
}

export type ReasoningProps = HTMLAttributes<HTMLDivElement> & {
  isStreaming?: boolean
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  duration?: number
}

const AUTO_CLOSE_DELAY = 1000
const MS_IN_S = 1000

/** @public */
export const Reasoning = memo(
  ({
    className,
    isStreaming = false,
    open,
    defaultOpen = true,
    onOpenChange,
    duration: durationProp,
    children,
    ...props
  }: ReasoningProps) => {
    const [isOpen, setIsOpenState] = useState(open ?? defaultOpen)
    const [duration, setDuration] = useState<number | undefined>(durationProp)
    const [hasAutoClosed, setHasAutoClosed] = useState(false)
    const [startTime, setStartTime] = useState<number | null>(null)

    // Sync controlled open prop
    useEffect(() => {
      if (open !== undefined) setIsOpenState(open)
    }, [open])

    // Sync controlled duration prop
    useEffect(() => {
      if (durationProp !== undefined) setDuration(durationProp)
    }, [durationProp])

    const setIsOpen = (newOpen: boolean) => {
      setIsOpenState(newOpen)
      onOpenChange?.(newOpen)
    }

    // Track duration when streaming starts and ends
    useEffect(() => {
      if (isStreaming) {
        if (startTime === null) {
          setStartTime(Date.now())
        }
      } else if (startTime !== null) {
        setDuration(Math.ceil((Date.now() - startTime) / MS_IN_S))
        setStartTime(null)
      }
    }, [isStreaming, startTime])

    // Auto-close when streaming ends (once only)
    useEffect(() => {
      if (defaultOpen && !isStreaming && isOpen && !hasAutoClosed) {
        const timer = setTimeout(() => {
          setIsOpen(false)
          setHasAutoClosed(true)
        }, AUTO_CLOSE_DELAY)

        return () => clearTimeout(timer)
      }
    }, [isStreaming, isOpen, defaultOpen, hasAutoClosed, setIsOpen])

    return (
      <ReasoningContext.Provider
        value={{ isStreaming, isOpen, setIsOpen, duration }}
      >
        <div className={cn('not-prose mb-4', className)} {...props}>
          {children}
        </div>
      </ReasoningContext.Provider>
    )
  },
)

export type ReasoningTriggerProps = HTMLAttributes<HTMLButtonElement>

const getThinkingMessage = (isStreaming: boolean, duration?: number) => {
  if (isStreaming || duration === 0) {
    return <Shimmer duration={1}>Thinking...</Shimmer>
  }
  if (duration === undefined) {
    return <p>Thought for a few seconds</p>
  }
  return <p>Thought for {duration} seconds</p>
}

/** @public */
export const ReasoningTrigger = memo(
  ({ className, children, ...props }: ReasoningTriggerProps) => {
    const { isStreaming, isOpen, setIsOpen, duration } = useReasoning()

    return (
      <button
        type="button"
        className={cn(
          'flex w-full items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground',
          className,
        )}
        onClick={() => setIsOpen(!isOpen)}
        {...props}
      >
        {children ?? (
          <>
            <BrainIcon className="size-4" />
            {getThinkingMessage(isStreaming, duration)}
            <ChevronDownIcon
              className={cn(
                'size-4 transition-transform',
                isOpen ? 'rotate-180' : 'rotate-0',
              )}
            />
          </>
        )}
      </button>
    )
  },
)

export type ReasoningContentProps = HTMLAttributes<HTMLDivElement> & {
  children: string
}

/** @public */
export const ReasoningContent = memo(
  ({ className, children, ...props }: ReasoningContentProps) => {
    const { isOpen } = useReasoning()

    if (!isOpen) return null

    return (
      <div
        className={cn('mt-4 text-muted-foreground text-sm', className)}
        {...props}
      >
        <div className="whitespace-pre-wrap">{children}</div>
      </div>
    )
  },
)

Reasoning.displayName = 'Reasoning'
ReasoningTrigger.displayName = 'ReasoningTrigger'
ReasoningContent.displayName = 'ReasoningContent'

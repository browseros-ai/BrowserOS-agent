import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type BadgeTone = 'default' | 'muted' | 'warning'

const toneClasses: Record<BadgeTone, string> = {
  default: 'bg-primary/12 text-primary',
  muted: 'bg-secondary text-secondary-foreground',
  warning: 'bg-amber-100 text-amber-900',
}

export function Badge({
  className,
  children,
  tone = 'default',
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 font-medium text-[11px] uppercase tracking-[0.14em]',
        toneClasses[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}

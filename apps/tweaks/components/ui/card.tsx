import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-[1.25rem] border bg-card/90 text-card-foreground shadow-[0_18px_40px_rgba(74,44,19,0.08)] backdrop-blur',
        className,
      )}
      {...props}
    />
  )
}

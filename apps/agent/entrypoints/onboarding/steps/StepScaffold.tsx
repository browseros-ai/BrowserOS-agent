import type { FC, ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'

interface StepScaffoldProps {
  badge: string
  title: string
  description: string
  children: ReactNode
  aside?: ReactNode
}

export const StepScaffold: FC<StepScaffoldProps> = ({
  badge,
  title,
  description,
  children,
  aside,
}) => {
  return (
    <Card className="overflow-hidden rounded-[32px] border-border/70 bg-card/95 shadow-[0_30px_120px_-60px_rgba(207,111,44,0.4)] backdrop-blur">
      <div className="grid min-h-[620px] gap-0 lg:grid-cols-[minmax(0,1.35fr)_320px]">
        <div className="p-6 sm:p-8 lg:p-10">
          <div className="mb-8 space-y-3">
            <Badge
              variant="secondary"
              className="rounded-full bg-[var(--accent-orange)]/10 px-3 py-1 text-[var(--accent-orange)]"
            >
              {badge}
            </Badge>
            <div className="space-y-2">
              <h2 className="text-balance font-semibold text-3xl tracking-tight sm:text-4xl">
                {title}
              </h2>
              <p className="max-w-2xl text-base text-muted-foreground leading-7">
                {description}
              </p>
            </div>
          </div>

          {children}
        </div>

        <div className="border-border/70 border-t bg-muted/30 p-6 sm:p-8 lg:border-t-0 lg:border-l lg:p-10">
          {aside}
        </div>
      </div>
    </Card>
  )
}

import React from 'react'
import { Check, Loader2 } from 'lucide-react'
import { cn } from '@/sidepanel/lib/utils'

interface Stage {
  id: string
  label: string
  sublabel?: string
  status: 'completed' | 'active' | 'pending'
  progress?: number
}

interface ProcessingStagesProps {
  stages: Stage[]
}

export function ProcessingStages({ stages }: ProcessingStagesProps) {
  return (
    <div className="space-y-3">
      {stages.map((stage) => (
        <div key={stage.id} className="flex items-start gap-3">
          {/* Icon */}
          <div className="mt-0.5">
            {stage.status === 'completed' ? (
              <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                <Check className="w-3 h-3 text-white" />
              </div>
            ) : stage.status === 'active' ? (
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
            ) : (
              <div className="w-5 h-5 rounded-full bg-muted border-2 border-border" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1">
            <div className={cn(
              "text-sm",
              stage.status === 'completed' ? "text-foreground" :
              stage.status === 'active' ? "text-foreground font-medium" :
              "text-muted-foreground"
            )}>
              {stage.label}
            </div>

            {stage.sublabel && (
              <div className="text-xs text-muted-foreground mt-0.5">
                {stage.sublabel}
              </div>
            )}

            {/* Progress bar for active stage */}
            {stage.status === 'active' && stage.progress !== undefined && (
              <div className="mt-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-500 ease-out"
                      style={{ width: `${stage.progress}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {stage.progress}%
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
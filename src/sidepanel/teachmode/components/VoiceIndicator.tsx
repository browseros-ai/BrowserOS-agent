import React from 'react'
import { Mic, MicOff } from 'lucide-react'
import { cn } from '@/sidepanel/lib/utils'

interface VoiceIndicatorProps {
  isListening: boolean
  isEnabled: boolean
}

export function VoiceIndicator({ isListening, isEnabled }: VoiceIndicatorProps) {
  if (!isEnabled) {
    return null
  }

  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-2 rounded-lg",
      isListening ? "bg-destructive/10" : "bg-muted"
    )}>
      {isListening ? (
        <>
          <Mic className="w-4 h-4 text-destructive" />
          <div className="flex items-center gap-1">
            <span className="text-sm text-destructive font-medium">Listening</span>
            <div className="flex gap-0.5">
              <span className="inline-block w-1 h-3 bg-destructive/60 rounded-full animate-pulse" />
              <span className="inline-block w-1 h-3 bg-destructive/60 rounded-full animate-pulse"
                    style={{ animationDelay: '150ms' }} />
              <span className="inline-block w-1 h-3 bg-destructive/60 rounded-full animate-pulse"
                    style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </>
      ) : (
        <>
          <MicOff className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Voice inactive</span>
        </>
      )}
    </div>
  )
}
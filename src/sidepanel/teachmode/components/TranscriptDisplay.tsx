import React, { useRef, useEffect } from 'react'
import { Mic, MicOff, Volume2 } from 'lucide-react'
import { cn } from '@/sidepanel/lib/utils'

interface Transcript {
  timestamp: number
  text: string
  isFinal: boolean
}

interface TranscriptDisplayProps {
  transcripts: Transcript[]
  status: 'idle' | 'connecting' | 'connected' | 'error'
  isRecordingActive: boolean
}

export function TranscriptDisplay({ transcripts, status: status, isRecordingActive }: TranscriptDisplayProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new transcripts are added
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [transcripts])

  if (!isRecordingActive) {
    return null
  }

  const isListening = status === 'connected'
  const latestTranscript = transcripts[transcripts.length - 1]

  return (
    <div className="bg-background/95 backdrop-blur-sm">
      {/* Compact Header Bar */}
      <div className="px-4 py-2 flex items-center justify-between border-b bg-muted/20">
        <div className="flex items-center gap-3">
          {/* Status Indicator */}
          <div className="flex items-center gap-2">
            {isListening ? (
              <div className="flex items-center gap-1.5">
                <div className="relative">
                  <Volume2 className="w-4 h-4 text-green-600" />
                  <div className="absolute -inset-1 rounded-full bg-green-600/20 animate-ping" />
                </div>
                <span className="text-xs font-medium text-green-600">Listening</span>
              </div>
            ) : status === 'connecting' ? (
              <div className="flex items-center gap-1.5">
                <Mic className="w-4 h-4 text-yellow-600 animate-pulse" />
                <span className="text-xs text-yellow-600">Connecting...</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <MicOff className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Not listening</span>
              </div>
            )}
          </div>

          {/* Tip Text */}
          <div className="text-xs text-muted-foreground">
            {isListening
              ? "Speak to narrate your actions..."
              : status === 'error'
              ? "Voice unavailable (check API key)"
              : "Waiting to connect..."}
          </div>
        </div>

        {/* Transcript Count */}
        {transcripts.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {transcripts.length} transcript{transcripts.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Transcript Display Area - Compact */}
      <div
        ref={scrollRef}
        className="px-4 py-2 max-h-24 overflow-y-auto bg-background/50"
      >
        {transcripts.length === 0 ? (
          <div className="py-2 text-center">
            <p className="text-xs text-muted-foreground italic">
              {isListening ? '💡 Tip: Narrate what you\'re doing as you click for smarter automation' : 'No transcripts yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {/* Show last 3 transcripts only to keep it compact */}
            {transcripts.slice(-3).map((transcript, index) => (
              <div
                key={`${transcript.timestamp}-${index}`}
                className={cn(
                  "text-xs transition-opacity duration-300",
                  index === transcripts.slice(-3).length - 1
                    ? "text-foreground opacity-100"
                    : "text-muted-foreground opacity-60"
                )}
              >
                <span className={cn(
                  "inline-flex items-start gap-1",
                  transcript.isFinal ? "" : "italic"
                )}>
                  {index === transcripts.slice(-3).length - 1 && isListening && (
                    <span className="text-green-600">●</span>
                  )}
                  {transcript.text}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

import React from 'react'
import { Mic, MicOff, Volume2 } from 'lucide-react'

interface TranscriptDisplayProps {
  status: 'idle' | 'connecting' | 'connected' | 'transcribing' | 'error'
  isRecordingActive: boolean
}

export function TranscriptDisplay({ status, isRecordingActive }: TranscriptDisplayProps) {
  if (!isRecordingActive) {
    return null
  }

  const isListening = status === 'connected'

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
                <span className="text-xs font-medium text-green-600">Recording Audio</span>
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

          {/* Info Text */}
          <div className="text-xs text-muted-foreground">
            {isListening
              ? "Speak to narrate your actions..."
              : status === 'error'
              ? "Voice unavailable (check microphone)"
              : "Waiting to connect..."}
          </div>
        </div>
      </div>

      {/* Info Area */}
      <div className="px-4 py-2 bg-background/50">
        <div className="py-2 text-center">
          <p className="text-xs text-muted-foreground italic">
            {isListening ? '💡 Tip: Narrate what you\'re doing as you record for smarter automation' : 'Voice transcription will be processed after you stop recording'}
          </p>
        </div>
      </div>
    </div>
  )
}

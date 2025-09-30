import React from 'react'
import { Mic, MicOff, Volume2 } from 'lucide-react'

interface TranscriptDisplayProps {
  status: 'idle' | 'connecting' | 'connected' | 'transcribing' | 'error'
  isRecordingActive: boolean
  isMuted?: boolean
  onToggleMute?: () => void
}

export function TranscriptDisplay({ status, isRecordingActive, isMuted = false, onToggleMute }: TranscriptDisplayProps) {
  if (!isRecordingActive) {
    return null
  }

  const isListening = status === 'connected' && !isMuted

  return (
    <div className="bg-background">
      {/* Compact Header Bar */}
      <div className="px-4 py-2 flex items-center justify-between border-b bg-muted">
        <div className="flex items-center gap-3">
          {/* Mute Toggle Button */}
          {onToggleMute && (
            <button
              onClick={onToggleMute}
              className="flex items-center justify-center w-7 h-7 rounded-full border transition-all hover:scale-105 active:scale-95"
              style={{
                borderColor: isMuted ? 'hsl(var(--muted-foreground))' : 'hsl(var(--brand))',
                color: isMuted ? 'hsl(var(--muted-foreground))' : 'hsl(var(--brand))',
                backgroundColor: isMuted ? 'transparent' : 'transparent'
              }}
              aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isMuted ? (
                <MicOff className="w-3.5 h-3.5" />
              ) : (
                <Mic className="w-3.5 h-3.5" />
              )}
            </button>
          )}

          {/* Status Text */}
          <div className="text-xs font-medium" style={{
            color: isMuted
              ? 'hsl(var(--muted-foreground))'
              : isListening
              ? 'hsl(var(--brand))'
              : 'hsl(var(--muted-foreground))'
          }}>
            {isMuted
              ? "Audio Muted"
              : isListening
              ? "Recording Audio"
              : status === 'connecting'
              ? "Connecting..."
              : "Not listening"}
          </div>

          {/* Info Text */}
          <div className="text-xs text-muted-foreground">
            {isListening
              ? "Speak to narrate your actions..."
              : isMuted
              ? "Tap to resume audio"
              : status === 'error'
              ? "Voice unavailable (check microphone)"
              : "Waiting to connect..."}
          </div>
        </div>
      </div>

      {/* Info Area */}
      <div className="px-4 py-2 bg-background">
        <div className="py-2 text-center">
          <p className="text-xs text-muted-foreground italic">
            {isListening
              ? '💡 Tip: Narrate what you\'re doing as you record for smarter automation'
              : isMuted
              ? '🔇 Audio is muted - your actions are still being recorded'
              : 'Voice transcription will be processed after you stop recording'}
          </p>
        </div>
      </div>
    </div>
  )
}

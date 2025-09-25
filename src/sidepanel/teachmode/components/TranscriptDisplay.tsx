import React from 'react'
import { Mic, MicOff } from 'lucide-react'
import { cn } from '@/sidepanel/lib/utils'

interface VapiTranscript {
  timestamp: number
  text: string
  isFinal: boolean
}

interface TranscriptDisplayProps {
  transcripts: VapiTranscript[]
  vapiStatus: 'idle' | 'connecting' | 'connected' | 'error'
  isRecordingActive: boolean
}

export function TranscriptDisplay({ transcripts, vapiStatus, isRecordingActive }: TranscriptDisplayProps) {
  if (!isRecordingActive) {
    return null
  }

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  return (
    <div className="mt-4 border rounded-lg bg-background">
      {/* Header */}
      <div className="px-3 py-2 border-b bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">Voice Transcript</h3>
          {vapiStatus === 'connected' ? (
            <Mic className="w-3.5 h-3.5 text-green-600 animate-pulse" />
          ) : vapiStatus === 'connecting' ? (
            <Mic className="w-3.5 h-3.5 text-yellow-600" />
          ) : (
            <MicOff className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </div>
        <span className={cn(
          "text-xs px-2 py-0.5 rounded-full",
          vapiStatus === 'connected' ? 'bg-green-100 text-green-700' :
          vapiStatus === 'connecting' ? 'bg-yellow-100 text-yellow-700' :
          vapiStatus === 'error' ? 'bg-red-100 text-red-700' :
          'bg-muted text-muted-foreground'
        )}>
          {vapiStatus === 'connected' ? 'Listening' :
           vapiStatus === 'connecting' ? 'Connecting...' :
           vapiStatus === 'error' ? 'Error' : 'Not connected'}
        </span>
      </div>

      {/* Transcript Content */}
      <div className="p-3 max-h-32 overflow-y-auto">
        {transcripts.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-xs text-muted-foreground">
              {vapiStatus === 'connected'
                ? 'Speak to narrate your actions...'
                : vapiStatus === 'connecting'
                ? 'Initializing voice recording...'
                : vapiStatus === 'error'
                ? 'Voice recording unavailable (check OPENAI_API_KEY)'
                : 'Voice recording not started'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {transcripts.map((transcript, index) => (
              <div
                key={`${transcript.timestamp}-${index}`}
                className="flex gap-2 text-xs"
              >
                <span className="text-muted-foreground shrink-0">
                  {formatTime(transcript.timestamp)}
                </span>
                <span className="text-foreground">
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
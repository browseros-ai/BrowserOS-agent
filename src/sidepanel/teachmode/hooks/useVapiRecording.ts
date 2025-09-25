import { useEffect, useRef, useState } from 'react'
import Vapi from '@vapi-ai/web'
import { useTeachModeStore } from '../teachmode.store'

interface UseVapiRecordingProps {
  enabled: boolean
}

export interface VapiTranscript {
  timestamp: number  // Timestamp when transcript received
  text: string  // Transcript content
  isFinal: boolean  // Whether transcript is final or partial
}

export function useVapiRecording({ enabled }: UseVapiRecordingProps) {
  const vapiRef = useRef<Vapi | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { addTranscript, setVapiStatus } = useTeachModeStore()

  // Initialize VAPI client
  useEffect(() => {
    const vapiKey = process.env.VAPI_PUBLIC_KEY

    if (!vapiKey) {
      console.warn('VAPI_PUBLIC_KEY not configured - voice transcription disabled')
      setError('VAPI key not configured')
      return
    }

    try {
      const vapi = new Vapi(vapiKey)
      vapiRef.current = vapi

      // Set up event listeners
      vapi.on('call-start', () => {
        console.log('VAPI call started')
        setIsConnected(true)
        setIsConnecting(false)
        setVapiStatus('connected')
      })

      vapi.on('call-end', () => {
        console.log('VAPI call ended')
        setIsConnected(false)
        setIsConnecting(false)
        setVapiStatus('idle')
      })

      vapi.on('message', (message: any) => {
        // Handle transcript messages
        if (message.type === 'transcript' && message.role === 'user') {
          const transcript: VapiTranscript = {
            timestamp: Date.now(),
            text: message.transcript,
            isFinal: message.transcriptType === 'final'
          }

          // Only add final transcripts to avoid clutter
          if (transcript.isFinal && transcript.text.trim()) {
            addTranscript(transcript)
          }
        }
      })

      vapi.on('error', (error: any) => {
        console.error('VAPI error:', error)
        setError(error.message || 'VAPI connection error')
        setIsConnected(false)
        setIsConnecting(false)
        setVapiStatus('error')
      })

      return () => {
        vapi.stop()
        vapi.removeAllListeners()
      }
    } catch (err) {
      console.error('Failed to initialize VAPI:', err)
      setError('Failed to initialize voice recording')
    }
  }, [addTranscript, setVapiStatus])

  // Start/stop recording based on enabled prop
  useEffect(() => {
    const vapi = vapiRef.current
    if (!vapi) return

    const startRecording = async () => {
      if (enabled && !isConnected && !isConnecting) {
        setIsConnecting(true)
        setError(null)
        setVapiStatus('connecting')

        try {
          await vapi.start({
            // Minimal assistant config - just for transcription
            model: {
              provider: "openai",
              model: "gpt-4o-mini",
              messages: [
                {
                  role: "system",
                  content: "You are a silent transcriber. Only transcribe what you hear. Do not respond or speak."
                }
              ]
            },

            // Voice configuration (silent assistant)
            voice: {
              provider: "vapi",
              voiceId: "Elliot"
            },

            // Transcriber configuration
            transcriber: {
              provider: "deepgram",
              model: "nova-2",
              language: "en-US"
            },

            // No greeting or responses
            firstMessage: "",
            endCallMessage: "",
            endCallPhrases: [],

            // 30 minute max duration for recording sessions
            maxDurationSeconds: 1800
          })
        } catch (err) {
          console.error('Failed to start VAPI recording:', err)
          setError('Failed to start voice recording')
          setIsConnecting(false)
          setVapiStatus('error')
        }
      } else if (!enabled && isConnected) {
        vapi.stop()
      }
    }

    startRecording()
  }, [enabled, isConnected, isConnecting, setVapiStatus])

  return {
    isConnected,
    isConnecting,
    error
  }
}
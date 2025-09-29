import { useEffect, useRef, useState, useCallback } from 'react'
import { useTeachModeStore } from '../teachmode.store'

const DEFAULT_SAMPLE_RATE = 16000
const DEFAULT_CHUNK_DURATION_MS = 3000  // Send audio chunks every 3 seconds
const DEFAULT_SILENCE_THRESHOLD = 0.01  // VAD threshold for silence detection
const DEFAULT_SILENCE_DURATION_MS = 2000  // 2 seconds of silence to stop speaking

interface UseOpenAITranscriptionProps {
  enabled: boolean
}

export interface OpenAITranscript {
  timestamp: number
  text: string
  isFinal: boolean
}

/**
 * Custom hook for OpenAI transcription with gpt-4o-mini-transcribe
 * Works in browser/Chrome extension context using Fetch API
 */
export function useOpenAITranscription({ enabled }: UseOpenAITranscriptionProps) {
  // State management
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)

  // Refs for audio processing
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const animationFrameRef = useRef<number | null>(null)
  const silenceTimeoutRef = useRef<number | null>(null)
  const chunkIntervalRef = useRef<number | null>(null)
  const currentTranscriptRef = useRef<string>('')
  const abortControllerRef = useRef<AbortController | null>(null)
  const isProcessingRef = useRef(false)

  // Store actions
  const { addTranscript, setVoiceStatus } = useTeachModeStore()

  // Process audio chunks and send to OpenAI
  const processAudioChunk = useCallback(async () => {
    if (audioChunksRef.current.length === 0 || isProcessingRef.current) return

    isProcessingRef.current = true

    try {
      // Combine all chunks into a single blob
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
      audioChunksRef.current = []  // Clear chunks after creating blob

      // Create FormData with audio file directly
      const formData = new FormData()
      formData.append('file', audioBlob, 'audio.webm')
      formData.append('model', 'gpt-4o-mini-transcribe')
      formData.append('response_format', 'text')
      // Note: streaming might not be supported for audio transcriptions

      // Cancel previous request if still pending
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController()

      // Get API key from environment
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY not configured')
      }

      // Send to OpenAI API
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        },
        body: formData,
        signal: abortControllerRef.current.signal
      })

      if (!response.ok) {
        const errorData = await response.text()
        console.error('OpenAI API error response:', errorData)
        throw new Error(`OpenAI API error: ${response.status}`)
      }

      // Parse response - OpenAI audio transcription returns plain text or JSON
      const contentType = response.headers.get('content-type')
      let transcriptText = ''

      if (contentType?.includes('application/json')) {
        const data = await response.json()
        transcriptText = data.text || ''
      } else {
        transcriptText = await response.text()
      }

      // Add transcript if we got any text
      if (transcriptText.trim()) {
        // Update current transcript
        currentTranscriptRef.current = transcriptText

        // Add to store
        addTranscript({
          timestamp: Date.now(),
          text: transcriptText,
          isFinal: true
        })

        console.log('Transcription received:', transcriptText)
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Failed to process audio chunk:', err)
        setError(`Transcription error: ${err.message}`)
      }
    } finally {
      isProcessingRef.current = false
    }
  }, [addTranscript])

  // Voice Activity Detection (VAD) using audio level
  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current || !enabled) return

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteFrequencyData(dataArray)

    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
    const normalizedLevel = Math.min(100, (average / 128) * 100)
    setAudioLevel(normalizedLevel)

    // Simple VAD based on audio level
    const isSpeakingNow = normalizedLevel > DEFAULT_SILENCE_THRESHOLD * 100

    if (isSpeakingNow && !isSpeaking) {
      // Started speaking
      setIsSpeaking(true)
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current)
        silenceTimeoutRef.current = null
      }
    } else if (!isSpeakingNow && isSpeaking) {
      // Stopped speaking - wait for silence duration before marking as not speaking
      if (!silenceTimeoutRef.current) {
        silenceTimeoutRef.current = window.setTimeout(() => {
          setIsSpeaking(false)
          // Process any remaining audio chunks when speech ends
          processAudioChunk()
        }, DEFAULT_SILENCE_DURATION_MS)
      }
    }

    animationFrameRef.current = requestAnimationFrame(updateAudioLevel)
  }, [enabled, isSpeaking, processAudioChunk])

  // Start audio recording and transcription
  const startRecording = useCallback(async () => {
    try {
      setError(null)
      setIsConnecting(true)
      setVoiceStatus('connecting')

      // Check for API key
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY not configured')
      }

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: DEFAULT_SAMPLE_RATE,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })

      streamRef.current = stream

      // Set up audio context for level monitoring
      audioContextRef.current = new AudioContext()
      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 256

      const source = audioContextRef.current.createMediaStreamSource(stream)
      source.connect(analyserRef.current)

      // Determine best audio format
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000
      })

      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      // Handle data chunks
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      // Handle recording stop
      mediaRecorder.onstop = () => {
        // Process any remaining chunks
        processAudioChunk()

        // Cleanup
        stream.getTracks().forEach(track => track.stop())
        streamRef.current = null
        setIsConnected(false)
        setVoiceStatus('idle')
      }

      // Handle errors
      mediaRecorder.onerror = (event: any) => {
        console.error('MediaRecorder error:', event.error)
        setError(`Recording error: ${event.error?.message || 'Unknown error'}`)
        stopRecording()
      }

      // Start recording with timeslice for chunking
      mediaRecorder.start(250)  // Get data every 250ms

      setIsConnected(true)
      setIsConnecting(false)
      setVoiceStatus('connected')

      // Start audio level monitoring
      updateAudioLevel()

      // Set up periodic chunk processing
      chunkIntervalRef.current = window.setInterval(() => {
        if (audioChunksRef.current.length > 0 && isSpeaking) {
          processAudioChunk()
        }
      }, DEFAULT_CHUNK_DURATION_MS)

    } catch (err: any) {
      console.error('Failed to start recording:', err)

      let errorMessage = 'Failed to start voice recording'
      if (err.name === 'NotAllowedError') {
        errorMessage = 'Microphone permission denied'
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'No microphone found'
      } else if (err.message) {
        errorMessage = err.message
      }

      setError(errorMessage)
      setIsConnecting(false)
      setVoiceStatus('error')
    }
  }, [processAudioChunk, setVoiceStatus, updateAudioLevel])

  // Stop recording
  const stopRecording = useCallback(() => {
    // Stop media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }

    // Cancel any pending API requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    // Clear intervals and timeouts
    if (chunkIntervalRef.current) {
      clearInterval(chunkIntervalRef.current)
      chunkIntervalRef.current = null
    }

    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current)
      silenceTimeoutRef.current = null
    }

    // Stop animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    // Close audio context
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    // Stop stream tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    // Reset state
    setAudioLevel(0)
    setIsSpeaking(false)
    currentTranscriptRef.current = ''
  }, [])

  // Start/stop recording based on enabled prop
  useEffect(() => {
    if (enabled && !isConnected && !isConnecting) {
      startRecording()
    } else if (!enabled && isConnected) {
      stopRecording()
    }
  }, [enabled, isConnected, isConnecting, startRecording, stopRecording])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording()
    }
  }, [stopRecording])

  return {
    isConnected,
    isConnecting,
    error,
    isSpeaking,
    audioLevel
  }
}

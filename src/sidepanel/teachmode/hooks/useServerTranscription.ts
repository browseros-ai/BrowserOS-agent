import { useEffect, useRef, useState, useCallback } from 'react'
import { useTeachModeStore } from '../teachmode.store'

// Configuration constants
const CHUNK_INTERVAL_MS = 2000  // How often to capture audio chunks (2000ms = 2 seconds)
const API_URL = 'https://llm.browseros.com/api/transcribe'
const VAD_THRESHOLD = 30  // Voice activity detection threshold (0-255 scale, tune based on testing)
const MIN_CHUNK_SIZE = 500  // Minimum bytes to send (avoid tiny/empty chunks)

interface UseServerTranscriptionProps {
  enabled: boolean
}

/**
 * Voice Activity Detector
 * Monitors audio stream and detects speech vs silence
 */
class VoiceActivityDetector {
  private analyser: AnalyserNode
  private audioContext: AudioContext
  private dataArray: Uint8Array
  private threshold: number
  private hadSpeechInCurrentChunk: boolean = false
  private animationFrameId: number | null = null
  private onLevelUpdate?: (level: number) => void

  constructor(stream: MediaStream, threshold: number, onLevelUpdate?: (level: number) => void) {
    this.audioContext = new AudioContext()
    this.analyser = this.audioContext.createAnalyser()
    this.analyser.fftSize = 512
    this.analyser.smoothingTimeConstant = 0.8
    this.threshold = threshold
    this.onLevelUpdate = onLevelUpdate

    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount)

    const source = this.audioContext.createMediaStreamSource(stream)
    source.connect(this.analyser)
  }

  start() {
    this.monitor()
  }

  private monitor = () => {
    this.analyser.getByteFrequencyData(this.dataArray)

    // Calculate average amplitude
    const average = this.dataArray.reduce((sum, val) => sum + val, 0) / this.dataArray.length

    // Mark if we detected speech
    if (average > this.threshold) {
      this.hadSpeechInCurrentChunk = true
    }

    // Notify level for visualization
    if (this.onLevelUpdate) {
      this.onLevelUpdate(average)
    }

    this.animationFrameId = requestAnimationFrame(this.monitor)
  }

  // Check and reset for next chunk
  hadSpeech(): boolean {
    const result = this.hadSpeechInCurrentChunk
    this.hadSpeechInCurrentChunk = false
    return result
  }

  destroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }

    if (this.audioContext.state !== 'closed') {
      this.audioContext.close()
    }
  }
}

/**
 * Simple real-time transcription hook with VAD
 * Only sends chunks with detected speech to API
 */
export function useServerTranscription({ enabled }: UseServerTranscriptionProps) {
  // State
  const [transcripts, setTranscripts] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const vadRef = useRef<VoiceActivityDetector | null>(null)
  const chunkCountRef = useRef(0)
  const audioChunksRef = useRef<Blob[]>([])  // Accumulate chunks

  const { addTranscript, setVoiceStatus } = useTeachModeStore()

  // Send audio chunk to API
  const sendToAPI = useCallback(async (audioBlob: Blob, chunkIndex: number) => {
    try {
      // Debug: Check blob details
      console.log(`[Chunk #${chunkIndex}] Sending:`, {
        size: audioBlob.size,
        type: audioBlob.type,
        sizeKB: (audioBlob.size / 1024).toFixed(2) + 'KB'
      })

      // Check first few bytes to see if it's a valid WebM
      const arrayBuffer = await audioBlob.slice(0, 4).arrayBuffer()
      const bytes = new Uint8Array(arrayBuffer)
      const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ')
      console.log(`[Chunk #${chunkIndex}] First 4 bytes:`, hex)
      // Valid WebM should start with: 1a 45 df a3 (EBML header)

      const formData = new FormData()
      // Ensure filename matches the type
      const filename = audioBlob.type.includes('opus') ? 'audio.webm' : 'audio.webm'
      formData.append('file', audioBlob, filename)
      formData.append('model', 'gpt-4o-mini-transcribe')
      formData.append('response_format', 'json')

      const response = await fetch(API_URL, {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Transcription API error:', response.status, errorText)
        return
      }

      const data = await response.json()
      const text = data.text?.trim()

      if (text) {
        setTranscripts(prev => [...prev, text])

        addTranscript({
          timestamp: Date.now(),
          text,
          isFinal: true
        })

        console.log('✓ Transcript:', text)
      }
    } catch (err) {
      console.error('Transcription failed:', err)
    }
  }, [addTranscript])

  // Start recording with VAD
  const startRecording = useCallback(async () => {
    try {
      setError(null)
      setVoiceStatus('connecting')

      // Get microphone
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })

      streamRef.current = stream

      // Initialize VAD
      vadRef.current = new VoiceActivityDetector(
        stream,
        VAD_THRESHOLD,
        (level) => setAudioLevel(level)
      )
      vadRef.current.start()

      // Setup MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 16000
      })

      mediaRecorderRef.current = mediaRecorder

      // Handle chunks with VAD check - send individually
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          const hasSpeech = vadRef.current?.hadSpeech()
          chunkCountRef.current++

          if (hasSpeech && event.data.size > MIN_CHUNK_SIZE) {  // Avoid tiny chunks
            // Send individual chunk directly - DO NOT accumulate
            console.log(`✓ Sending chunk #${chunkCountRef.current} with speech (${event.data.size} bytes)`)

            // Create proper blob with mime type including codec
            const audioBlob = new Blob([event.data], {
              type: 'audio/webm;codecs=opus'
            })

            sendToAPI(audioBlob, chunkCountRef.current)
          } else {
            console.log(`✗ Skipped chunk #${chunkCountRef.current} (silent or too small: ${event.data.size} bytes)`)
          }
        }
      }

      mediaRecorder.onstop = () => {
        // No accumulation anymore - chunks sent individually
        console.log(`Recording stopped after ${chunkCountRef.current} chunks`)

        stream.getTracks().forEach(track => track.stop())
        streamRef.current = null
        setIsRecording(false)
        setAudioLevel(0)
        setVoiceStatus('idle')
        chunkCountRef.current = 0
      }

      mediaRecorder.onerror = (event: any) => {
        console.error('MediaRecorder error:', event.error)
        setError(`Recording error: ${event.error?.message || 'Unknown error'}`)
        stopRecording()
      }

      // Start with 1s chunks
      mediaRecorder.start(CHUNK_INTERVAL_MS)

      setIsRecording(true)
      setVoiceStatus('connected')

      console.log('Recording started with VAD (threshold:', VAD_THRESHOLD, ')')

    } catch (err: any) {
      console.error('Failed to start recording:', err)

      let errorMessage = 'Failed to start recording'
      if (err.name === 'NotAllowedError') {
        errorMessage = 'Microphone permission denied'
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'No microphone found'
      } else if (err.message) {
        errorMessage = err.message
      }

      setError(errorMessage)
      setVoiceStatus('error')
    }
  }, [sendToAPI, setVoiceStatus])

  // Stop recording and cleanup
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }

    if (vadRef.current) {
      vadRef.current.destroy()
      vadRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    setIsRecording(false)
    setAudioLevel(0)
    setVoiceStatus('idle')
  }, [setVoiceStatus])

  // Auto start/stop based on enabled prop
  useEffect(() => {
    if (enabled && !isRecording) {
      startRecording()
    } else if (!enabled && isRecording) {
      stopRecording()
    }
  }, [enabled, isRecording, startRecording, stopRecording])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording()
    }
  }, [stopRecording])

  return {
    transcripts,
    error,
    isRecording,
    audioLevel  // Export for visualization
  }
}

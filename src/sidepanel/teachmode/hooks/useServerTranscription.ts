import { useEffect, useRef, useState, useCallback } from 'react'
import { useTeachModeStore } from '../teachmode.store'

// Configuration constants
const API_URL = 'https://llm.browseros.com/api/transcribe'
const VAD_START_THRESHOLD = 0.014  // RMS threshold for detecting speech
const VAD_HANGOVER_MS = 250  // Keep tagging speech briefly after it ends
const MIN_RECORDING_SIZE_BYTES = 1800  // Guard against near-empty recordings

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
  private timeDomainData: Uint8Array
  private hadSpeechInCurrentChunk = false
  private lastSpeechDetectedAt: number | null = null
  private animationFrameId: number | null = null
  private smoothedLevel = 0

  constructor(stream: MediaStream, private onLevelUpdate?: (level: number) => void) {
    this.audioContext = new AudioContext()
    this.analyser = this.audioContext.createAnalyser()
    this.analyser.fftSize = 1024
    this.analyser.smoothingTimeConstant = 0.8

    this.timeDomainData = new Uint8Array(this.analyser.fftSize)

    const source = this.audioContext.createMediaStreamSource(stream)
    source.connect(this.analyser)
  }

  start() {
    this.monitor()
  }

  private monitor = () => {
    this.analyser.getByteTimeDomainData(this.timeDomainData)

    let sumSquares = 0
    for (let i = 0; i < this.timeDomainData.length; i++) {
      const centeredSample = (this.timeDomainData[i] - 128) / 128
      sumSquares += centeredSample * centeredSample
    }

    const rms = Math.sqrt(sumSquares / this.timeDomainData.length)

    // Light smoothing so the waveform stays readable
    this.smoothedLevel = (this.smoothedLevel * 0.7) + (rms * 0.3)
    if (this.onLevelUpdate) {
      const normalizedLevel = Math.min(1, this.smoothedLevel * 8)
      this.onLevelUpdate(Math.round(normalizedLevel * 100))
    }

    const now = performance.now()
    if (rms >= VAD_START_THRESHOLD) {
      this.hadSpeechInCurrentChunk = true
      this.lastSpeechDetectedAt = now
    } else if (this.lastSpeechDetectedAt && (now - this.lastSpeechDetectedAt) < VAD_HANGOVER_MS) {
      this.hadSpeechInCurrentChunk = true
    }

    this.animationFrameId = requestAnimationFrame(this.monitor)
  }

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
  const recordingDataRef = useRef<Blob[]>([])
  const hasSpeechRef = useRef(false)

  const { addTranscript, setVoiceStatus } = useTeachModeStore()

  // Send audio to API
  const sendToAPI = useCallback(async (audioBlob: Blob) => {
    try {
      console.log('Sending recording:', {
        size: audioBlob.size,
        type: audioBlob.type,
        sizeKB: (audioBlob.size / 1024).toFixed(2) + 'KB'
      })

      const formData = new FormData()
      formData.append('file', audioBlob, 'recording.webm')
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
      recordingDataRef.current = []
      hasSpeechRef.current = false

      // Initialize VAD
      vadRef.current = new VoiceActivityDetector(
        stream,
        (level) => setAudioLevel(level)
      )
      vadRef.current.start()

      // Setup MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 64000
      })

      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        const blob = event.data
        if (!blob || blob.size === 0) {
          console.log('✗ Skipped empty chunk')
          return
        }

        recordedChunksRef.current.push(blob)
        chunkCountRef.current += 1

        const hasSpeech = vadRef.current?.hadSpeech() ?? false
        if (hasSpeech) {
          hasSpeechRef.current = true
          console.log(`✓ Captured chunk #${chunkCountRef.current} with speech (${blob.size} bytes)`)
        } else {
          console.log(`… Captured chunk #${chunkCountRef.current} (marked silent, ${blob.size} bytes)`)  // Still needed for container integrity
        }
      }

      mediaRecorder.onstop = () => {
        const combinedBlob = recordedChunksRef.current.length
          ? new Blob(recordedChunksRef.current, { type: mimeType })
          : null

        if (combinedBlob && combinedBlob.size >= MIN_CHUNK_SIZE_BYTES && hasSpeechRef.current) {
          console.log(`→ Sending combined recording (${combinedBlob.size} bytes) after ${chunkCountRef.current} chunks`)
          void sendToAPI(combinedBlob, chunkCountRef.current)
        } else {
          console.log('✗ Skipped upload (no speech or blob too small)', {
            chunkCount: chunkCountRef.current,
            hadSpeech: hasSpeechRef.current,
            size: combinedBlob?.size ?? 0
          })
        }

        recordedChunksRef.current = []
        hasSpeechRef.current = false
        chunkCountRef.current = 0

        stream.getTracks().forEach(track => track.stop())
        streamRef.current = null
        setIsRecording(false)
        setAudioLevel(0)
        setVoiceStatus('idle')
      }

      mediaRecorder.onerror = (event: any) => {
        console.error('MediaRecorder error:', event.error)
        setError(`Recording error: ${event.error?.message || 'Unknown error'}`)
        stopRecording()
      }

      // Start recording with fixed chunk interval
      mediaRecorder.start(CHUNK_INTERVAL_MS)

      setIsRecording(true)
      setVoiceStatus('connected')

      console.log('Recording started with RMS-based VAD')

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

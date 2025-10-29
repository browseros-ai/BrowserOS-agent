import { useEffect, useRef, useState, useCallback } from 'react'
import { useTeachModeStore } from '../teachmode.store'

// Configuration constants
const VAD_START_THRESHOLD = 0.014  // RMS threshold for detecting speech
const VAD_HANGOVER_MS = 250  // Keep tagging speech briefly after it ends

interface UseAudioRecordingProps {
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
 * Audio recording hook with VAD for visualization
 * Captures audio locally and provides blob for backend transcription
 */
export function useAudioRecording({ enabled }: UseAudioRecordingProps) {
  // State
  const [error, setError] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const [isMuted, setIsMuted] = useState(false)

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const vadRef = useRef<VoiceActivityDetector | null>(null)
  const recordingDataRef = useRef<Blob[]>([])
  const hasSpeechRef = useRef(false)
  const audioBlobRef = useRef<Blob | null>(null)

  const { setVoiceStatus } = useTeachModeStore()

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
        if (event.data && event.data.size > 0) {
          recordingDataRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        // Create audio blob from accumulated chunks
        console.log('[useAudioRecording] onstop handler - chunks:', recordingDataRef.current.length)
        const audioBlob = recordingDataRef.current.length > 0
          ? new Blob(recordingDataRef.current, { type: mimeType })
          : null

        // Store blob for retrieval
        audioBlobRef.current = audioBlob

        if (audioBlob && hasSpeechRef.current) {
          console.log(`[useAudioRecording] ✓ Audio captured: ${audioBlob.size} bytes (${(audioBlob.size / 1024).toFixed(2)}KB)`)
        } else {
          console.log('[useAudioRecording] ✗ No audio captured', {
            hadSpeech: hasSpeechRef.current,
            size: audioBlob?.size ?? 0,
            chunks: recordingDataRef.current.length
          })
        }

        // Cleanup
        recordingDataRef.current = []
        hasSpeechRef.current = false

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

      // Start continuous recording
      mediaRecorder.start()

      // Monitor for speech during recording
      const speechMonitorInterval = setInterval(() => {
        if (vadRef.current?.hadSpeech()) {
          hasSpeechRef.current = true
        }
      }, 100)

      // Store interval ID for cleanup
      mediaRecorder.addEventListener('stop', () => {
        clearInterval(speechMonitorInterval)
      }, { once: true })

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
  }, [setVoiceStatus])

  // Stop recording and cleanup - returns Promise with audio blob
  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current

      // If not recording, resolve immediately
      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
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
        resolve(null)
        return
      }

      // Setup one-time onstop handler to resolve with audio
      const originalOnstop = mediaRecorder.onstop
      mediaRecorder.onstop = (event) => {
        // Call original handler if exists
        if (originalOnstop) {
          originalOnstop.call(mediaRecorder, event)
        }

        // Get the audio blob that was saved
        const audioBlob = audioBlobRef.current
        console.log('[useAudioRecording] stopRecording Promise resolving with:',
          audioBlob ? `${audioBlob.size} bytes` : 'null')

        // Cleanup
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

        // Resolve with the audio blob
        resolve(audioBlob)
      }

      // Stop recording - will trigger onstop handler
      mediaRecorder.stop()
    })
  }, [setVoiceStatus])

  // Auto start based on enabled prop (but NOT auto stop - that's handled manually)
  useEffect(() => {
    if (enabled && !isRecording) {
      startRecording()
    }
    // Removed auto-stop to prevent race conditions
    // Stop is now handled manually by the component
  }, [enabled, isRecording, startRecording])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Fire-and-forget cleanup on unmount
      stopRecording().catch(() => {
        // Ignore errors during unmount cleanup
      })
    }
  }, [stopRecording])

  // Toggle mute - disables audio tracks without stopping recording
  const toggleMute = useCallback(() => {
    if (!streamRef.current) return

    const audioTracks = streamRef.current.getAudioTracks()
    const newMutedState = !isMuted

    audioTracks.forEach(track => {
      track.enabled = !newMutedState
    })

    setIsMuted(newMutedState)
    setAudioLevel(0)  // Reset waveform when muted

    // Update voice status
    if (newMutedState) {
      setVoiceStatus('idle')
    } else {
      setVoiceStatus('connected')
    }
  }, [isMuted, setVoiceStatus])

  // Get captured audio blob
  const getAudioBlob = useCallback((): Blob | null => {
    return audioBlobRef.current
  }, [])

  return {
    error,
    isRecording,
    audioLevel,
    isMuted,
    getAudioBlob,
    stopRecording,  // Export for manual control
    toggleMute
  }
}

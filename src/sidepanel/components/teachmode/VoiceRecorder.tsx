import React, { useState, useRef, useEffect } from 'react'

interface VoiceRecorderProps {
  onRecordingStart?: () => void
  onRecordingStop?: (blob: Blob) => void
  onAudioChunk?: (chunk: Blob) => void
  className?: string
}

/**
 * Voice recorder component for sidepanel with real-time audio streaming
 */
export function VoiceRecorder({
  onRecordingStart,
  onRecordingStop,
  onAudioChunk,
  className = ''
}: VoiceRecorderProps) {
  // Recording state
  const [isRecording, setIsRecording] = useState(false)
  const [permissionStatus, setPermissionStatus] = useState<'prompt' | 'granted' | 'denied' | 'checking'>('checking')
  const [audioLevel, setAudioLevel] = useState(0)
  const [recordingTime, setRecordingTime] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  // Refs for recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null)

  // Check microphone permission on mount
  useEffect(() => {
    checkPermission()

    return () => {
      // Cleanup on unmount
      if (isRecording) {
        stopRecording()
      }
      stopAudioVisualization()
      if (recordedAudioUrl) {
        URL.revokeObjectURL(recordedAudioUrl)
      }
    }
  }, [])

  // Check microphone permission status
  const checkPermission = async () => {
    try {
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName })
      setPermissionStatus(result.state)

      // Listen for permission changes
      result.addEventListener('change', () => {
        setPermissionStatus(result.state)
      })
    } catch (err) {
      // Permissions API might not be fully supported
      setPermissionStatus('prompt')
    }
  }

  // Start audio level visualization
  const startAudioVisualization = (stream: MediaStream) => {
    try {
      audioContextRef.current = new AudioContext()
      analyserRef.current = audioContextRef.current.createAnalyser()

      const source = audioContextRef.current.createMediaStreamSource(stream)
      source.connect(analyserRef.current)

      analyserRef.current.fftSize = 256
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)

      const updateLevel = () => {
        if (!analyserRef.current || !isRecording) return

        analyserRef.current.getByteFrequencyData(dataArray)
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
        setAudioLevel(Math.min(100, (average / 128) * 100))

        animationFrameRef.current = requestAnimationFrame(updateLevel)
      }

      updateLevel()
    } catch (err) {
      console.log('Audio visualization not available:', err)
    }
  }

  // Stop audio visualization
  const stopAudioVisualization = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    setAudioLevel(0)
  }

  // Start recording
  const startRecording = async () => {
    try {
      setError(null)
      console.log('[VoiceRecorder] Requesting microphone access...')

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,  // Mono for smaller data
          sampleRate: 16000,  // Optimal for speech recognition
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })

      console.log('[VoiceRecorder] Microphone access granted')
      setPermissionStatus('granted')
      streamRef.current = stream

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
      chunksRef.current = []

      // Handle data chunks for streaming
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)

          // Stream chunk for real-time processing
          if (onAudioChunk) {
            onAudioChunk(event.data)
          }
        }
      }

      // Handle recording stop
      mediaRecorder.onstop = () => {
        console.log('[VoiceRecorder] Recording stopped, creating final blob')

        const blob = new Blob(chunksRef.current, { type: mimeType })

        // Create URL for playback
        if (recordedAudioUrl) {
          URL.revokeObjectURL(recordedAudioUrl)
        }
        const audioUrl = URL.createObjectURL(blob)
        setRecordedAudioUrl(audioUrl)

        if (onRecordingStop) {
          onRecordingStop(blob)
        }

        // Cleanup
        stream.getTracks().forEach(track => track.stop())
        streamRef.current = null
        stopAudioVisualization()
        setIsRecording(false)
      }

      // Handle errors
      mediaRecorder.onerror = (event: any) => {
        console.error('[VoiceRecorder] MediaRecorder error:', event.error)
        setError(`Recording error: ${event.error?.message || 'Unknown error'}`)
        stopRecording()
      }

      // Start recording with 250ms chunks for streaming
      mediaRecorder.start(250)
      setIsRecording(true)
      setRecordingTime(0)

      // Notify parent component
      if (onRecordingStart) {
        onRecordingStart()
      }

      // Start visualization
      startAudioVisualization(stream)

      // Start timer
      let seconds = 0
      timerRef.current = setInterval(() => {
        seconds++
        setRecordingTime(seconds)
      }, 1000)

      console.log('[VoiceRecorder] Recording started successfully')

    } catch (err: any) {
      console.error('[VoiceRecorder] Failed to start recording:', err)

      if (err.name === 'NotAllowedError') {
        setPermissionStatus('denied')
        setError('Microphone permission denied. Please allow microphone access.')
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found. Please connect a microphone.')
      } else if (err.name === 'NotReadableError') {
        setError('Microphone is already in use by another application.')
      } else {
        setError(`Failed to start recording: ${err.message}`)
      }
    }
  }

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      console.log('[VoiceRecorder] Stopping recording...')
      mediaRecorderRef.current.stop()
    }

    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    // Stop stream tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
  }

  // Format time as mm:ss
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Handle audio playback
  const handlePlayPause = () => {
    if (!audioPlayerRef.current || !recordedAudioUrl) return

    if (isPlaying) {
      audioPlayerRef.current.pause()
      setIsPlaying(false)
    } else {
      audioPlayerRef.current.play()
      setIsPlaying(true)
    }
  }

  // Clear the recording
  const clearRecording = () => {
    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl)
      setRecordedAudioUrl(null)
    }
    setIsPlaying(false)
    setRecordingTime(0)
    setError(null)
  }

  return (
    <div className={`voice-recorder ${className}`}>
      {/* Permission Status */}
      {permissionStatus === 'denied' && (
        <div className="mb-3 px-3 py-2 rounded-md bg-red-500/10 text-red-500 text-xs">
          Microphone permission denied. Please enable it in browser settings.
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mb-3 px-3 py-2 rounded-md bg-red-500/10 text-red-500 text-xs">
          {error}
        </div>
      )}

      {/* Recording Status */}
      {isRecording && (
        <div className="mb-3 px-3 py-2 rounded-md bg-green-500/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              <span className="text-xs font-medium text-red-500">Recording</span>
            </div>
            <span className="text-xs font-mono">{formatTime(recordingTime)}</span>
          </div>

          {/* Audio Level Meter */}
          <div className="mt-2">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all duration-100"
                style={{ width: `${audioLevel}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Audio Player */}
      {recordedAudioUrl && !isRecording && (
        <div className="mb-3 px-3 py-3 rounded-md bg-blue-500/10 border border-blue-500/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-blue-500">Recording Ready</span>
            <span className="text-xs font-mono text-muted-foreground">{formatTime(recordingTime)}</span>
          </div>

          {/* Hidden audio element */}
          <audio
            ref={audioPlayerRef}
            src={recordedAudioUrl}
            onEnded={() => setIsPlaying(false)}
            className="hidden"
          />

          {/* Player controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePlayPause}
              className="flex-1 py-2 px-3 rounded-md bg-blue-500/20 hover:bg-blue-500/30 text-blue-500 text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              {isPlaying ? (
                <>
                  <span className="w-4 h-4 flex items-center justify-center">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </span>
                  Pause
                </>
              ) : (
                <>
                  <span className="w-4 h-4 flex items-center justify-center">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                    </svg>
                  </span>
                  Play
                </>
              )}
            </button>

            <button
              onClick={clearRecording}
              className="py-2 px-3 rounded-md bg-red-500/20 hover:bg-red-500/30 text-red-500 text-sm font-medium transition-colors flex items-center gap-1"
            >
              <span className="w-4 h-4 flex items-center justify-center">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </span>
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Recording Button */}
      <button
        onClick={isRecording ? stopRecording : startRecording}
        className={`
          w-full py-2.5 px-4 rounded-lg font-medium text-sm
          transition-all duration-200 transform active:scale-[0.98]
          flex items-center justify-center gap-2
          ${isRecording
            ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20'
            : 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/20'
          }
        `}
        style={{ display: recordedAudioUrl && !isRecording ? 'none' : 'flex' }}
      >
        {isRecording ? (
          <>
            <span className="w-4 h-4 flex items-center justify-center">
              <span className="w-2 h-2 bg-white rounded-sm"></span>
            </span>
            Stop Recording
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M7 4a3 3 0 016 0v6a3 3 0 11-6 0V4z" />
              <path d="M5.5 9.643a.75.75 0 00-1.5 0V10c0 3.06 2.29 5.585 5.25 5.954V17.5h-1.5a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-1.5v-1.546A6.001 6.001 0 0016 10v-.357a.75.75 0 00-1.5 0V10a4.5 4.5 0 01-9 0v-.357z" />
            </svg>
            Start Voice Recording
          </>
        )}
      </button>

      {/* Instructions */}
      {!recordedAudioUrl && (
        <div className="mt-2 text-xs text-muted-foreground text-center">
          {isRecording
            ? 'Recording audio... Click stop when done'
            : 'Click to record voice narration'
          }
        </div>
      )}
    </div>
  )
}
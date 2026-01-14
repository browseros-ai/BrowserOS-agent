import { useCallback, useEffect, useRef, useState } from 'react'

const GATEWAY_URL = 'https://llm.browseros.com'

interface UseVoiceInputReturn {
  isRecording: boolean
  isTranscribing: boolean
  transcript: string
  audioLevel: number
  error: string | null
  startRecording: () => Promise<void>
  stopRecording: () => Promise<void>
  clearTranscript: () => void
}

async function transcribeAudio(audioBlob: Blob): Promise<string> {
  const formData = new FormData()
  formData.append('file', audioBlob, 'recording.webm')
  formData.append('response_format', 'json')

  const response = await fetch(`${GATEWAY_URL}/api/transcribe`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: 'Transcription failed' }))
    throw new Error(error.error || `Transcription failed: ${response.status}`)
  }

  const result = await response.json()
  return result.text || ''
}

export function useVoiceInput(): UseVoiceInputReturn {
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [audioLevel, setAudioLevel] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  const stopAudioLevelMonitoring = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    if (audioContextRef.current?.state !== 'closed') {
      audioContextRef.current?.close()
    }
    audioContextRef.current = null
    analyserRef.current = null
    setAudioLevel(0)
  }, [])

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => {
        track.stop()
      })
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
      stopAudioLevelMonitoring()
    }
  }, [stopAudioLevelMonitoring])

  const startAudioLevelMonitoring = useCallback((stream: MediaStream) => {
    const audioContext = new AudioContext()
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 256

    const source = audioContext.createMediaStreamSource(stream)
    source.connect(analyser)

    audioContextRef.current = audioContext
    analyserRef.current = analyser

    const updateLevel = () => {
      if (!analyserRef.current) return

      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
      analyserRef.current.getByteFrequencyData(dataArray)

      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
      const normalized = Math.min(100, (average / 128) * 100)
      setAudioLevel(Math.round(normalized))

      animationFrameRef.current = requestAnimationFrame(updateLevel)
    }

    updateLevel()
  }, [])

  const startRecording = useCallback(async () => {
    try {
      setError(null)
      setTranscript('')
      chunksRef.current = []

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })

      streamRef.current = stream
      startAudioLevelMonitoring(stream)

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'

      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorder.start(250)
      setIsRecording(true)
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setError('Microphone permission denied')
        } else if (err.name === 'NotFoundError') {
          setError('No microphone found')
        } else {
          setError(err.message)
        }
      } else {
        setError('Failed to start recording')
      }
    }
  }, [startAudioLevelMonitoring])

  const stopRecording = useCallback(async () => {
    const mediaRecorder = mediaRecorderRef.current

    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      return
    }

    await new Promise<void>((resolve) => {
      mediaRecorder.onstop = () => resolve()
      mediaRecorder.stop()
    })

    streamRef.current?.getTracks().forEach((track) => {
      track.stop()
    })
    streamRef.current = null
    stopAudioLevelMonitoring()
    setIsRecording(false)

    const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' })
    chunksRef.current = []

    if (audioBlob.size === 0) {
      setError('No audio recorded')
      return
    }

    setIsTranscribing(true)
    try {
      const text = await transcribeAudio(audioBlob)
      if (text.trim()) {
        setTranscript(text.trim())
      } else {
        setError('No speech detected')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transcription failed')
    } finally {
      setIsTranscribing(false)
    }
  }, [stopAudioLevelMonitoring])

  const clearTranscript = useCallback(() => {
    setTranscript('')
    setError(null)
  }, [])

  return {
    isRecording,
    isTranscribing,
    transcript,
    audioLevel,
    error,
    startRecording,
    stopRecording,
    clearTranscript,
  }
}

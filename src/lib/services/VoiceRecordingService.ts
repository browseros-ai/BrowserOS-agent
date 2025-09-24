import { Logging } from '@/lib/utils/Logging'

interface VAPIConfig {
  apiKey: string
  model?: string // e.g., 'nova-2', 'whisper-1'
  language?: string
}

interface VAPITranscriptSegment {
  text: string
  startTime: number
  endTime: number
  confidence?: number
}

/**
 * Service for voice recording with VAPI transcription
 * Handles microphone access, real-time transcription, and voice data management
 */
export class VoiceRecordingService {
  private static instance: VoiceRecordingService
  private mediaRecorder: MediaRecorder | null = null
  private audioStream: MediaStream | null = null
  private vapiSessionId: string | null = null
  private transcript: string = ''
  private segments: VAPITranscriptSegment[] = []
  private startTime: number = 0
  private isRecording = false
  private audioChunks: Blob[] = []

  private constructor() {}

  static getInstance(): VoiceRecordingService {
    if (!VoiceRecordingService.instance) {
      VoiceRecordingService.instance = new VoiceRecordingService()
    }
    return VoiceRecordingService.instance
  }

  /**
   * Start voice recording with VAPI transcription
   */
  async startRecording(): Promise<void> {
    try {
      // Check if already recording
      if (this.isRecording) {
        Logging.log('VoiceRecordingService', 'Voice recording already active', 'warning')
        return
      }

      // Request Chrome extension permissions first
      const hasExtensionPermission = await this.requestChromePermissions()
      if (!hasExtensionPermission) {
        throw new Error('Chrome extension microphone permission denied')
      }

      // Now request browser microphone access
      const hasMediaPermission = await this.checkMicrophonePermission()
      if (!hasMediaPermission) {
        Logging.log('VoiceRecordingService', 'Requesting microphone permission...')
        const granted = await this.requestMicrophonePermission()
        if (!granted) {
          throw new Error('Microphone permission denied')
        }
      }

      // Request microphone access
      Logging.log('VoiceRecordingService', 'Requesting microphone access...')
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: true
      })
      Logging.log('VoiceRecordingService', 'Microphone access granted')

      // Initialize VAPI session
      this.vapiSessionId = await this._initializeVAPISession()

      // Start MediaRecorder
      this.mediaRecorder = new MediaRecorder(this.audioStream, {
        mimeType: 'audio/webm;codecs=opus'
      })

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data)
          this._sendAudioToVAPI(event.data)
        }
      }

      this.mediaRecorder.start(1000) // Send chunks every 1 second
      this.startTime = Date.now()
      this.isRecording = true

      Logging.log('VoiceRecordingService', 'Started voice recording with VAPI')

    } catch (error) {
      Logging.log('VoiceRecordingService', `Failed to start voice recording: ${error}`, 'error')
      throw error
    }
  }

  /**
   * Stop voice recording
   */
  async stopRecording(): Promise<{
    transcript: string
    duration: number
    segments: VAPITranscriptSegment[]
    vapiSessionId: string | null
  }> {
    try {
      if (!this.isRecording) {
        throw new Error('No active voice recording')
      }

      // Stop MediaRecorder
      if (this.mediaRecorder) {
        this.mediaRecorder.stop()
        this.mediaRecorder = null
      }

      // Stop audio stream
      if (this.audioStream) {
        this.audioStream.getTracks().forEach(track => track.stop())
        this.audioStream = null
      }

      // Finalize VAPI session
      if (this.vapiSessionId) {
        await this._finalizeVAPISession()
      }

      const result = {
        transcript: this.transcript,
        duration: Date.now() - this.startTime,
        segments: [...this.segments],
        vapiSessionId: this.vapiSessionId
      }

      // Reset state
      this._resetState()

      Logging.log('VoiceRecordingService', `Stopped voice recording: ${result.transcript.length} chars, ${result.segments.length} segments`)
      return result

    } catch (error) {
      Logging.log('VoiceRecordingService', `Failed to stop voice recording: ${error}`, 'error')
      throw error
    }
  }

  /**
   * Get current transcript (for real-time updates)
   */
  getCurrentTranscript(): string {
    return this.transcript
  }

  /**
   * Check if recording
   */
  isVoiceRecording(): boolean {
    return this.isRecording
  }

  /**
   * Initialize VAPI session
   */
  private async _initializeVAPISession(): Promise<string> {
    const config = await this._getVAPIConfig()

    if (!config.apiKey) {
      throw new Error('VAPI API key not configured')
    }

    try {
      const response = await fetch('https://api.vapi.ai/session', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: config.model || 'nova-2',
          language: config.language || 'en',
          stream: true
        })
      })

      if (!response.ok) {
        throw new Error(`VAPI session init failed: ${response.statusText}`)
      }

      const data = await response.json()
      return data.sessionId

    } catch (error) {
      Logging.log('VoiceRecordingService', `VAPI session initialization failed: ${error}`, 'error')
      throw error
    }
  }

  /**
   * Send audio data to VAPI
   */
  private async _sendAudioToVAPI(audioData: Blob): Promise<void> {
    if (!this.vapiSessionId) return

    try {
      const config = await this._getVAPIConfig()

      const formData = new FormData()
      formData.append('audio', audioData)
      formData.append('sessionId', this.vapiSessionId)

      const response = await fetch(`https://api.vapi.ai/session/${this.vapiSessionId}/audio`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: formData
      })

      if (response.ok) {
        const result = await response.json()
        if (result.transcript) {
          this._handleTranscriptionUpdate(result)
        }
      }

    } catch (error) {
      Logging.log('VoiceRecordingService', `Failed to send audio to VAPI: ${error}`, 'warning')
    }
  }

  /**
   * Handle transcription updates from VAPI
   */
  private _handleTranscriptionUpdate(result: any): void {
    if (result.segments) {
      // Add new segments
      const newSegments = result.segments.map((seg: any) => ({
        text: seg.text,
        startTime: seg.startTime,
        endTime: seg.endTime,
        confidence: seg.confidence
      }))

      this.segments.push(...newSegments)
    }

    // Update full transcript
    if (result.transcript) {
      this.transcript = result.transcript
    }
  }

  /**
   * Get VAPI configuration
   */
  private async _getVAPIConfig(): Promise<VAPIConfig> {
    try {
      // Get from chrome.storage.local or environment
      const result = await chrome.storage.local.get(['vapi_api_key', 'vapi_model'])

      return {
        apiKey: result.vapi_api_key || process.env.VAPI_API_KEY || '',
        model: result.vapi_model || 'nova-2',
        language: 'en'
      }
    } catch (error) {
      Logging.log('VoiceRecordingService', `Failed to get VAPI config: ${error}`, 'warning')
      return {
        apiKey: '',
        model: 'nova-2',
        language: 'en'
      }
    }
  }

  /**
   * Finalize VAPI session
   */
  private async _finalizeVAPISession(): Promise<void> {
    if (!this.vapiSessionId) return

    try {
      const config = await this._getVAPIConfig()

      await fetch(`https://api.vapi.ai/session/${this.vapiSessionId}/finalize`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`
        }
      })

    } catch (error) {
      Logging.log('VoiceRecordingService', `Failed to finalize VAPI session: ${error}`, 'warning')
    }
  }

  /**
   * Reset internal state
   */
  private _resetState(): void {
    this.transcript = ''
    this.segments = []
    this.vapiSessionId = null
    this.startTime = 0
    this.isRecording = false
    this.audioChunks = []
  }

  /**
   * Debug permission state
   */
  async debugPermissions(): Promise<void> {
    console.log('=== MICROPHONE PERMISSION DEBUG ===')
    console.log('Navigator available:', !!navigator)
    console.log('MediaDevices available:', !!navigator.mediaDevices)
    console.log('getUserMedia available:', !!navigator.mediaDevices?.getUserMedia)
    console.log('Chrome available:', !!chrome)
    console.log('Chrome permissions available:', !!chrome.permissions)

    // Check Chrome extension permissions
    try {
      const hasAudioCapture = await new Promise<boolean>((resolve) => {
        chrome.permissions.contains({ permissions: ['audioCapture'] }, resolve)
      })
      console.log('Chrome audioCapture permission:', hasAudioCapture ? '✅ GRANTED' : '❌ DENIED')
    } catch (e) {
      console.log('Failed to check Chrome permissions:', e)
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const audioInputs = devices.filter(d => d.kind === 'audioinput')
      console.log('Audio input devices found:', audioInputs.length)
      console.log('Audio devices:', audioInputs.map(d => ({ label: d.label, deviceId: d.deviceId })))
    } catch (e) {
      console.log('Failed to enumerate devices:', e)
    }

    try {
      const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName })
      console.log('Browser microphone permission state:', permission.state)
      console.log('Permission object:', permission)
    } catch (e) {
      console.log('Failed to query browser permissions:', e)
    }

    console.log('Current URL:', window.location.href)
    console.log('=== END DEBUG ===')
  }

  /**
   * Request Chrome extension permissions
   */
  async requestChromePermissions(): Promise<boolean> {
    try {
      // Check if we already have the audioCapture permission
      const hasPermission = await new Promise<boolean>((resolve) => {
        chrome.permissions.contains({
          permissions: ['audioCapture']
        }, resolve)
      })

      if (hasPermission) {
        Logging.log('VoiceRecordingService', 'Chrome audioCapture permission already granted')
        return true
      }

      // Request the permission
      Logging.log('VoiceRecordingService', 'Requesting Chrome audioCapture permission...')
      const granted = await new Promise<boolean>((resolve) => {
        chrome.permissions.request({
          permissions: ['audioCapture']
        }, resolve)
      })

      if (granted) {
        Logging.log('VoiceRecordingService', 'Chrome audioCapture permission granted')
      } else {
        Logging.log('VoiceRecordingService', 'Chrome audioCapture permission denied', 'error')
      }

      return granted
    } catch (error) {
      Logging.log('VoiceRecordingService', `Failed to request Chrome permissions: ${error}`, 'error')
      return false
    }
  }

  /**
   * Check if microphone permission is available
   */
  async checkMicrophonePermission(): Promise<boolean> {
    try {
      // First check Chrome extension permissions
      const hasExtensionPermission = await new Promise<boolean>((resolve) => {
        chrome.permissions.contains({
          permissions: ['audioCapture']
        }, resolve)
      })

      if (!hasExtensionPermission) {
        Logging.log('VoiceRecordingService', 'Chrome audioCapture permission not granted', 'warning')
        return false
      }

      // In Chrome extensions, check if navigator.mediaDevices is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        Logging.log('VoiceRecordingService', 'Media devices not available in this context', 'error')
        return false
      }

      // Check browser-level permission
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName })
      Logging.log('VoiceRecordingService', `Browser microphone permission state: ${result.state}`)
      return result.state === 'granted'
    } catch (error) {
      Logging.log('VoiceRecordingService', `Failed to check microphone permission: ${error}`, 'warning')
      // Try to get media devices as fallback check
      try {
        const hasExtensionPermission = await new Promise<boolean>((resolve) => {
          chrome.permissions.contains({
            permissions: ['audioCapture']
          }, resolve)
        })
        if (!hasExtensionPermission) return false

        await navigator.mediaDevices.enumerateDevices()
        return true
      } catch {
        return false
      }
    }
  }

  /**
   * Request microphone permission
   */
  async requestMicrophonePermission(): Promise<boolean> {
    try {
      Logging.log('VoiceRecordingService', 'Requesting microphone access for permission check...')
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true
      })

      // Stop the stream immediately - this was just for permission
      stream.getTracks().forEach(track => {
        track.stop()
        Logging.log('VoiceRecordingService', 'Stopped permission check audio track')
      })

      Logging.log('VoiceRecordingService', 'Microphone permission granted')
      return true
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      Logging.log('VoiceRecordingService', `Microphone permission denied: ${errorMsg}`, 'error')

      // Check if it's a specific permission error
      if (errorMsg.includes('Permission denied') || errorMsg.includes('NotAllowedError')) {
        throw new Error('Microphone access was denied. Please allow microphone access in your browser settings.')
      }

      if (errorMsg.includes('Permission dismissed')) {
        throw new Error('Microphone permission was dismissed. Please click the microphone icon in your browser address bar and select "Allow" to enable voice recording.')
      }

      throw new Error(`Failed to access microphone: ${errorMsg}`)
    }
  }
}
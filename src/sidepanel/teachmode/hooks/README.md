# OpenAI Transcription Hook

## Overview
The `useOpenAITranscription` hook provides real-time audio transcription using OpenAI's `gpt-4o-mini-transcribe` model. It captures audio from the user's microphone and sends it to OpenAI's API for transcription.

## Features
- Real-time audio capture using WebAudio API
- Voice Activity Detection (VAD) for smart recording
- Chunked audio processing (every 3 seconds)
- Audio level visualization support
- Error handling for permissions and API failures
- Works in Chrome extension context (no Node.js dependencies)

## Usage

```typescript
import { useOpenAITranscription } from './hooks/useOpenAITranscription'

function MyComponent() {
  const { error, isSpeaking, audioLevel } = useOpenAITranscription({
    enabled: isRecordingActive
  })

  // The hook automatically adds transcripts to the store
  // Access transcripts via useTeachModeStore
}
```

## Configuration

### Environment Variable
The hook requires the `OPENAI_API_KEY` environment variable to be set in your `.env` file:

```
OPENAI_API_KEY=sk-your-api-key-here
```

This is injected at build time via webpack configuration.

### Audio Settings
- Sample Rate: 16kHz (optimal for speech)
- Channels: Mono
- Format: WebM with Opus codec
- Chunk Duration: 3 seconds
- Silence Detection: 2 seconds threshold

## API Endpoint
The hook uses OpenAI's audio transcription endpoint:
- Endpoint: `https://api.openai.com/v1/audio/transcriptions`
- Model: `gpt-4o-mini-transcribe`
- Response Format: Text

## Browser Compatibility
- Requires Chrome/Edge with MediaRecorder API support
- Works in Chrome extension context
- No Node.js dependencies (uses Fetch API)

## Error Handling
The hook handles various error scenarios:
- Missing API key
- Microphone permission denied
- No microphone found
- API request failures

## Technical Details
1. **Audio Capture**: Uses MediaRecorder API to capture audio chunks
2. **Processing**: Combines chunks into WebM blobs every 3 seconds
3. **Transcription**: Sends audio to OpenAI API for transcription
4. **State Management**: Updates transcripts in Zustand store

## Testing
Run tests with:
```bash
npm test -- src/sidepanel/teachmode/hooks/useOpenAITranscription.test.ts
```
import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import { PubSubChannel } from '@/lib/pubsub/PubSubChannel'
import { Logging } from '@/lib/utils/Logging'
import { LLMSettingsReader } from '@/lib/llm/settings/LLMSettingsReader'
import { BrowserOSProvider } from '@/lib/llm/settings/browserOSTypes'

// Input schema
const YouTubeToolInputSchema = z.object({
  action: z.enum(['summarize', 'ask', 'transcript'])
    .describe('Action to perform: summarize (get video summary), ask (answer question about video), transcript (get full transcript)'),
  question: z.string().optional()
    .describe('Question to ask about the video (required for "ask" action)'),
  videoUrl: z.string().url().optional()
    .describe('YouTube video URL (auto-detects from current tab if not provided)')
})

type YouTubeToolInput = z.infer<typeof YouTubeToolInputSchema>

export function YouTubeTool(context: ExecutionContext): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'youtube_tool',
    description: `Analyze YouTube videos using Gemini's native video understanding. Capabilities:

• summarize: Get key takeaways and main points from any video
• ask: Ask specific questions about video content (requires "question" parameter)
• transcript: Get full video transcript with timestamps

AUTO-DETECTION: If no videoUrl provided, analyzes the YouTube video in the current tab.

NOTE: Requires Gemini API key configured in settings.

EXAMPLES:
- "Summarize this YouTube video"
- "What does the video say about artificial intelligence?"
- "Get the full transcript of this video"`,

    schema: YouTubeToolInputSchema,

    func: async (args: YouTubeToolInput) => {
      try {
        context.incrementMetric('toolCalls')

        // Check if Gemini is available
        const geminiAvailable = await _isGeminiAvailable()
        if (!geminiAvailable) {
          return JSON.stringify({
            ok: false,
            error: 'YouTube video analysis requires Gemini API. Please configure a Gemini API key in settings to use this feature.'
          })
        }

        // Get video URL
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage('Analyzing YouTube video...', 'thinking')
        )

        let videoUrl = args.videoUrl
        if (!videoUrl) {
          const page = await context.browserContext.getCurrentPage()
          videoUrl = page.url()
        }

        // Validate YouTube URL
        const videoId = _extractVideoId(videoUrl)
        if (!videoId) {
          return JSON.stringify({
            ok: false,
            error: 'Not a valid YouTube video URL. Please navigate to a YouTube video or provide a video URL.'
          })
        }

        // Process with Gemini
        return await _processWithGemini(videoUrl, args, context)

      } catch (error) {
        context.incrementMetric('errors')
        Logging.log('YouTubeTool', `Error: ${error instanceof Error ? error.message : String(error)}`, 'error')
        return JSON.stringify({
          ok: false,
          error: `YouTube tool failed: ${error instanceof Error ? error.message : String(error)}`
        })
      }
    }
  })
}

// ============= Helper Functions =============

/**
 * Check if Gemini is available and configured
 */
async function _isGeminiAvailable(): Promise<boolean> {
  try {
    const config = await LLMSettingsReader.readAllProviders()
    const geminiProvider = config.providers.find((p: BrowserOSProvider) => p.type === 'google_gemini' && p.apiKey)
    return !!geminiProvider
  } catch (error) {
    return false
  }
}

/**
 * Process YouTube video using Gemini's native support via REST API
 */
async function _processWithGemini(
  videoUrl: string,
  args: YouTubeToolInput,
  context: ExecutionContext
): Promise<string> {
  try {
    // Get Gemini configuration
    const config = await LLMSettingsReader.readAllProviders()
    const geminiProvider = config.providers.find((p: BrowserOSProvider) => p.type === 'google_gemini' && p.apiKey)

    if (!geminiProvider || !geminiProvider.apiKey) {
      throw new Error('Gemini API key not found')
    }

    // Prepare the prompt based on action
    let promptText: string
    switch (args.action) {
      case 'summarize':
        promptText = `Please summarize this YouTube video in 3 sections:
1. **Main Topic**: What is this video about? (1-2 sentences)
2. **Key Takeaways**: The most important points (3-5 bullet points)
3. **Notable Insights**: Any particularly interesting or valuable information`
        break

      case 'ask':
        if (!args.question) {
          return JSON.stringify({
            ok: false,
            error: 'Question is required for "ask" action. Please provide a question parameter.'
          })
        }
        promptText = `Answer this question about the YouTube video: "${args.question}"

Provide a clear, direct answer based on the video content. If the answer includes specific quotes or references, include them.`
        break

      case 'transcript':
        promptText = `Extract and provide the full transcript of this YouTube video with timestamps if available.`
        break

      default:
        throw new Error('Invalid action')
    }

    context.getPubSub().publishMessage(
      PubSubChannel.createMessage('Processing with Gemini...', 'thinking')
    )

    // Use Gemini REST API directly with proper fileData format
    const modelId = geminiProvider.modelId || 'gemini-2.5-flash'
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`

    const requestBody = {
      contents: [{
        parts: [
          { text: promptText },
          { file_data: { file_uri: videoUrl } }
        ]
      }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2000
      }
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': geminiProvider.apiKey
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorText = await response.text()
      Logging.log('YouTubeTool', `Gemini API error: ${response.status}`, 'error')
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()

    // Extract the text from Gemini's response
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!responseText) {
      throw new Error('No text content in Gemini response')
    }

    return JSON.stringify({
      ok: true,
      output: args.action === 'transcript'
        ? { transcript: responseText }
        : args.action === 'ask'
        ? { answer: responseText }
        : { summary: responseText }
    })

  } catch (error) {
    Logging.log('YouTubeTool', `Gemini processing error: ${error}`, 'error')
    throw error
  }
}

/**
 * Extract video ID from various YouTube URL formats
 */
function _extractVideoId(url: string): string | null {
  try {
    // youtube.com/watch?v=VIDEO_ID
    const watchMatch = url.match(/[?&]v=([^&]+)/)
    if (watchMatch) return watchMatch[1]

    // youtu.be/VIDEO_ID
    const shortMatch = url.match(/youtu\.be\/([^?&]+)/)
    if (shortMatch) return shortMatch[1]

    // youtube.com/embed/VIDEO_ID
    const embedMatch = url.match(/youtube\.com\/embed\/([^?&]+)/)
    if (embedMatch) return embedMatch[1]

    // youtube.com/v/VIDEO_ID
    const vMatch = url.match(/youtube\.com\/v\/([^?&]+)/)
    if (vMatch) return vMatch[1]

    // youtube.com/shorts/VIDEO_ID
    const shortsMatch = url.match(/youtube\.com\/shorts\/([^?&]+)/)
    if (shortsMatch) return shortsMatch[1]

    return null
  } catch (error) {
    Logging.log('YouTubeTool', `Error extracting video ID: ${error}`, 'error')
    return null
  }
}

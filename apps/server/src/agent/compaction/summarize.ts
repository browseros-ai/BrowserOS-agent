import type { LanguageModel, ModelMessage } from 'ai'
import { streamText } from 'ai'
import { logger } from '../../lib/logger'
import {
  buildSummarizationPrompt,
  buildSummarizationSystemPrompt,
  buildTurnPrefixPrompt,
  messagesToTranscript,
} from './prompt'

async function collectStreamChunks(
  result: ReturnType<typeof streamText>,
): Promise<string> {
  const chunks: string[] = []
  for await (const chunk of result.textStream) {
    chunks.push(chunk)
  }
  return chunks.join('')
}

async function callSummarizer(
  model: LanguageModel,
  messages: ModelMessage[],
  userPrompt: string,
  timeoutMs: number,
  maxOutputTokens: number,
  logLabel: string,
): Promise<string | null> {
  const transcript = messagesToTranscript(messages)
  if (!transcript.trim()) return null

  const systemPrompt = buildSummarizationSystemPrompt()

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const result = streamText({
      model,
      system: systemPrompt,
      maxOutputTokens,
      messages: [
        {
          role: 'user',
          content: `<conversation_transcript>\n${transcript}\n</conversation_transcript>\n\n${userPrompt}`,
        },
      ],
      abortSignal: controller.signal,
    })

    const text = await collectStreamChunks(result)
    return text || null
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.warn(`${logLabel} failed`, { error: message })
    return null
  } finally {
    clearTimeout(timeout)
  }
}

export async function summarizeMessages(
  model: LanguageModel,
  messagesToSummarize: ModelMessage[],
  existingSummary: string | null,
  timeoutMs: number,
  maxOutputTokens: number,
): Promise<string | null> {
  return callSummarizer(
    model,
    messagesToSummarize,
    buildSummarizationPrompt(existingSummary),
    timeoutMs,
    maxOutputTokens,
    'Summarization',
  )
}

export async function summarizeTurnPrefix(
  model: LanguageModel,
  turnPrefixMessages: ModelMessage[],
  timeoutMs: number,
  maxOutputTokens: number,
): Promise<string | null> {
  return callSummarizer(
    model,
    turnPrefixMessages,
    buildTurnPrefixPrompt(),
    timeoutMs,
    maxOutputTokens,
    'Turn prefix summarization',
  )
}

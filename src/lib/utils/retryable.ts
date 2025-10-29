import { BaseMessage, AIMessage } from '@langchain/core/messages'
import { Logging } from "@/lib/utils/Logging";

const MAX_RETRIES = 3

/**
 * Invokes an LLM with retry logic, adding previous errors as context
 * @param llm - The LLM instance (can be structured or regular)
 * @param messages - The messages to send to the LLM
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @returns The LLM response
 */
export async function invokeWithRetry<T> (
  llm: any,
  messages: BaseMessage[],
  maxRetries: number = MAX_RETRIES,
  options?: { signal?: AbortSignal }
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const messagesToSend = [...messages]

    // Add previous error as context if this is a retry
    if (lastError) {
      messagesToSend.push(new AIMessage(
        `Previous attempt failed with error: ${lastError.message}\n` +
        'Please correct your response format if required, or try again.'
      ))
    }

    try {
      // Pass AbortSignal through when available so calls are cancellable
      if (options?.signal) {
        return await llm.invoke(messagesToSend, { signal: options.signal })
      }
      return await llm.invoke(messagesToSend)
    } catch (error) {
      lastError = error as Error
      Logging.log('invokeWithRetry', `Attempt ${attempt} failed: ${lastError.message}`)
      if (attempt === maxRetries) throw error
    }
  }

  throw lastError
}

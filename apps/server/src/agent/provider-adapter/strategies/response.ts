/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Response Conversion Strategy
 * Converts LLM responses from Vercel to Gemini format
 * Handles both streaming and non-streaming responses
 */

import {
  FinishReason,
  type FunctionCall,
  type GenerateContentResponse,
  type Part,
} from '@google/genai'
import { Sentry } from '../../../lib/sentry'

import type { ProviderAdapter } from '../adapters/base'
import type { ProviderMetadata } from '../adapters/types'
import type { VercelFinishReason, VercelUsage } from '../types'
import {
  VercelGenerateTextResultSchema,
  VercelStreamChunkSchema,
} from '../types'
import type { UIMessageStreamWriter } from '../ui-message-stream'

import type { ToolConversionStrategy } from './tool'

interface StreamAccumulator {
  textAccumulator: string
  toolCallsMap: Map<
    string,
    { toolCallId: string; toolName: string; input: unknown }
  >
  finishReason?: VercelFinishReason
}

export class ResponseConversionStrategy {
  constructor(
    private toolStrategy: ToolConversionStrategy,
    private adapter: ProviderAdapter,
  ) {}

  private async handleErrorChunk(
    rawChunk: { error?: { message?: string } | string },
    uiStream?: UIMessageStreamWriter,
  ): Promise<never> {
    const errorMessage =
      typeof rawChunk.error === 'object'
        ? rawChunk.error?.message
        : rawChunk.error || 'Unknown error from LLM provider'
    Sentry.captureException(new Error(errorMessage))
    if (uiStream) {
      await uiStream.writeError(errorMessage || 'Unknown error')
      await uiStream.finish('error')
    }
    throw new Error(`LLM Provider Error: ${errorMessage}`)
  }

  private async handleTextDeltaChunk(
    chunk: { text: string },
    accumulator: StreamAccumulator,
    uiStream?: UIMessageStreamWriter,
  ): Promise<GenerateContentResponse> {
    const delta = chunk.text
    accumulator.textAccumulator += delta

    if (uiStream) {
      await uiStream.writeTextDelta(delta)
    }

    return {
      candidates: [
        {
          content: { role: 'model', parts: [{ text: delta }] },
          index: 0,
        },
      ],
    } as GenerateContentResponse
  }

  private async handleToolCallChunk(
    chunk: { toolCallId: string; toolName: string; input?: unknown },
    accumulator: StreamAccumulator,
    uiStream?: UIMessageStreamWriter,
  ): Promise<void> {
    if (uiStream) {
      await uiStream.writeToolCall(
        chunk.toolCallId,
        chunk.toolName,
        chunk.input,
      )
    }
    accumulator.toolCallsMap.set(chunk.toolCallId, {
      toolCallId: chunk.toolCallId,
      toolName: chunk.toolName,
      input: chunk.input,
    })
  }

  private buildFinalStreamResponse(
    accumulator: StreamAccumulator,
    usage: VercelUsage | undefined,
    providerMetadata: ProviderMetadata | undefined,
  ): GenerateContentResponse | null {
    if (
      accumulator.toolCallsMap.size === 0 &&
      !accumulator.finishReason &&
      !usage
    ) {
      return null
    }

    const parts: Part[] = []
    let functionCalls: FunctionCall[] | undefined

    if (accumulator.toolCallsMap.size > 0) {
      const toolCallsArray = Array.from(accumulator.toolCallsMap.values())
      functionCalls = this.toolStrategy.vercelToGemini(toolCallsArray)

      let isFirst = true
      for (const fc of functionCalls) {
        const part: Part & { providerMetadata?: ProviderMetadata } = {
          functionCall: fc,
        }
        if (isFirst && providerMetadata) {
          part.providerMetadata = providerMetadata
          isFirst = false
        }
        parts.push(part)
      }
    }

    return {
      candidates: [
        {
          content: {
            role: 'model',
            parts: parts.length > 0 ? parts : [{ text: '' }],
          },
          finishReason: this.mapFinishReason(accumulator.finishReason),
          index: 0,
        },
      ],
      ...(functionCalls && functionCalls.length > 0 ? { functionCalls } : {}),
      usageMetadata: this.convertUsage(usage),
    } as GenerateContentResponse
  }

  /**
   * Convert Vercel generateText result to Gemini format
   *
   * @param result - Result from Vercel AI generateText()
   * @returns Gemini GenerateContentResponse
   */
  vercelToGemini(result: unknown): GenerateContentResponse {
    // Validate with Zod
    const parsed = VercelGenerateTextResultSchema.safeParse(result)

    if (!parsed.success) {
      // Return minimal valid response
      return this.createEmptyResponse()
    }

    const validated = parsed.data

    const parts: Part[] = []
    let functionCalls: FunctionCall[] | undefined

    // Add text content if present
    if (validated.text) {
      parts.push({ text: validated.text })
    }

    // Convert tool calls using ToolStrategy
    if (validated.toolCalls && validated.toolCalls.length > 0) {
      functionCalls = this.toolStrategy.vercelToGemini(validated.toolCalls)

      // Add to parts (dual representation for Gemini)
      for (const fc of functionCalls) {
        parts.push({ functionCall: fc })
      }
    }

    // Handle usage metadata
    const usageMetadata = this.convertUsage(validated.usage)

    // Create response - testing without Object.setPrototypeOf
    return {
      candidates: [
        {
          content: {
            role: 'model',
            parts,
          },
          finishReason: this.mapFinishReason(validated.finishReason),
          index: 0,
        },
      ],
      // CRITICAL: Top-level functionCalls for turn.ts compatibility
      ...(functionCalls && functionCalls.length > 0 ? { functionCalls } : {}),
      usageMetadata,
    } as GenerateContentResponse
  }

  /**
   * Convert Vercel stream to Gemini async generator
   */
  async *streamToGemini(
    stream: AsyncIterable<unknown>,
    getUsage: () => Promise<VercelUsage | undefined>,
    uiStream?: UIMessageStreamWriter,
  ): AsyncGenerator<GenerateContentResponse> {
    const accumulator: StreamAccumulator = {
      textAccumulator: '',
      toolCallsMap: new Map(),
      finishReason: undefined,
    }

    for await (const rawChunk of stream) {
      this.adapter.processStreamChunk(rawChunk)

      const chunkType = (rawChunk as { type?: string }).type
      if (chunkType === 'error') {
        await this.handleErrorChunk(
          rawChunk as { error?: { message?: string } | string },
          uiStream,
        )
      }

      const parsed = VercelStreamChunkSchema.safeParse(rawChunk)
      if (!parsed.success) continue

      const chunk = parsed.data

      if (chunk.type === 'text-delta') {
        yield await this.handleTextDeltaChunk(chunk, accumulator, uiStream)
      } else if (chunk.type === 'tool-call') {
        await this.handleToolCallChunk(chunk, accumulator, uiStream)
      } else if (chunk.type === 'finish') {
        accumulator.finishReason = chunk.finishReason
      }
    }

    let usage: VercelUsage | undefined
    try {
      usage = await getUsage()
    } catch {
      usage = this.estimateUsage(accumulator.textAccumulator)
    }

    const finalResponse = this.buildFinalStreamResponse(
      accumulator,
      usage,
      this.adapter.getResponseMetadata(),
    )
    if (finalResponse) yield finalResponse
  }

  /**
   * Convert usage metadata from AI SDK format to Gemini format
   * AI SDK uses inputTokens/outputTokens, Gemini uses promptTokenCount/candidatesTokenCount
   */
  private convertUsage(usage: VercelUsage | undefined):
    | {
        promptTokenCount: number
        candidatesTokenCount: number
        totalTokenCount: number
      }
    | undefined {
    if (!usage) {
      return undefined
    }

    return {
      promptTokenCount: usage.inputTokens ?? 0,
      candidatesTokenCount: usage.outputTokens ?? 0,
      totalTokenCount: usage.totalTokens ?? 0,
    }
  }

  /**
   * Estimate usage when not provided by model
   */
  private estimateUsage(text: string): VercelUsage {
    const estimatedTokens = Math.ceil(text.length / 4)
    return {
      inputTokens: 0,
      outputTokens: estimatedTokens,
      totalTokens: estimatedTokens,
    }
  }

  /**
   * Map Vercel finish reasons to Gemini finish reasons
   */
  private mapFinishReason(
    reason: VercelFinishReason | undefined,
  ): FinishReason {
    switch (reason) {
      case 'stop':
      case 'tool-calls':
        return FinishReason.STOP
      case 'length':
      case 'max-tokens':
        return FinishReason.MAX_TOKENS
      case 'content-filter':
        return FinishReason.SAFETY
      case 'error':
      case 'other':
      case 'unknown':
        return FinishReason.OTHER
      default:
        return FinishReason.STOP
    }
  }

  /**
   * Create empty response for error cases
   */
  private createEmptyResponse(): GenerateContentResponse {
    return {
      candidates: [
        {
          content: {
            role: 'model',
            parts: [{ text: '' }],
          },
          finishReason: FinishReason.OTHER,
          index: 0,
        },
      ],
    } as GenerateContentResponse
  }
}

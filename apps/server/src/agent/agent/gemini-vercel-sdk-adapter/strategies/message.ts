/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Message Conversion Strategy
 * Converts conversation history from Gemini to Vercel format
 */

import type {
  JSONValue,
  LanguageModelV2ToolResultOutput,
} from '@ai-sdk/provider'
import type { Content, ContentUnion } from '@google/genai'
import type { CoreMessage } from 'ai'

import type { ProviderAdapter } from '../adapters/base'
import type {
  FunctionCallWithMetadata,
  ProviderMetadata,
} from '../adapters/types'
import type { VercelContentPart } from '../types'
import {
  isFunctionCallPart,
  isFunctionResponsePart,
  isInlineDataPart,
  isTextPart,
} from '../utils/type-guards'

interface ExtractedParts {
  textParts: string[]
  functionCalls: FunctionCallWithMetadata[]
  functionResponses: Array<{
    id?: string
    name?: string
    response?: Record<string, unknown>
  }>
  imageParts: Array<{ mimeType: string; data: string }>
}

export class MessageConversionStrategy {
  constructor(private adapter: ProviderAdapter) {}

  private extractContentParts(content: Content): ExtractedParts {
    const textParts: string[] = []
    const functionCalls: FunctionCallWithMetadata[] = []
    const functionResponses: Array<{
      id?: string
      name?: string
      response?: Record<string, unknown>
    }> = []
    const imageParts: Array<{ mimeType: string; data: string }> = []

    for (const part of content.parts || []) {
      if (isTextPart(part)) {
        textParts.push(part.text)
      } else if (isFunctionCallPart(part)) {
        const partWithMetadata = part as typeof part & {
          providerMetadata?: ProviderMetadata
        }
        functionCalls.push({
          ...part.functionCall,
          providerMetadata: partWithMetadata.providerMetadata,
        })
      } else if (isFunctionResponsePart(part)) {
        functionResponses.push(part.functionResponse)
      } else if (isInlineDataPart(part)) {
        imageParts.push(part.inlineData)
      }
    }

    return { textParts, functionCalls, functionResponses, imageParts }
  }

  private processSimpleContent(
    role: 'user' | 'assistant',
    textContent: string,
    imageParts: Array<{ mimeType: string; data: string }>,
  ): CoreMessage | null {
    if (imageParts.length > 0) {
      const contentParts: VercelContentPart[] = []
      if (textContent) {
        contentParts.push({ type: 'text', text: textContent })
      }
      for (const img of imageParts) {
        contentParts.push({
          type: 'image',
          image: img.data,
          mediaType: img.mimeType,
        })
      }
      return { role, content: contentParts } as CoreMessage
    }
    if (textContent) {
      return { role, content: textContent }
    }
    return null
  }

  private processToolResults(
    responses: Array<{
      id?: string
      name?: string
      response?: Record<string, unknown>
    }>,
    imageParts: Array<{ mimeType: string; data: string }>,
    pairedToolResultIds: Set<string>,
    seenToolResultIds: Set<string>,
    idMapping: Map<string, string>,
    globalResultIndex: { value: number },
  ): CoreMessage[] {
    const messages: CoreMessage[] = []

    const uniqueResponses: Array<{
      id?: string
      name?: string
      response?: Record<string, unknown>
      lookupKey: string
    }> = []

    for (const fr of responses) {
      const originalId = fr.id || ''
      const lookupKey =
        originalId || `__empty_result_${globalResultIndex.value}`
      globalResultIndex.value++

      const synchronizedId = idMapping.get(lookupKey) || originalId
      if (synchronizedId && seenToolResultIds.has(synchronizedId)) continue
      if (!pairedToolResultIds.has(lookupKey)) continue
      if (synchronizedId) seenToolResultIds.add(synchronizedId)
      uniqueResponses.push({ ...fr, lookupKey })
    }

    if (uniqueResponses.length === 0) return messages

    const toolResultParts = this.convertFunctionResponsesToToolResults(
      uniqueResponses,
      idMapping,
    )
    messages.push({
      role: 'tool',
      content: toolResultParts,
    } as unknown as CoreMessage)

    if (imageParts.length > 0) {
      const userContentParts: VercelContentPart[] = [
        {
          type: 'text',
          text: 'Here are the screenshots from the tool execution:',
        },
      ]
      for (const img of imageParts) {
        userContentParts.push({
          type: 'image',
          image: img.data,
          mediaType: img.mimeType,
        })
      }
      messages.push({ role: 'user', content: userContentParts } as CoreMessage)
    }

    return messages
  }

  private processAssistantToolCalls(
    textContent: string,
    functionCalls: FunctionCallWithMetadata[],
    pairedToolCallIds: Set<string>,
    idMapping: Map<string, string>,
    globalCallIndex: { value: number },
  ): CoreMessage | null {
    const contentParts: VercelContentPart[] = []

    if (textContent) {
      contentParts.push({ type: 'text' as const, text: textContent })
    }

    let isFirst = true
    for (const fc of functionCalls) {
      const originalId = fc.id || ''
      const lookupKey = originalId || `__empty_call_${globalCallIndex.value}`
      globalCallIndex.value++

      if (!pairedToolCallIds.has(lookupKey)) continue

      const toolCallId =
        idMapping.get(lookupKey) || originalId || this.generateToolCallId()
      const toolCallPart: Record<string, unknown> = {
        type: 'tool-call' as const,
        toolCallId,
        toolName: fc.name || 'unknown',
        input: fc.args || {},
      }

      if (isFirst) {
        const providerOptions = this.adapter.getToolCallProviderOptions(fc)
        if (providerOptions) toolCallPart.providerOptions = providerOptions
        isFirst = false
      }

      contentParts.push(toolCallPart as unknown as VercelContentPart)
    }

    if (contentParts.length === 0) return null
    return { role: 'assistant' as const, content: contentParts } as CoreMessage
  }

  /**
   * Convert Gemini conversation history to Vercel messages
   *
   * @param contents - Array of Gemini Content objects
   * @returns Array of Vercel CoreMessage objects
   */
  geminiToVercel(contents: readonly Content[]): CoreMessage[] {
    const messages: CoreMessage[] = []
    const seenToolResultIds = new Set<string>()
    const { pairedToolCallIds, pairedToolResultIds, idMapping } =
      this.buildToolPairs(contents)

    const globalCallIndex = { value: 0 }
    const globalResultIndex = { value: 0 }

    for (const content of contents) {
      const role = content.role === 'model' ? 'assistant' : 'user'
      const { textParts, functionCalls, functionResponses, imageParts } =
        this.extractContentParts(content)
      const textContent = textParts.join('\n')

      // CASE 1: Simple text message (possibly with images)
      if (functionCalls.length === 0 && functionResponses.length === 0) {
        const msg = this.processSimpleContent(
          role as 'user' | 'assistant',
          textContent,
          imageParts,
        )
        if (msg) messages.push(msg)
        continue
      }

      // CASE 2: Tool results (user providing tool execution results)
      if (functionResponses.length > 0) {
        const toolMessages = this.processToolResults(
          functionResponses,
          imageParts,
          pairedToolResultIds,
          seenToolResultIds,
          idMapping,
          globalResultIndex,
        )
        messages.push(...toolMessages)
        continue
      }

      // CASE 3: Assistant with tool calls
      if (role === 'assistant' && functionCalls.length > 0) {
        const msg = this.processAssistantToolCalls(
          textContent,
          functionCalls,
          pairedToolCallIds,
          idMapping,
          globalCallIndex,
        )
        if (msg) messages.push(msg)
      }
    }

    const merged = this.mergeConsecutiveToolMessages(messages)
    return this.validateToolAdjacency(merged)
  }

  /**
   * Convert system instruction to plain text
   *
   * @param instruction - Gemini system instruction (string, Content, or Part)
   * @returns Plain text string or undefined
   */
  convertSystemInstruction(
    instruction: ContentUnion | undefined,
  ): string | undefined {
    if (!instruction) {
      return undefined
    }

    // Handle string input
    if (typeof instruction === 'string') {
      return instruction
    }

    // Handle Content object with parts
    if (typeof instruction === 'object' && 'parts' in instruction) {
      const textParts = (instruction.parts || [])
        .filter(isTextPart)
        .map((p) => p.text)

      return textParts.length > 0 ? textParts.join('\n') : undefined
    }

    return undefined
  }

  /**
   * Convert function responses to tool result parts for AI SDK v5
   * Uses idMapping to ensure tool_result IDs match corresponding tool_call IDs
   */
  private convertFunctionResponsesToToolResults(
    responses: Array<{
      id?: string
      name?: string
      response?: Record<string, unknown>
      lookupKey: string
    }>,
    idMapping: Map<string, string>,
  ): VercelContentPart[] {
    return responses.map((fr) => {
      // Convert Gemini response to AI SDK v5 structured output format
      let output: LanguageModelV2ToolResultOutput
      const response = fr.response || {}

      // Check for error first
      if (
        typeof response === 'object' &&
        'error' in response &&
        response.error
      ) {
        const errorValue = response.error
        output =
          typeof errorValue === 'string'
            ? { type: 'error-text', value: errorValue }
            : { type: 'error-json', value: errorValue as JSONValue }
      } else if (typeof response === 'object' && 'output' in response) {
        // Gemini's explicit output format: {output: value}
        const outputValue = response.output
        output =
          typeof outputValue === 'string'
            ? { type: 'text', value: outputValue }
            : { type: 'json', value: outputValue as JSONValue }
      } else {
        // Whole response is the output
        output =
          typeof response === 'string'
            ? { type: 'text', value: response }
            : { type: 'json', value: response as JSONValue }
      }

      // Use synchronized ID from pairing - this ensures tool_result matches tool_call
      const synchronizedId =
        idMapping.get(fr.lookupKey) || fr.id || this.generateToolCallId()

      return {
        type: 'tool-result' as const,
        toolCallId: synchronizedId,
        toolName: fr.name || 'unknown',
        output: output,
      }
    })
  }

  /**
   * Generate unique tool call ID
   */
  private generateToolCallId(): string {
    return `call_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
  }

  private collectToolCallsAndResults(contents: readonly Content[]): {
    toolCalls: Array<{
      id: string
      name: string
      index: number
      contentIndex: number
    }>
    toolResults: Array<{
      id: string
      name: string
      index: number
      contentIndex: number
    }>
  } {
    const toolCalls: Array<{
      id: string
      name: string
      index: number
      contentIndex: number
    }> = []
    const toolResults: Array<{
      id: string
      name: string
      index: number
      contentIndex: number
    }> = []

    let globalCallIndex = 0
    let globalResultIndex = 0

    for (let contentIndex = 0; contentIndex < contents.length; contentIndex++) {
      const content = contents[contentIndex]
      for (const part of content.parts || []) {
        if (isFunctionCallPart(part)) {
          toolCalls.push({
            id: part.functionCall?.id || '',
            name: part.functionCall?.name || '',
            index: globalCallIndex++,
            contentIndex,
          })
        }
        if (isFunctionResponsePart(part)) {
          toolResults.push({
            id: part.functionResponse?.id || '',
            name: part.functionResponse?.name || '',
            index: globalResultIndex++,
            contentIndex,
          })
        }
      }
    }

    return { toolCalls, toolResults }
  }

  private matchByExactId(
    toolCalls: Array<{
      id: string
      name: string
      index: number
      contentIndex: number
    }>,
    toolResults: Array<{
      id: string
      name: string
      index: number
      contentIndex: number
    }>,
    state: {
      pairedToolCallIds: Set<string>
      pairedToolResultIds: Set<string>
      idMapping: Map<string, string>
      usedResultIndices: Set<number>
    },
  ): void {
    for (const call of toolCalls) {
      if (!call.id) continue
      const matchingResult = toolResults.find(
        (r) => r.id === call.id && !state.usedResultIndices.has(r.index),
      )
      if (matchingResult) {
        state.pairedToolCallIds.add(call.id)
        state.pairedToolResultIds.add(matchingResult.id)
        state.usedResultIndices.add(matchingResult.index)
        state.idMapping.set(call.id, call.id)
        state.idMapping.set(matchingResult.id, call.id)
      }
    }
  }

  private matchByName(
    toolCalls: Array<{
      id: string
      name: string
      index: number
      contentIndex: number
    }>,
    toolResults: Array<{
      id: string
      name: string
      index: number
      contentIndex: number
    }>,
    state: {
      pairedToolCallIds: Set<string>
      pairedToolResultIds: Set<string>
      idMapping: Map<string, string>
      usedResultIndices: Set<number>
    },
  ): void {
    for (const call of toolCalls) {
      if (call.id && state.pairedToolCallIds.has(call.id)) continue

      const matchingResult = toolResults.find(
        (r) =>
          r.name === call.name &&
          !state.usedResultIndices.has(r.index) &&
          r.contentIndex > call.contentIndex,
      )

      if (matchingResult) {
        const syncId = call.id || matchingResult.id || this.generateToolCallId()

        if (call.id) {
          state.pairedToolCallIds.add(call.id)
          state.idMapping.set(call.id, syncId)
        }
        if (matchingResult.id) {
          state.pairedToolResultIds.add(matchingResult.id)
          state.idMapping.set(matchingResult.id, syncId)
        }
        if (!call.id) {
          const emptyCallKey = `__empty_call_${call.index}`
          state.pairedToolCallIds.add(emptyCallKey)
          state.idMapping.set(emptyCallKey, syncId)
        }
        if (!matchingResult.id) {
          const emptyResultKey = `__empty_result_${matchingResult.index}`
          state.pairedToolResultIds.add(emptyResultKey)
          state.idMapping.set(emptyResultKey, syncId)
        }

        state.usedResultIndices.add(matchingResult.index)
      }
    }
  }

  /**
   * Build tool call/result pairs with synchronized IDs
   */
  private buildToolPairs(contents: readonly Content[]): {
    pairedToolCallIds: Set<string>
    pairedToolResultIds: Set<string>
    idMapping: Map<string, string>
  } {
    const { toolCalls, toolResults } = this.collectToolCallsAndResults(contents)

    const state = {
      pairedToolCallIds: new Set<string>(),
      pairedToolResultIds: new Set<string>(),
      idMapping: new Map<string, string>(),
      usedResultIndices: new Set<number>(),
    }

    this.matchByExactId(toolCalls, toolResults, state)
    this.matchByName(toolCalls, toolResults, state)

    return {
      pairedToolCallIds: state.pairedToolCallIds,
      pairedToolResultIds: state.pairedToolResultIds,
      idMapping: state.idMapping,
    }
  }

  /**
   * Merge consecutive tool messages into a single tool message
   *
   * The API requires that ALL tool_results must be in a single message immediately
   * following the assistant message with tool_uses. If tool_results are split across
   * multiple consecutive tool messages, the API returns:
   * "unexpected tool_use_id found in tool_result blocks"
   *
   * This method merges consecutive tool messages so all tool_results are grouped together.
   */
  private mergeConsecutiveToolMessages(messages: CoreMessage[]): CoreMessage[] {
    if (messages.length === 0) {
      return messages
    }

    const merged: CoreMessage[] = []
    let currentToolParts: VercelContentPart[] | null = null

    for (const msg of messages) {
      if (msg.role === 'tool') {
        // Accumulate tool message content
        const content = msg.content as VercelContentPart[]
        if (currentToolParts === null) {
          // Start a new tool message accumulator
          currentToolParts = [...content]
        } else {
          // Merge into existing accumulator
          currentToolParts.push(...content)
        }
      } else {
        // Non-tool message - flush any accumulated tool parts first
        if (currentToolParts !== null) {
          merged.push({
            role: 'tool',
            content: currentToolParts,
          } as unknown as CoreMessage)
          currentToolParts = null
        }
        merged.push(msg)
      }
    }

    // Flush any remaining tool parts
    if (currentToolParts !== null) {
      merged.push({
        role: 'tool',
        content: currentToolParts,
      } as unknown as CoreMessage)
    }

    return merged
  }

  private extractToolCallIdsFromMessage(
    msg: CoreMessage | undefined,
  ): Set<string> {
    const ids = new Set<string>()
    if (!msg || !Array.isArray(msg.content)) return ids

    for (const part of msg.content as VercelContentPart[]) {
      if ((part as { type?: string }).type === 'tool-call') {
        const id = (part as { toolCallId?: string }).toolCallId
        if (id) ids.add(id)
      }
    }
    return ids
  }

  private extractToolResultIdsFromMessage(
    msg: CoreMessage | undefined,
  ): Set<string> {
    const ids = new Set<string>()
    if (!msg || msg.role !== 'tool' || !Array.isArray(msg.content)) return ids

    for (const part of msg.content as VercelContentPart[]) {
      if ((part as { type?: string }).type === 'tool-result') {
        const id = (part as { toolCallId?: string }).toolCallId
        if (id) ids.add(id)
      }
    }
    return ids
  }

  private processAssistantWithToolCalls(
    content: VercelContentPart[],
    nextToolResultIds: Set<string>,
  ): CoreMessage | null {
    const toolCallParts = content.filter(
      (p) =>
        typeof p === 'object' &&
        p !== null &&
        (p as { type?: string }).type === 'tool-call',
    )

    if (toolCallParts.length === 0)
      return { role: 'assistant', content } as CoreMessage

    const validToolCalls = toolCallParts.filter((p) => {
      const id = (p as { toolCallId?: string }).toolCallId
      return id && nextToolResultIds.has(id)
    })

    const nonToolCallParts = content.filter(
      (p) =>
        typeof p === 'object' &&
        p !== null &&
        (p as { type?: string }).type !== 'tool-call',
    )

    const newContent = [...nonToolCallParts, ...validToolCalls]
    if (newContent.length === 0) return null

    return { role: 'assistant', content: newContent } as CoreMessage
  }

  private processToolMessageAdjacency(
    content: VercelContentPart[],
    prevToolUseIds: Set<string>,
  ): CoreMessage | null {
    const validToolResults = content.filter((part) => {
      if ((part as { type?: string }).type !== 'tool-result') return true
      const id = (part as { toolCallId?: string }).toolCallId
      return id && prevToolUseIds.has(id)
    })

    if (validToolResults.length === 0) return null
    return { role: 'tool', content: validToolResults } as unknown as CoreMessage
  }

  /**
   * Validate tool_use/tool_result adjacency and remove non-adjacent pairs
   */
  private validateToolAdjacency(messages: CoreMessage[]): CoreMessage[] {
    if (messages.length === 0) return messages

    const result: CoreMessage[] = []

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]
      const nextMsg = messages[i + 1]
      const prevMsg = result.length > 0 ? result[result.length - 1] : undefined

      if (msg.role === 'assistant' && Array.isArray(msg.content)) {
        const nextToolResultIds = this.extractToolResultIdsFromMessage(nextMsg)
        const processed = this.processAssistantWithToolCalls(
          msg.content as VercelContentPart[],
          nextToolResultIds,
        )
        if (processed) result.push(processed)
      } else if (msg.role === 'tool') {
        const prevToolUseIds =
          prevMsg?.role === 'assistant'
            ? this.extractToolCallIdsFromMessage(prevMsg)
            : new Set<string>()
        const processed = this.processToolMessageAdjacency(
          msg.content as VercelContentPart[],
          prevToolUseIds,
        )
        if (processed) result.push(processed)
      } else {
        result.push(msg)
      }
    }

    return result
  }
}

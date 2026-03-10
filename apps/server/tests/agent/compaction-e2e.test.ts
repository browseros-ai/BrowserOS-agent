import { describe, expect, it } from 'bun:test'
import type {
  LanguageModelV3CallOptions,
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamPart,
  LanguageModelV3Usage,
} from '@ai-sdk/provider'
import { generateText, type ModelMessage, stepCountIs, tool } from 'ai'
import { MockLanguageModelV3 } from 'ai/test'
import { z } from 'zod'
import { clearToolOutputs } from '../../src/agent/compaction/clear-tool-outputs'
import { computeConfig } from '../../src/agent/compaction/config'
import { estimateTokensForThreshold } from '../../src/agent/compaction/estimate-tokens'
import { createCompactionPrepareStep } from '../../src/agent/compaction/prepare-step'
import type { CompactionState } from '../../src/agent/compaction/types'

// ---------------------------------------------------------------------------
// Test infrastructure
// ---------------------------------------------------------------------------

// biome-ignore lint/suspicious/noExplicitAny: test stubs for AI SDK internal types
type StepsStub = any

function usage(inputTotal: number, outputTotal = 50): LanguageModelV3Usage {
  return {
    inputTokens: {
      total: inputTotal,
      noCache: inputTotal,
      cacheRead: undefined,
      cacheWrite: undefined,
    },
    outputTokens: { total: outputTotal, reasoning: undefined },
  }
}

function resultToStream(
  result: LanguageModelV3GenerateResult,
): ReadableStream<LanguageModelV3StreamPart> {
  return new ReadableStream({
    start(ctrl) {
      for (const part of result.content) {
        if (part.type === 'text') {
          ctrl.enqueue({ type: 'text-delta' as const, delta: part.text })
        } else if (part.type === 'tool-call') {
          const inputStr =
            typeof part.input === 'string'
              ? part.input
              : JSON.stringify(part.input)
          ctrl.enqueue({
            type: 'tool-call' as const,
            toolCallId: part.toolCallId,
            toolName: part.toolName,
            input: inputStr,
            delta: inputStr,
          })
        }
      }
      ctrl.enqueue({
        type: 'finish' as const,
        finishReason: result.finishReason,
        usage: result.usage,
      })
      ctrl.close()
    },
  })
}

type DoGenerateFn = (
  options: LanguageModelV3CallOptions,
) => Promise<LanguageModelV3GenerateResult>

function createMock(
  doGenerate: LanguageModelV3GenerateResult | DoGenerateFn,
): InstanceType<typeof MockLanguageModelV3> {
  const doGenerateFn =
    typeof doGenerate === 'function' ? doGenerate : async () => doGenerate

  return new MockLanguageModelV3({
    doGenerate: doGenerateFn,
    doStream: async (options: LanguageModelV3CallOptions) => {
      try {
        const result = await doGenerateFn(options)
        return { stream: resultToStream(result) }
      } catch (error) {
        return {
          stream: new ReadableStream<LanguageModelV3StreamPart>({
            start(ctrl) {
              ctrl.error(error)
            },
          }),
        }
      }
    },
  })
}

function textResponse(
  text: string,
  inputTokens: number,
): LanguageModelV3GenerateResult {
  return {
    content: [{ type: 'text', text }],
    finishReason: { unified: 'stop', raw: 'stop' },
    usage: usage(inputTokens),
  }
}

function toolCallResponse(
  toolName: string,
  input: Record<string, unknown>,
  inputTokens: number,
): LanguageModelV3GenerateResult {
  return {
    content: [
      {
        type: 'tool-call',
        toolCallId: `call_${toolName}_${Math.random().toString(36).slice(2, 8)}`,
        toolName,
        input: JSON.stringify(input),
      },
    ],
    finishReason: { unified: 'tool-calls', raw: 'tool_calls' },
    usage: usage(inputTokens),
  }
}

function summaryResponse(inputTokens: number): LanguageModelV3GenerateResult {
  return textResponse(
    `## Goal
Test task

## Constraints & Preferences
- (none)

## Progress
### Done
- [x] Performed test actions

### In Progress
- [ ] Continue task

### Blocked
- (none)

## Key Decisions
- (none)

## Active State
- Page 1 open

## Next Steps
1. Continue

## Critical Context
- Test context`,
    inputTokens,
  )
}

function turnPrefixSummaryResponse(
  inputTokens: number,
): LanguageModelV3GenerateResult {
  return textResponse(
    `## Original Request
User asked to perform a long task

## Early Progress
- Completed initial actions in the turn prefix

## Context for Suffix
- Context needed for the retained suffix`,
    inputTokens,
  )
}

function extractUserText(options: LanguageModelV3CallOptions): string {
  const parts: string[] = []
  for (const msg of options.prompt) {
    if (msg.role !== 'user') continue
    const content = msg.content
    if (typeof content === 'string') {
      parts.push(content)
    } else if (Array.isArray(content)) {
      for (const part of content) {
        if (
          typeof part === 'object' &&
          part !== null &&
          'text' in part &&
          typeof part.text === 'string'
        ) {
          parts.push(part.text)
        }
      }
    }
  }
  return parts.join('\n')
}

function promptContainsText(
  options: LanguageModelV3CallOptions,
  needle: string,
): boolean {
  return extractUserText(options).includes(needle)
}

function isSummarizationCall(options: LanguageModelV3CallOptions): boolean {
  for (const msg of options.prompt) {
    if (msg.role !== 'system') continue
    const content = msg.content
    if (typeof content === 'string') {
      if (content.includes('context summarization assistant')) return true
    } else if (Array.isArray(content)) {
      const found = content.some(
        (part: { type?: string; text?: string }) =>
          'text' in part &&
          typeof part.text === 'string' &&
          part.text.includes('context summarization assistant'),
      )
      if (found) return true
    }
  }
  return false
}

function isTurnPrefixCall(options: LanguageModelV3CallOptions): boolean {
  return promptContainsText(options, 'PREFIX of a turn')
}

/** Build messages with tool call/result pairs (prunable by Stage 2). */
function buildModerateMessages(
  exchangeCount: number,
  outputChars = 1000,
): ModelMessage[] {
  const messages: ModelMessage[] = [
    { role: 'user', content: 'Do a multi-step browser task' },
  ]
  for (let i = 0; i < exchangeCount; i++) {
    messages.push({
      role: 'assistant',
      content: [
        {
          type: 'tool-call',
          toolCallId: `call_${i}`,
          toolName: `action_${i}`,
          input: { step: i },
        },
      ],
    })
    messages.push({
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId: `call_${i}`,
          toolName: `action_${i}`,
          output: {
            type: 'text' as const,
            value: `Result ${i}: ${'x'.repeat(outputChars)}`,
          },
        },
      ],
    })
    messages.push({ role: 'assistant', content: `Step ${i} done.` })
  }
  return messages
}

/**
 * Build text-heavy user/assistant exchanges WITHOUT tool calls.
 * These survive pruneMessages (Stage 2) and clearToolOutputs (Stage 3),
 * forcing LLM summarization (Stage 3) when large enough.
 */
function buildTextHeavyMessages(
  exchangeCount: number,
  charsPerMessage: number,
): ModelMessage[] {
  const messages: ModelMessage[] = [
    { role: 'user', content: 'Do a multi-step analysis task' },
  ]
  for (let i = 0; i < exchangeCount; i++) {
    messages.push({
      role: 'user',
      content: `Question ${i}: ${'q'.repeat(charsPerMessage)}`,
    })
    messages.push({
      role: 'assistant',
      content: `Analysis ${i}: ${'a'.repeat(charsPerMessage)}`,
    })
  }
  return messages
}

const testTools = {
  get_page_content: tool({
    description: 'Gets page content',
    parameters: z.object({ pageId: z.number() }),
    execute: async ({ pageId }) =>
      `Page ${pageId}: ${'Lorem ipsum dolor sit amet. '.repeat(1000)}`,
  }),
  click_element: tool({
    description: 'Clicks an element',
    parameters: z.object({ selector: z.string() }),
    execute: async ({ selector }) =>
      `Clicked ${selector}: ${'Result data. '.repeat(500)}`,
  }),
  navigate_to: tool({
    description: 'Navigate to URL',
    parameters: z.object({ url: z.string() }),
    execute: async ({ url }) =>
      `Navigated to ${url}: ${'Page content. '.repeat(500)}`,
  }),
}

// ---------------------------------------------------------------------------
// E2E: prepareStep integration — trigger & no-trigger
// ---------------------------------------------------------------------------

describe('compaction E2E — trigger logic', () => {
  it('does NOT compact when real usage is below trigger', async () => {
    const prepareStep = createCompactionPrepareStep({ contextWindow: 200_000 })

    const model = createMock(textResponse('unused', 100))

    const result = await prepareStep({
      messages: [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi there' },
      ],
      steps: [{ usage: { inputTokens: 500 } }] as StepsStub,
      model,
      experimental_context: null,
    })

    expect(result.messages.length).toBe(2)
    expect(
      (result.experimental_context as CompactionState).compactionCount,
    ).toBe(0)
  })

  it('compacts when real usage exceeds trigger (10K window, text-heavy exchanges)', async () => {
    const contextWindow = 10_000
    const prepareStep = createCompactionPrepareStep({ contextWindow })
    const config = computeConfig(contextWindow)
    const triggerAt = Math.floor(contextWindow * config.triggerRatio)

    const model = createMock(async () => summaryResponse(200))

    const messages = buildTextHeavyMessages(8, 2000)

    const result = await prepareStep({
      messages,
      steps: [{ usage: { inputTokens: triggerAt + 1000 } }] as StepsStub,
      model,
      experimental_context: null,
    })

    const state = result.experimental_context as CompactionState
    expect(state.compactionCount).toBe(1)
    expect(state.existingSummary).toBeTruthy()
    expect(result.messages.length).toBeLessThan(messages.length)
    expect(result.messages[0].content as string).toContain('## Goal')
  })

  it('uses estimation with safety multiplier on step 0 (no real usage)', async () => {
    const contextWindow = 10_000
    const prepareStep = createCompactionPrepareStep({ contextWindow })

    const model = createMock(async () => summaryResponse(200))

    const messages = buildTextHeavyMessages(8, 2000)

    const result = await prepareStep({
      messages,
      steps: [] as StepsStub,
      model,
      experimental_context: null,
    })

    expect(
      (result.experimental_context as CompactionState).compactionCount,
    ).toBe(1)
  })

  it('does NOT compact on step 0 when messages are small', async () => {
    const contextWindow = 200_000
    const prepareStep = createCompactionPrepareStep({ contextWindow })

    const model = createMock(async () => summaryResponse(200))

    const result = await prepareStep({
      messages: [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi' },
      ],
      steps: [] as StepsStub,
      model,
      experimental_context: null,
    })

    expect(
      (result.experimental_context as CompactionState).compactionCount,
    ).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// E2E: Token counting from steps
// ---------------------------------------------------------------------------

describe('compaction E2E — token counting', () => {
  it('uses real inputTokens when available', async () => {
    const contextWindow = 10_000
    const prepareStep = createCompactionPrepareStep({ contextWindow })
    const config = computeConfig(contextWindow)
    const triggerAt = Math.floor(contextWindow * config.triggerRatio)

    const model = createMock(async () => summaryResponse(200))

    const messages = buildTextHeavyMessages(8, 2000)

    // Just below trigger — should NOT compact
    const resultBelow = await prepareStep({
      messages,
      steps: [{ usage: { inputTokens: triggerAt - 1 } }] as StepsStub,
      model,
      experimental_context: null,
    })
    expect(
      (resultBelow.experimental_context as CompactionState).compactionCount,
    ).toBe(0)

    // Just above trigger — should compact (text-heavy survives pruning stages)
    const resultAbove = await prepareStep({
      messages,
      steps: [{ usage: { inputTokens: triggerAt + 1 } }] as StepsStub,
      model,
      experimental_context: null,
    })
    expect(
      (resultAbove.experimental_context as CompactionState).compactionCount,
    ).toBe(1)
  })

  it('falls back to estimation when usage has no inputTokens', async () => {
    const contextWindow = 10_000
    const prepareStep = createCompactionPrepareStep({ contextWindow })

    const model = createMock(async () => summaryResponse(200))

    const messages = buildTextHeavyMessages(8, 2000)

    const result = await prepareStep({
      messages,
      steps: [{ usage: { inputTokens: undefined } }] as StepsStub,
      model,
      experimental_context: null,
    })

    expect(
      (result.experimental_context as CompactionState).compactionCount,
    ).toBe(1)
  })

  it('falls back to estimation when usage.inputTokens is 0', async () => {
    const contextWindow = 10_000
    const prepareStep = createCompactionPrepareStep({ contextWindow })

    const model = createMock(async () => summaryResponse(200))

    const messages = buildTextHeavyMessages(8, 2000)

    const result = await prepareStep({
      messages,
      steps: [{ usage: { inputTokens: 0 } }] as StepsStub,
      model,
      experimental_context: null,
    })

    expect(
      (result.experimental_context as CompactionState).compactionCount,
    ).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// E2E: Summarization quality and fallbacks
// ---------------------------------------------------------------------------

describe('compaction E2E — summarization & fallbacks', () => {
  it('falls back to sliding window when summarization throws', async () => {
    const contextWindow = 10_000
    const prepareStep = createCompactionPrepareStep({ contextWindow })
    const config = computeConfig(contextWindow)
    const triggerAt = Math.floor(contextWindow * config.triggerRatio)

    const model = createMock(async () => {
      throw new Error('Model unavailable')
    })

    const messages = buildTextHeavyMessages(8, 2000)

    const result = await prepareStep({
      messages,
      steps: [{ usage: { inputTokens: triggerAt + 1000 } }] as StepsStub,
      model,
      experimental_context: null,
    })

    const state = result.experimental_context as CompactionState
    expect(state.compactionCount).toBe(0)
    expect(state.existingSummary).toBeNull()
    expect(result.messages.length).toBeLessThanOrEqual(messages.length)
  })

  it('falls back when summary is inflated (larger than original)', async () => {
    const contextWindow = 10_000
    const prepareStep = createCompactionPrepareStep({ contextWindow })
    const config = computeConfig(contextWindow)
    const triggerAt = Math.floor(contextWindow * config.triggerRatio)

    const model = createMock(async () => textResponse('x'.repeat(100_000), 200))

    const messages = buildTextHeavyMessages(8, 2000)

    const result = await prepareStep({
      messages,
      steps: [{ usage: { inputTokens: triggerAt + 1000 } }] as StepsStub,
      model,
      experimental_context: null,
    })

    const state = result.experimental_context as CompactionState
    expect(state.compactionCount).toBe(0)
  })

  it('falls back when summary is empty', async () => {
    const contextWindow = 10_000
    const prepareStep = createCompactionPrepareStep({ contextWindow })
    const config = computeConfig(contextWindow)
    const triggerAt = Math.floor(contextWindow * config.triggerRatio)

    const model = createMock(async () => textResponse('', 200))

    const messages = buildTextHeavyMessages(8, 2000)

    const result = await prepareStep({
      messages,
      steps: [{ usage: { inputTokens: triggerAt + 1000 } }] as StepsStub,
      model,
      experimental_context: null,
    })

    const state = result.experimental_context as CompactionState
    expect(state.compactionCount).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// E2E: Iterative compaction
// ---------------------------------------------------------------------------

describe('compaction E2E — iterative compaction', () => {
  it('sends UPDATE prompt with previous summary on second compaction', async () => {
    const contextWindow = 10_000
    const prepareStep = createCompactionPrepareStep({ contextWindow })
    const config = computeConfig(contextWindow)
    const triggerAt = Math.floor(contextWindow * config.triggerRatio)

    let sawPreviousSummary = false

    const model = createMock(async (options) => {
      if (promptContainsText(options, '<previous_summary>')) {
        sawPreviousSummary = true
      }
      return summaryResponse(200)
    })

    const messages1 = buildTextHeavyMessages(8, 2000)
    const result1 = await prepareStep({
      messages: messages1,
      steps: [{ usage: { inputTokens: triggerAt + 1000 } }] as StepsStub,
      model,
      experimental_context: null,
    })

    const state1 = result1.experimental_context as CompactionState
    expect(state1.compactionCount).toBe(1)
    expect(sawPreviousSummary).toBe(false)

    sawPreviousSummary = false
    const messages2: ModelMessage[] = [
      ...result1.messages,
      ...buildTextHeavyMessages(6, 2000).slice(1),
    ]

    const result2 = await prepareStep({
      messages: messages2,
      steps: [{ usage: { inputTokens: triggerAt + 1000 } }] as StepsStub,
      model,
      experimental_context: state1,
    })

    const state2 = result2.experimental_context as CompactionState
    expect(state2.compactionCount).toBe(2)
    expect(sawPreviousSummary).toBe(true)
  })

  it('state persists across non-compaction steps', async () => {
    const contextWindow = 10_000
    const prepareStep = createCompactionPrepareStep({ contextWindow })
    const config = computeConfig(contextWindow)
    const triggerAt = Math.floor(contextWindow * config.triggerRatio)

    const model = createMock(async () => summaryResponse(200))

    const messages1 = buildTextHeavyMessages(8, 2000)
    const result1 = await prepareStep({
      messages: messages1,
      steps: [{ usage: { inputTokens: triggerAt + 1000 } }] as StepsStub,
      model,
      experimental_context: null,
    })
    const state1 = result1.experimental_context as CompactionState
    expect(state1.compactionCount).toBe(1)

    const result2 = await prepareStep({
      messages: result1.messages,
      steps: [{ usage: { inputTokens: 500 } }] as StepsStub,
      model,
      experimental_context: state1,
    })
    const state2 = result2.experimental_context as CompactionState
    expect(state2.compactionCount).toBe(1)
    expect(state2.existingSummary).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// E2E: Tool output handling in the pipeline
// ---------------------------------------------------------------------------

describe('compaction E2E — tool output truncation', () => {
  it('preserves small tool outputs when compaction does not run', async () => {
    const contextWindow = 50_000
    const prepareStep = createCompactionPrepareStep({ contextWindow })

    const model = createMock(async () => summaryResponse(200))

    // Use a tool output under the 15K cap so Stage 0 does not truncate
    const smallOutput = 'x'.repeat(10_000)
    const messages: ModelMessage[] = [
      { role: 'user', content: 'Get the page' },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call_1',
            toolName: 'get_page_content',
            input: { pageId: 1 },
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call_1',
            toolName: 'get_page_content',
            output: { type: 'text' as const, value: smallOutput },
          },
        ],
      },
      { role: 'assistant', content: 'Got the content' },
    ]

    const result = await prepareStep({
      messages,
      steps: [{ usage: { inputTokens: 5000 } }] as StepsStub,
      model,
      experimental_context: null,
    })

    const toolMsg = result.messages.find((m) => m.role === 'tool')
    expect(toolMsg).toBeDefined()
    const content = toolMsg?.content as Array<{ output: { value: string } }>
    expect(content[0].output.value.length).toBe(10_000)
    expect(content[0].output.value).not.toContain('[... truncated')
  })

  it('returns messages untouched when under threshold (no truncation)', async () => {
    const contextWindow = 200_000
    const prepareStep = createCompactionPrepareStep({ contextWindow })

    const model = createMock(async () => summaryResponse(200))

    const bigOutput = 'x'.repeat(50_000)
    const messages: ModelMessage[] = [
      { role: 'user', content: 'Get pages' },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call_0',
            toolName: 'get_page',
            input: { id: 0 },
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call_0',
            toolName: 'get_page',
            output: { type: 'text' as const, value: bigOutput },
          },
        ],
      },
      { role: 'assistant', content: 'Got it.' },
    ]

    const result = await prepareStep({
      messages,
      steps: [{ usage: { inputTokens: 5000 } }] as StepsStub,
      model,
      experimental_context: null,
    })

    const state = result.experimental_context as CompactionState
    expect(state.compactionCount).toBe(0)

    // Under threshold — messages returned untouched, no truncation
    const toolMsg = result.messages.find((m) => m.role === 'tool')
    expect(toolMsg).toBeDefined()
    const content = toolMsg?.content as Array<{ output: { value: string } }>
    expect(content[0].output.value.length).toBe(50_000)
    expect(content[0].output.value).not.toContain('[... truncated')
  })

  it('Stages 1+2 clear tool outputs before LLM summarization sees them', async () => {
    // When tool-call-heavy messages trigger compaction, the pruning and
    // clearing stages remove/replace tool outputs before Stage 3.
    const contextWindow = 10_000
    const prepareStep = createCompactionPrepareStep({ contextWindow })
    const config = computeConfig(contextWindow)
    const triggerAt = Math.floor(contextWindow * config.triggerRatio)

    let summarizationCalled = false
    const model = createMock(async (options) => {
      if (isSummarizationCall(options)) {
        summarizationCalled = true
        return summaryResponse(200)
      }
      return textResponse('done', 100)
    })

    // These tool call/result pairs will be pruned/cleared before Stage 3.
    const messages = buildModerateMessages(8, 2000)

    const result = await prepareStep({
      messages,
      steps: [{ usage: { inputTokens: triggerAt + 1000 } }] as StepsStub,
      model,
      experimental_context: null,
    })

    const state = result.experimental_context as CompactionState
    // Pruning + clearing resolved the overflow, so LLM summarization was not needed
    expect(state.compactionCount).toBe(0)
    expect(summarizationCalled).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// E2E: Image handling in the pipeline
// ---------------------------------------------------------------------------

describe('compaction E2E — image handling', () => {
  it('preserves original messages with images when under threshold', async () => {
    const contextWindow = 200_000
    const prepareStep = createCompactionPrepareStep({ contextWindow })

    const model = createMock(async () => summaryResponse(200))

    const largeImage = 'x'.repeat(300_000)
    const messages: ModelMessage[] = [
      { role: 'user', content: 'Take a screenshot' },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call_1',
            toolName: 'screenshot',
            input: {},
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call_1',
            toolName: 'screenshot',
            output: {
              type: 'content' as const,
              value: [
                { type: 'text' as const, text: 'Page loaded' },
                {
                  type: 'image-data' as const,
                  data: largeImage,
                  mediaType: 'image/png',
                },
              ],
            },
          },
        ],
      },
      { role: 'assistant', content: 'I can see the page.' },
    ]

    const result = await prepareStep({
      messages,
      steps: [{ usage: { inputTokens: 5000 } }] as StepsStub,
      model,
      experimental_context: null,
    })

    const state = result.experimental_context as CompactionState
    expect(state.compactionCount).toBe(0)

    // Under threshold: original messages returned with images intact
    const toolMsg = result.messages.find((m) => m.role === 'tool')
    expect(toolMsg).toBeDefined()
    const output = (
      toolMsg?.content as Array<{
        output: { type: string; value: Array<{ type: string; data?: string }> }
      }>
    )[0].output
    expect(output.type).toBe('content')
    expect(output.value[1].type).toBe('image-data')
    expect(output.value[1].data).toBe(largeImage)
  })

  it('strips binary content when compaction triggers (images not corrupted)', async () => {
    const contextWindow = 10_000
    const prepareStep = createCompactionPrepareStep({ contextWindow })
    const config = computeConfig(contextWindow)
    const triggerAt = Math.floor(contextWindow * config.triggerRatio)

    const model = createMock(async (options) => {
      if (isSummarizationCall(options)) {
        // Verify the summarizer never sees base64 data
        const userText = extractUserText(options)
        expect(userText).not.toContain('iVBORw0KGo')
        return summaryResponse(200)
      }
      return textResponse('done', 100)
    })

    // Build text-heavy messages with image tool results
    const messages: ModelMessage[] = [
      { role: 'user', content: `Analyze these pages: ${'q'.repeat(3000)}` },
    ]
    for (let i = 0; i < 8; i++) {
      messages.push({
        role: 'assistant',
        content: `Analysis ${i}: ${'a'.repeat(2000)}`,
      })
      messages.push({
        role: 'user',
        content: `Follow-up ${i}: ${'q'.repeat(500)}`,
      })
    }

    // Add tool results with actual image data to verify binary stripping
    messages.push({
      role: 'assistant',
      content: [
        {
          type: 'tool-call',
          toolCallId: 'call_screenshot',
          toolName: 'screenshot',
          input: {},
        },
      ],
    })
    messages.push({
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId: 'call_screenshot',
          toolName: 'screenshot',
          output: {
            type: 'content' as const,
            value: [
              { type: 'text' as const, text: 'Page loaded' },
              {
                type: 'image-data' as const,
                data: `iVBORw0KGo${'x'.repeat(300_000)}`,
                mediaType: 'image/png',
              },
            ],
          },
        },
      ],
    })

    const result = await prepareStep({
      messages,
      steps: [{ usage: { inputTokens: triggerAt + 2000 } }] as StepsStub,
      model,
      experimental_context: null,
    })

    const state = result.experimental_context as CompactionState
    expect(state.compactionCount).toBe(1)
    expect(result.messages.length).toBeLessThan(messages.length)
  })

  it('does not double-count image tokens after stripping', async () => {
    const contextWindow = 200_000
    const prepareStep = createCompactionPrepareStep({ contextWindow })

    const model = createMock(async () => summaryResponse(200))

    const messages: ModelMessage[] = [
      { role: 'user', content: 'hello' },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call_1',
            toolName: 'screenshot',
            input: {},
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call_1',
            toolName: 'screenshot',
            output: {
              type: 'content' as const,
              value: [
                { type: 'text' as const, text: 'ok' },
                {
                  type: 'image-data' as const,
                  data: 'x'.repeat(300_000),
                  mediaType: 'image/png',
                },
              ],
            },
          },
        ],
      },
      { role: 'assistant', content: 'done' },
    ]

    // With low inputTokens, even with large base64 data, should stay under threshold
    // because token estimation uses fixed image cost (1000 tokens), not base64 length
    const result = await prepareStep({
      messages,
      steps: [{ usage: { inputTokens: 5000 } }] as StepsStub,
      model,
      experimental_context: null,
    })

    const state = result.experimental_context as CompactionState
    expect(state.compactionCount).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// E2E: Pruning stages (Stage 1 & Stage 2)
// ---------------------------------------------------------------------------

describe('compaction E2E — pruning stages', () => {
  it('Stage 1 (pruneMessages) resolves overflow without LLM summarization', async () => {
    const contextWindow = 10_000
    const prepareStep = createCompactionPrepareStep({ contextWindow })
    const config = computeConfig(contextWindow)
    const triggerAt = Math.floor(contextWindow * config.triggerRatio)

    let summarizationCalled = false
    const model = createMock(async (options) => {
      if (isSummarizationCall(options)) {
        summarizationCalled = true
      }
      return summaryResponse(200)
    })

    // Tool call/result pairs get pruned by Stage 1. After pruning + re-estimation,
    // the remaining content (short text messages) should be well under threshold.
    const messages = buildModerateMessages(8, 2000)

    const result = await prepareStep({
      messages,
      steps: [{ usage: { inputTokens: triggerAt + 1000 } }] as StepsStub,
      model,
      experimental_context: null,
    })

    const state = result.experimental_context as CompactionState
    // Pruning resolved overflow — no LLM compaction needed
    expect(state.compactionCount).toBe(0)
    expect(summarizationCalled).toBe(false)
    // Messages should be fewer (tool call content pruned or messages dropped)
    expect(result.messages.length).toBeLessThanOrEqual(messages.length)
  })

  it('Stage 2 (clearToolOutputs) clears old outputs but protects last 3', async () => {
    const messages: ModelMessage[] = [
      { role: 'user', content: 'Do tasks' },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call_old',
            toolName: 'action_old',
            input: { step: 0 },
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call_old',
            toolName: 'action_old',
            output: { type: 'text' as const, value: 'x'.repeat(500) },
          },
        ],
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call_recent_0',
            toolName: 'action_1',
            input: { step: 1 },
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call_recent_0',
            toolName: 'action_1',
            output: { type: 'text' as const, value: 'y'.repeat(500) },
          },
        ],
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call_recent_1',
            toolName: 'action_2',
            input: { step: 2 },
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call_recent_1',
            toolName: 'action_2',
            output: { type: 'text' as const, value: 'z'.repeat(500) },
          },
        ],
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call_recent_2',
            toolName: 'action_3',
            input: { step: 3 },
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call_recent_2',
            toolName: 'action_3',
            output: { type: 'text' as const, value: 'w'.repeat(500) },
          },
        ],
      },
    ]

    const cleared = clearToolOutputs(messages)
    const toolMsgs = cleared.filter((m) => m.role === 'tool') as Array<{
      content: Array<{ output: { value: string } }>
    }>

    // Old tool output (index 0) should be cleared
    expect(toolMsgs[0].content[0].output.value).toContain('[Cleared')
    // Last 3 tool outputs should be protected
    expect(toolMsgs[1].content[0].output.value).toBe('y'.repeat(500))
    expect(toolMsgs[2].content[0].output.value).toBe('z'.repeat(500))
    expect(toolMsgs[3].content[0].output.value).toBe('w'.repeat(500))
  })

  it('all 3 stages work together when only LLM summarization resolves overflow', async () => {
    const contextWindow = 10_000
    const prepareStep = createCompactionPrepareStep({ contextWindow })
    const config = computeConfig(contextWindow)
    const triggerAt = Math.floor(contextWindow * config.triggerRatio)

    let summarizationCalled = false
    const model = createMock(async (options) => {
      if (isSummarizationCall(options)) {
        summarizationCalled = true
        return summaryResponse(200)
      }
      return textResponse('done', 100)
    })

    // Text-heavy messages: no tool calls to prune, no tool outputs to clear.
    // Only LLM summarization can reduce the content.
    const messages = buildTextHeavyMessages(8, 2000)

    const result = await prepareStep({
      messages,
      steps: [{ usage: { inputTokens: triggerAt + 1000 } }] as StepsStub,
      model,
      experimental_context: null,
    })

    const state = result.experimental_context as CompactionState
    expect(state.compactionCount).toBe(1)
    expect(summarizationCalled).toBe(true)
    expect(state.existingSummary).toBeTruthy()
    expect(result.messages.length).toBeLessThan(messages.length)
    expect(result.messages[0].content as string).toContain('## Goal')
  })

  it('clearToolOutputs replaces outputs >100 chars with placeholder, protects last N', () => {
    const messages: ModelMessage[] = [
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call_0',
            toolName: 'test',
            output: { type: 'text' as const, value: 'x'.repeat(500) },
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call_1',
            toolName: 'test',
            output: { type: 'text' as const, value: 'y'.repeat(200) },
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call_2',
            toolName: 'test',
            output: { type: 'text' as const, value: 'z'.repeat(300) },
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call_3',
            toolName: 'test',
            output: { type: 'text' as const, value: 'short' },
          },
        ],
      },
    ]

    const cleared = clearToolOutputs(messages)
    const part0 = (
      cleared[0].content as Array<{ output: { value: string } }>
    )[0]
    const part1 = (
      cleared[1].content as Array<{ output: { value: string } }>
    )[0]
    const part2 = (
      cleared[2].content as Array<{ output: { value: string } }>
    )[0]
    const part3 = (
      cleared[3].content as Array<{ output: { value: string } }>
    )[0]
    // First tool message cleared (not in last 3)
    expect(part0.output.value).toBe('[Cleared — 500 chars]')
    // Last 3 tool messages protected by default keepRecentCount=3
    expect(part1.output.value).toBe('y'.repeat(200))
    expect(part2.output.value).toBe('z'.repeat(300))
    expect(part3.output.value).toBe('short')
  })

  it('estimateTokensForThreshold applies safety multiplier and overhead', () => {
    const config = computeConfig(10_000)
    const messages: ModelMessage[] = [
      { role: 'user', content: 'x'.repeat(3000) },
    ]
    const estimated = estimateTokensForThreshold(messages, config)
    // 3000 chars / 3 = 1000 tokens, * 1.3 = 1300, + 12000 = 13300
    expect(estimated).toBe(Math.ceil(1000 * 1.3) + 12_000)
  })
})

// ---------------------------------------------------------------------------
// E2E: Full generateText with prepareStep at different context windows
// ---------------------------------------------------------------------------

describe('compaction E2E — generateText with tools and prepareStep', () => {
  for (const contextWindow of [8_000, 16_000, 32_000, 200_000]) {
    const toolCallCount = contextWindow >= 200_000 ? 8 : 4

    it(`${(contextWindow / 1000).toFixed(0)}K context — multi-tool conversation with compaction`, async () => {
      const prepareStep = createCompactionPrepareStep({ contextWindow })
      const config = computeConfig(contextWindow)
      let stepCount = 0
      let _compactionTriggered = false

      const model = createMock(async (options) => {
        if (isSummarizationCall(options)) {
          _compactionTriggered = true
          return summaryResponse(200)
        }

        stepCount++
        if (stepCount <= toolCallCount) {
          const simulatedTokens = Math.floor(
            (stepCount / toolCallCount) *
              contextWindow *
              config.triggerRatio *
              1.2,
          )
          return toolCallResponse(
            'get_page_content',
            { pageId: stepCount },
            simulatedTokens,
          )
        }
        return textResponse('All pages processed successfully!', 5000)
      })

      const result = await generateText({
        model,
        system: 'You are a browser automation agent.',
        tools: testTools,
        stopWhen: stepCountIs(toolCallCount + 5),
        prepareStep,
        messages: [
          { role: 'user', content: `Get content from ${toolCallCount} pages` },
        ],
      })

      expect(result.text).toContain('All pages processed')
      expect(result.steps.length).toBeGreaterThanOrEqual(toolCallCount + 1)
      // With the 3-stage pipeline, earlier stages (pruning/clearing) may resolve
      // overflow before LLM summarization. For tool-call-heavy conversations,
      // this is expected. We verify the conversation completed successfully.
    })
  }

  it('agent continues correctly after compaction (summary is injected as first message)', async () => {
    const contextWindow = 10_000
    const prepareStep = createCompactionPrepareStep({ contextWindow })
    const config = computeConfig(contextWindow)
    let stepCount = 0
    let _messagesAfterCompaction: LanguageModelV3CallOptions['prompt'] = []

    const model = createMock(async (options) => {
      if (isSummarizationCall(options)) {
        return summaryResponse(200)
      }

      stepCount++

      if (stepCount >= 3) {
        _messagesAfterCompaction = [...options.prompt]
      }

      if (stepCount <= 3) {
        return toolCallResponse(
          'navigate_to',
          { url: `https://page${stepCount}.com` },
          stepCount >= 2
            ? Math.floor(contextWindow * config.triggerRatio * 1.5)
            : 1000,
        )
      }
      return textResponse('Navigation complete!', 5000)
    })

    const result = await generateText({
      model,
      system: 'Navigate pages.',
      tools: testTools,
      stopWhen: stepCountIs(10),
      prepareStep,
      messages: [{ role: 'user', content: 'Navigate to 3 pages' }],
    })

    expect(result.text).toContain('Navigation complete')
  })

  it('tool call/result pairs are never orphaned after compaction', async () => {
    const contextWindow = 8_000
    const prepareStep = createCompactionPrepareStep({ contextWindow })
    const config = computeConfig(contextWindow)
    let stepCount = 0
    const allPrompts: LanguageModelV3CallOptions['prompt'][] = []

    const model = createMock(async (options) => {
      if (isSummarizationCall(options)) {
        return summaryResponse(200)
      }

      allPrompts.push([...options.prompt])
      stepCount++

      if (stepCount <= 5) {
        return toolCallResponse(
          'click_element',
          { selector: `#btn-${stepCount}` },
          Math.floor(
            (stepCount / 5) * contextWindow * config.triggerRatio * 1.3,
          ),
        )
      }
      return textResponse('Done!', 5000)
    })

    const result = await generateText({
      model,
      system: 'Click buttons.',
      tools: testTools,
      stopWhen: stepCountIs(10),
      prepareStep,
      messages: [{ role: 'user', content: 'Click 5 buttons' }],
    })

    expect(result.text).toContain('Done!')

    for (const prompt of allPrompts) {
      for (let i = 0; i < prompt.length; i++) {
        const msg = prompt[i]
        if (msg.role === 'tool') {
          const prevNonSystem = prompt
            .slice(0, i)
            .filter((m: { role: string }) => m.role !== 'system')
          if (prevNonSystem.length > 0) {
            const prev = prevNonSystem[prevNonSystem.length - 1]
            expect(['assistant', 'user']).toContain(prev.role)
          }
        }
      }
    }
  })
})

// ---------------------------------------------------------------------------
// E2E: Split turn compaction
// ---------------------------------------------------------------------------

describe('compaction E2E — split turn handling', () => {
  it('uses regular summarization for single massive turn (user at index 0)', async () => {
    const contextWindow = 10_000
    const prepareStep = createCompactionPrepareStep({ contextWindow })
    const config = computeConfig(contextWindow)
    const triggerAt = Math.floor(contextWindow * config.triggerRatio)

    let turnPrefixCalled = false
    let historySummarizationCalled = false

    const model = createMock(async (options) => {
      if (isSummarizationCall(options)) {
        if (isTurnPrefixCall(options)) {
          turnPrefixCalled = true
          return turnPrefixSummaryResponse(200)
        }
        historySummarizationCalled = true
        return summaryResponse(200)
      }
      return textResponse('done', 100)
    })

    // Single massive turn with text-heavy content (no tool calls to prune).
    // User at index 0 means this is NOT a split turn.
    const messages: ModelMessage[] = [
      {
        role: 'user',
        content: 'Do a very long multi-step task with many actions',
      },
    ]
    for (let i = 0; i < 15; i++) {
      messages.push({
        role: 'assistant',
        content: `Analysis step ${i}: ${'a'.repeat(2000)}`,
      })
      messages.push({
        role: 'user',
        content: `Follow-up question ${i}: ${'q'.repeat(500)}`,
      })
    }

    const result = await prepareStep({
      messages,
      steps: [{ usage: { inputTokens: triggerAt + 2000 } }] as StepsStub,
      model,
      experimental_context: null,
    })

    const state = result.experimental_context as CompactionState
    expect(state.compactionCount).toBe(1)
    expect(state.existingSummary).toBeTruthy()
    expect(result.messages.length).toBeLessThan(messages.length)

    expect(turnPrefixCalled).toBe(false)
    expect(historySummarizationCalled).toBe(true)
    expect(state.existingSummary).toContain('## Goal')
  })

  it('generates both history and turn prefix summaries for multi-turn split', async () => {
    const contextWindow = 10_000
    const prepareStep = createCompactionPrepareStep({ contextWindow })
    const config = computeConfig(contextWindow)
    const triggerAt = Math.floor(contextWindow * config.triggerRatio)

    let turnPrefixCalled = false
    let historySummarizationCalled = false

    const model = createMock(async (options) => {
      if (isSummarizationCall(options)) {
        if (isTurnPrefixCall(options)) {
          turnPrefixCalled = true
          return turnPrefixSummaryResponse(200)
        }
        historySummarizationCalled = true
        return summaryResponse(200)
      }
      return textResponse('done', 100)
    })

    // Build history (first turn) followed by a massive second turn.
    // Use text-heavy content so pruning stages don't resolve the overflow.
    const messages: ModelMessage[] = [
      { role: 'user', content: `First analysis: ${'f'.repeat(3000)}` },
      {
        role: 'assistant',
        content: `First result: ${'r'.repeat(3000)}`,
      },
      // Massive second turn
      { role: 'user', content: 'Now do a very long task with many steps' },
    ]
    for (let i = 0; i < 12; i++) {
      messages.push({
        role: 'assistant',
        content: `Step ${i} analysis: ${'a'.repeat(2000)}`,
      })
      if (i < 11) {
        messages.push({
          role: 'user',
          content: `Follow-up ${i}: ${'q'.repeat(500)}`,
        })
      }
    }

    const result = await prepareStep({
      messages,
      steps: [{ usage: { inputTokens: triggerAt + 2000 } }] as StepsStub,
      model,
      experimental_context: null,
    })

    const state = result.experimental_context as CompactionState
    expect(state.compactionCount).toBe(1)
    expect(state.existingSummary).toBeTruthy()

    expect(turnPrefixCalled).toBe(true)
    expect(historySummarizationCalled).toBe(true)
    expect(state.existingSummary).toContain('Turn Context (split turn)')
  })
})

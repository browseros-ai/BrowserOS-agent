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
import {
  type CompactionState,
  computeConfig,
  createCompactionPrepareStep,
} from '../../src/agent/compaction'

// ---------------------------------------------------------------------------
// Test infrastructure
// ---------------------------------------------------------------------------

// Simplified step stubs for prepareStep — only usage.inputTokens is needed
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

/** Build messages with many moderate-size exchanges (not one huge tool output). */
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

// Tools for ToolLoopAgent tests — results must be large enough for
// findSafeSplitPoint to find a valid split across all context window sizes.
// For 200K context, keepRecentTokens = 20K, so 4 tool results need > 20K tokens total.
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

  it('compacts when real usage exceeds trigger (10K window, many exchanges)', async () => {
    const contextWindow = 10_000
    const prepareStep = createCompactionPrepareStep({ contextWindow })
    const config = computeConfig(contextWindow)
    const triggerAt = Math.floor(contextWindow * config.triggerRatio)

    const model = createMock(async () => summaryResponse(200))

    // keepRecent = 1750 for 10K window. Need total > 2250 tokens
    // (1750 keep + 500 min summarize). 8 exchanges of 2000-char outputs → ~4000 tokens.
    const messages = buildModerateMessages(8, 2000)

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

    // Large enough to trigger estimation path on step 0.
    const messages = buildModerateMessages(8, 2000)

    const result = await prepareStep({
      messages,
      steps: [] as StepsStub, // step 0
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

    // 2 short messages → ~20 tokens * 1.3 + 5000 = ~5026
    // triggerAt = 200K * 0.85 = 170K → well below
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

    // Need enough content so split point is valid and toSummarize > 500 tokens
    const messages = buildModerateMessages(8, 2000)

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

    // Just above trigger — should compact
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

    const messages = buildModerateMessages(8, 2000)

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

    const messages = buildModerateMessages(8, 2000)

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

    const messages = buildModerateMessages(8, 2000)

    const result = await prepareStep({
      messages,
      steps: [{ usage: { inputTokens: triggerAt + 1000 } }] as StepsStub,
      model,
      experimental_context: null,
    })

    const state = result.experimental_context as CompactionState
    expect(state.compactionCount).toBe(0) // LLM compaction failed
    expect(state.existingSummary).toBeNull()
    // Sliding window should have reduced messages
    expect(result.messages.length).toBeLessThanOrEqual(messages.length)
  })

  it('falls back when summary is inflated (larger than original)', async () => {
    const contextWindow = 10_000
    const prepareStep = createCompactionPrepareStep({ contextWindow })
    const config = computeConfig(contextWindow)
    const triggerAt = Math.floor(contextWindow * config.triggerRatio)

    const model = createMock(async () => textResponse('x'.repeat(100_000), 200))

    const messages = buildModerateMessages(8, 2000)

    const result = await prepareStep({
      messages,
      steps: [{ usage: { inputTokens: triggerAt + 1000 } }] as StepsStub,
      model,
      experimental_context: null,
    })

    const state = result.experimental_context as CompactionState
    expect(state.compactionCount).toBe(0) // inflation check failed
  })

  it('falls back when summary is empty', async () => {
    const contextWindow = 10_000
    const prepareStep = createCompactionPrepareStep({ contextWindow })
    const config = computeConfig(contextWindow)
    const triggerAt = Math.floor(contextWindow * config.triggerRatio)

    const model = createMock(async () => textResponse('', 200))

    const messages = buildModerateMessages(8, 2000)

    const result = await prepareStep({
      messages,
      steps: [{ usage: { inputTokens: triggerAt + 1000 } }] as StepsStub,
      model,
      experimental_context: null,
    })

    const state = result.experimental_context as CompactionState
    expect(state.compactionCount).toBe(0) // empty summary
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

    // First compaction — need enough content for 10K window (keepRecent=1750)
    const messages1 = buildModerateMessages(8, 2000)
    const result1 = await prepareStep({
      messages: messages1,
      steps: [{ usage: { inputTokens: triggerAt + 1000 } }] as StepsStub,
      model,
      experimental_context: null,
    })

    const state1 = result1.experimental_context as CompactionState
    expect(state1.compactionCount).toBe(1)
    expect(sawPreviousSummary).toBe(false)

    // Second compaction — add more messages to the compacted result
    sawPreviousSummary = false
    const messages2: ModelMessage[] = [
      ...result1.messages,
      ...buildModerateMessages(6, 1000).slice(1), // skip first user msg
    ]

    const result2 = await prepareStep({
      messages: messages2,
      steps: [{ usage: { inputTokens: triggerAt + 1000 } }] as StepsStub,
      model,
      experimental_context: state1,
    })

    const state2 = result2.experimental_context as CompactionState
    expect(state2.compactionCount).toBe(2)
    expect(sawPreviousSummary).toBe(true) // UPDATE prompt used
  })

  it('state persists across non-compaction steps', async () => {
    const contextWindow = 10_000
    const prepareStep = createCompactionPrepareStep({ contextWindow })
    const config = computeConfig(contextWindow)
    const triggerAt = Math.floor(contextWindow * config.triggerRatio)

    const model = createMock(async () => summaryResponse(200))

    // First: compact — need enough content for 10K window
    const messages1 = buildModerateMessages(8, 2000)
    const result1 = await prepareStep({
      messages: messages1,
      steps: [{ usage: { inputTokens: triggerAt + 1000 } }] as StepsStub,
      model,
      experimental_context: null,
    })
    const state1 = result1.experimental_context as CompactionState
    expect(state1.compactionCount).toBe(1)

    // Second: below trigger, no compaction — state should persist
    const result2 = await prepareStep({
      messages: result1.messages,
      steps: [{ usage: { inputTokens: 500 } }] as StepsStub,
      model,
      experimental_context: state1,
    })
    const state2 = result2.experimental_context as CompactionState
    expect(state2.compactionCount).toBe(1) // unchanged
    expect(state2.existingSummary).toBeTruthy() // preserved
  })
})

// ---------------------------------------------------------------------------
// E2E: Tool output truncation in the pipeline
// ---------------------------------------------------------------------------

describe('compaction E2E — tool output truncation', () => {
  it('does not mutate tool outputs when compaction does not run', async () => {
    const contextWindow = 50_000
    const prepareStep = createCompactionPrepareStep({ contextWindow })

    const model = createMock(async () => summaryResponse(200))

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
            output: { type: 'text' as const, value: 'x'.repeat(100_000) },
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
    expect(content[0].output.value.length).toBe(100_000)
    expect(content[0].output.value).not.toContain('[... truncated')
  })

  it('truncates oversized tool outputs inside summarization input during compaction', async () => {
    // Use 50K context so maxSummarizationInput has room for truncated outputs.
    // 10K is too small — even truncated 15K outputs overflow the summarization budget.
    const contextWindow = 50_000
    const prepareStep = createCompactionPrepareStep({ contextWindow })
    const config = computeConfig(contextWindow)
    const triggerAt = Math.floor(contextWindow * config.triggerRatio)
    let sawTruncationMarkerInSummarizationPrompt = false

    const model = createMock(async (options) => {
      if (isSummarizationCall(options)) {
        for (const msg of options.prompt) {
          if (msg.role !== 'user') continue
          const content = msg.content
          const text =
            typeof content === 'string'
              ? content
              : content
                  .filter(
                    (part: { type?: string; text?: string }) =>
                      'text' in part && typeof part.text === 'string',
                  )
                  .map((part: { text?: string }) => part.text)
                  .join('\n')
          if (text.includes('[... truncated')) {
            sawTruncationMarkerInSummarizationPrompt = true
          }
        }
      }
      return summaryResponse(200)
    })

    // 8 exchanges with 50K char outputs — each exceeds toolOutputMaxChars (15K).
    // compactMessages truncates only the older "toSummarize" portion;
    // recent "toKeep" messages stay intact.
    const messages = buildModerateMessages(3, 50_000)

    const result = await prepareStep({
      messages,
      steps: [{ usage: { inputTokens: triggerAt + 1000 } }] as StepsStub,
      model,
      experimental_context: null,
    })

    const state = result.experimental_context as CompactionState
    expect(state.compactionCount).toBe(1)
    expect(sawTruncationMarkerInSummarizationPrompt).toBe(true)

    // Recent tool outputs kept in live context should remain unmodified
    // (only the older toSummarize portion was truncated).
    const keptToolMessages = result.messages.filter(
      (m) => m.role === 'tool',
    ) as Array<{
      content: Array<{ output: { type: string; value: string } }>
    }>
    for (const tm of keptToolMessages) {
      for (const part of tm.content) {
        // Kept tool outputs should NOT have truncation markers
        expect(part.output.value).not.toContain('[... truncated')
      }
    }
  })
})

// ---------------------------------------------------------------------------
// E2E: Full generateText with prepareStep at different context windows
// ---------------------------------------------------------------------------

describe('compaction E2E — generateText with tools and prepareStep', () => {
  for (const contextWindow of [8_000, 16_000, 32_000, 200_000]) {
    // Use more tool calls for larger context windows so toSummarize has enough content
    const toolCallCount = contextWindow >= 200_000 ? 8 : 4

    it(`${(contextWindow / 1000).toFixed(0)}K context — multi-tool conversation with compaction`, async () => {
      const prepareStep = createCompactionPrepareStep({ contextWindow })
      const config = computeConfig(contextWindow)
      let stepCount = 0
      let compactionSummarizationCalled = false

      const model = createMock(async (options) => {
        if (isSummarizationCall(options)) {
          compactionSummarizationCalled = true
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
      // Compaction should have been triggered for all model sizes
      // (we simulate usage above trigger ratio * 1.2)
      expect(compactionSummarizationCalled).toBe(true)
    })
  }

  it('agent continues correctly after compaction (summary is injected as first message)', async () => {
    const contextWindow = 10_000
    const prepareStep = createCompactionPrepareStep({ contextWindow })
    const config = computeConfig(contextWindow)
    let stepCount = 0
    let messagesAfterCompaction: LanguageModelV3CallOptions['prompt'] = []

    const model = createMock(async (options) => {
      if (isSummarizationCall(options)) {
        return summaryResponse(200)
      }

      stepCount++

      if (stepCount >= 3) {
        messagesAfterCompaction = [...options.prompt]
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

    // After compaction, the first non-system message should be the summary
    if (messagesAfterCompaction.length > 0) {
      const userMessages = messagesAfterCompaction.filter(
        (m: { role: string }) => m.role === 'user',
      )
      if (userMessages.length > 0) {
        const firstUserContent = userMessages[0].content
        const hasSummary = Array.isArray(firstUserContent)
          ? firstUserContent.some(
              (p: { text?: string }) =>
                'text' in p && p.text?.includes('## Goal'),
            )
          : typeof firstUserContent === 'string' &&
            firstUserContent.includes('## Goal')
        if (hasSummary) {
          expect(hasSummary).toBe(true)
        }
      }
    }
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

    // Verify no orphaned tool results in any prompt sent to the model
    for (const prompt of allPrompts) {
      for (let i = 0; i < prompt.length; i++) {
        const msg = prompt[i]
        if (msg.role === 'tool') {
          // A tool message should NEVER be the very first non-system message
          // (unless preceded by an assistant tool_call or it's after a summary)
          const prevNonSystem = prompt
            .slice(0, i)
            .filter((m: { role: string }) => m.role !== 'system')
          if (prevNonSystem.length > 0) {
            const prev = prevNonSystem[prevNonSystem.length - 1]
            // Previous non-system message must be assistant (which made the tool call)
            // OR a user message (which could be a compaction summary)
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

    // Build a single massive turn: 1 user msg + 15 tool call/result pairs
    // With user at index 0, this is NOT a split turn — regular summarization is used
    const messages: ModelMessage[] = [
      {
        role: 'user',
        content: 'Do a very long multi-step task with many actions',
      },
    ]
    for (let i = 0; i < 15; i++) {
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
              value: `Result ${i}: ${'x'.repeat(2000)}`,
            },
          },
        ],
      })
    }
    messages.push({ role: 'assistant', content: 'Still working on it...' })

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

    // Single turn with user at index 0 → regular summarization, NOT turn prefix
    expect(turnPrefixCalled).toBe(false)
    expect(historySummarizationCalled).toBe(true)

    // The summary should contain standard markdown format
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

    // Build messages with history before the massive turn
    const messages: ModelMessage[] = [
      { role: 'user', content: 'First, check the weather' },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call_weather',
            toolName: 'check_weather',
            input: { city: 'NYC' },
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call_weather',
            toolName: 'check_weather',
            output: { type: 'text' as const, value: 'Sunny, 75°F' },
          },
        ],
      },
      { role: 'assistant', content: 'The weather is sunny!' },
      // Now a massive second turn
      { role: 'user', content: 'Now do a very long task with many steps' },
    ]
    for (let i = 0; i < 12; i++) {
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
              value: `Result ${i}: ${'x'.repeat(2000)}`,
            },
          },
        ],
      })
    }
    messages.push({ role: 'assistant', content: 'Working on it...' })

    const result = await prepareStep({
      messages,
      steps: [{ usage: { inputTokens: triggerAt + 2000 } }] as StepsStub,
      model,
      experimental_context: null,
    })

    const state = result.experimental_context as CompactionState
    expect(state.compactionCount).toBe(1)
    expect(state.existingSummary).toBeTruthy()

    // Both summaries should have been called since there's history + split turn
    expect(turnPrefixCalled).toBe(true)
    expect(historySummarizationCalled).toBe(true)

    // The merged summary should contain the split turn separator
    expect(state.existingSummary).toContain('Turn Context (split turn)')
  })
})

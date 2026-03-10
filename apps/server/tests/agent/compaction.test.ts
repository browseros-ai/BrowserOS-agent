import { describe, expect, it } from 'bun:test'
import type { ModelMessage } from 'ai'
import {
  computeConfig,
  estimateTokens,
  findSafeSplitPoint,
  getCurrentTokenCount,
  type StepWithUsage,
  slidingWindow,
  truncateToolOutputs,
} from '../../src/agent/compaction'
import {
  buildSummarizationPrompt,
  buildTurnPrefixPrompt,
  messagesToTranscript,
} from '../../src/agent/compaction-prompt'
import {
  createContextOverflowMiddleware,
  isContextOverflowError,
} from '../../src/agent/context-overflow-middleware'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function userMsg(text: string): ModelMessage {
  return { role: 'user', content: text }
}

function assistantMsg(text: string): ModelMessage {
  return { role: 'assistant', content: text }
}

function assistantToolCall(
  toolName: string,
  input: Record<string, unknown>,
): ModelMessage {
  return {
    role: 'assistant',
    content: [
      {
        type: 'tool-call',
        toolCallId: `call_${toolName}_${Date.now()}`,
        toolName,
        input,
      },
    ],
  }
}

function toolResult(
  toolName: string,
  text: string,
  toolCallId?: string,
): ModelMessage {
  return {
    role: 'tool',
    content: [
      {
        type: 'tool-result',
        toolCallId: toolCallId ?? `call_${toolName}`,
        toolName,
        output: { type: 'text' as const, value: text },
      },
    ],
  }
}

function toolResultJson(toolName: string, value: unknown): ModelMessage {
  return {
    role: 'tool',
    content: [
      {
        type: 'tool-result',
        toolCallId: `call_${toolName}`,
        toolName,
        output: { type: 'json' as const, value },
      },
    ],
  }
}

function userMsgWithImage(text: string): ModelMessage {
  return {
    role: 'user',
    content: [
      { type: 'text', text },
      { type: 'image', image: new Uint8Array([1, 2, 3]) },
    ],
  }
}

function repeat(char: string, count: number): string {
  return char.repeat(count)
}

// Build a realistic browser automation conversation
function buildBrowserConversation(
  toolOutputSize: number,
  exchanges: number,
): ModelMessage[] {
  const messages: ModelMessage[] = [
    userMsg('Book me a flight from NYC to LAX on Kayak'),
  ]

  for (let i = 0; i < exchanges; i++) {
    messages.push(assistantToolCall(`action_${i}`, { step: i }))
    messages.push(toolResult(`action_${i}`, repeat('x', toolOutputSize)))
    messages.push(assistantMsg(`Completed step ${i}`))
  }

  return messages
}

// ---------------------------------------------------------------------------
// computeConfig — Pi-style reserve trigger
// ---------------------------------------------------------------------------

describe('computeConfig — reserve trigger', () => {
  it('8K model → reserve is clamped to 50% of context', () => {
    const config = computeConfig(8_000)
    expect(config.reserveTokens).toBe(4_000)
    expect(config.triggerThreshold).toBe(4_000)
    expect(config.triggerRatio).toBe(0.5)
  })

  it('16K model → reserve is clamped to 50% of context', () => {
    const config = computeConfig(16_000)
    expect(config.reserveTokens).toBe(8_000)
    expect(config.triggerThreshold).toBe(8_000)
    expect(config.triggerRatio).toBe(0.5)
  })

  it('32K model → reserve is fixed at 16,384', () => {
    const config = computeConfig(32_000)
    expect(config.reserveTokens).toBe(16_384)
    expect(config.triggerThreshold).toBe(15_616)
    expect(config.triggerRatio).toBeCloseTo(0.488, 3)
  })

  it('64K model → reserve remains fixed at 16,384', () => {
    const config = computeConfig(64_000)
    expect(config.reserveTokens).toBe(16_384)
    expect(config.triggerThreshold).toBe(47_616)
    expect(config.triggerRatio).toBeCloseTo(0.744, 3)
  })

  it('200K model → reserve remains fixed at 16,384', () => {
    const config = computeConfig(200_000)
    expect(config.reserveTokens).toBe(16_384)
    expect(config.triggerThreshold).toBe(183_616)
    expect(config.triggerRatio).toBeCloseTo(0.918, 3)
  })

  it('1M model → reserve remains fixed at 16,384', () => {
    const config = computeConfig(1_000_000)
    expect(config.reserveTokens).toBe(16_384)
    expect(config.triggerThreshold).toBe(983_616)
    expect(config.triggerRatio).toBeCloseTo(0.984, 3)
  })
})

// ---------------------------------------------------------------------------
// computeConfig — keep-recent fraction with max cap
// ---------------------------------------------------------------------------

describe('computeConfig — keep-recent', () => {
  it('8K model → keeps 35% of trigger budget', () => {
    const config = computeConfig(8_000)
    expect(config.minSummarizableTokens).toBe(1_000)
    expect(config.keepRecentTokens).toBe(1_400)
  })

  it('16K model → keeps 35% of trigger budget', () => {
    const config = computeConfig(16_000)
    expect(config.minSummarizableTokens).toBe(1_000)
    expect(config.keepRecentTokens).toBe(2_800)
  })

  it('32K model → keeps 35% of trigger budget', () => {
    const config = computeConfig(32_000)
    expect(config.minSummarizableTokens).toBe(4_000)
    expect(config.keepRecentTokens).toBe(5_465)
  })

  it('64K model → still below cap with 35% split', () => {
    const config = computeConfig(64_000)
    expect(config.keepRecentTokens).toBe(16_665)
  })

  it('200K model → capped at 20K', () => {
    const config = computeConfig(200_000)
    expect(config.keepRecentTokens).toBe(20_000)
  })

  it('1M model → capped at 20K', () => {
    const config = computeConfig(1_000_000)
    expect(config.keepRecentTokens).toBe(20_000)
  })
})

// ---------------------------------------------------------------------------
// computeConfig — Pi-style summarization budgets
// ---------------------------------------------------------------------------

describe('computeConfig — summarization budgets', () => {
  it('16K model → summarize budget is trigger minus keep-recent', () => {
    const config = computeConfig(16_000)
    expect(config.maxSummarizationInput).toBe(5_200)
    expect(config.summarizerMaxOutputTokens).toBe(6_400)
  })

  it('32K model → summarize budget expands for fewer repeated compactions', () => {
    const config = computeConfig(32_000)
    expect(config.maxSummarizationInput).toBe(10_151)
    expect(config.summarizerMaxOutputTokens).toBe(13_107)
  })

  it('20K model → min summarizable is clamped to available summarize budget', () => {
    const config = computeConfig(20_000)
    expect(config.minSummarizableTokens).toBe(2_351)
    expect(config.maxSummarizationInput).toBe(2_351)
  })

  it('200K model → max summarization input is capped at 100K', () => {
    const config = computeConfig(200_000)
    expect(config.maxSummarizationInput).toBe(100_000)
    expect(config.summarizerMaxOutputTokens).toBe(13_107)
  })

  it('1M model → max summarization input is capped at 100K', () => {
    const config = computeConfig(1_000_000)
    expect(config.maxSummarizationInput).toBe(100_000)
  })
})

// ---------------------------------------------------------------------------
// estimateTokens
// ---------------------------------------------------------------------------

describe('estimateTokens', () => {
  it('estimates text messages as chars/3', () => {
    const msgs = [userMsg('a'.repeat(300))]
    expect(estimateTokens(msgs)).toBe(100)
  })

  it('estimates tool result text', () => {
    const msgs = [toolResult('test', 'a'.repeat(600))]
    expect(estimateTokens(msgs)).toBe(200)
  })

  it('estimates tool result JSON', () => {
    const obj = { key: 'a'.repeat(100) }
    const msgs = [toolResultJson('test', obj)]
    const serialized = JSON.stringify(obj)
    expect(estimateTokens(msgs)).toBe(Math.ceil(serialized.length / 3))
  })

  it('counts images as 1000 tokens each', () => {
    const msgs = [userMsgWithImage('hello')]
    const textTokens = Math.ceil('hello'.length / 3)
    expect(estimateTokens(msgs)).toBe(textTokens + 1000)
  })

  it('counts multiple images', () => {
    const msg: ModelMessage = {
      role: 'user',
      content: [
        { type: 'text', text: 'compare these' },
        { type: 'image', image: new Uint8Array([1]) },
        { type: 'image', image: new Uint8Array([2]) },
      ],
    }
    const textTokens = Math.ceil('compare these'.length / 3)
    expect(estimateTokens([msg])).toBe(textTokens + 2000)
  })

  it('handles tool call input', () => {
    const msgs = [assistantToolCall('navigate', { url: 'https://example.com' })]
    const expected = Math.ceil(
      JSON.stringify({ url: 'https://example.com' }).length / 3,
    )
    expect(estimateTokens(msgs)).toBe(expected)
  })

  it('handles empty messages', () => {
    expect(estimateTokens([])).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// findSafeSplitPoint
// ---------------------------------------------------------------------------

describe('findSafeSplitPoint', () => {
  it('returns splitIndex -1 for too few messages', () => {
    const msgs = [userMsg('hello'), assistantMsg('hi')]
    const result = findSafeSplitPoint(msgs, 1)
    expect(result.splitIndex).toBe(-1)
    expect(result.isSplitTurn).toBe(false)
  })

  it('returns splitIndex -1 when conversation is smaller than keepRecent', () => {
    const msgs = [userMsg('hello'), assistantMsg('hi'), userMsg('what')]
    // Total estimated ~3-4 tokens, keepRecent = 1000
    const result = findSafeSplitPoint(msgs, 1000)
    expect(result.splitIndex).toBe(-1)
    expect(result.isSplitTurn).toBe(false)
  })

  it('never cuts before a tool message', () => {
    // Build: user, assistant(tool_call), tool, assistant(text), user, assistant
    const msgs: ModelMessage[] = [
      userMsg('do something'),
      assistantToolCall('navigate', { url: 'https://example.com' }),
      toolResult('navigate', repeat('x', 2000)),
      assistantMsg('done navigating'),
      userMsg(repeat('y', 8000)),
      assistantMsg(repeat('z', 8000)),
    ]

    const result = findSafeSplitPoint(msgs, 2100)
    expect(result.splitIndex).toBeGreaterThan(0)
    expect(msgs[result.splitIndex].role).not.toBe('tool')
  })

  it('walks backward past tool messages to find safe cut', () => {
    const msgs: ModelMessage[] = [
      userMsg('start'),
      assistantMsg('ok'),
      assistantToolCall('click', { selector: '#btn' }),
      toolResult('click', repeat('x', 4000)), // walking back lands here — unsafe
      assistantToolCall('snapshot', {}),
      toolResult('snapshot', repeat('y', 4000)),
      assistantMsg(repeat('z', 8000)), // ~2000 tokens, keepRecent = 2500
    ]

    const result = findSafeSplitPoint(msgs, 2500)
    if (result.splitIndex !== -1) {
      expect(msgs[result.splitIndex].role).not.toBe('tool')
    }
  })

  it('splits correctly in a realistic browser automation flow', () => {
    // 10 exchanges, each tool output ~4000 chars (~1000 tokens)
    const msgs = buildBrowserConversation(4000, 10)
    const result = findSafeSplitPoint(msgs, 3000)

    expect(result.splitIndex).toBeGreaterThan(0)
    expect(result.splitIndex).toBeLessThan(msgs.length)
    expect(msgs[result.splitIndex].role).not.toBe('tool')

    const keptTokens = estimateTokens(msgs.slice(result.splitIndex))
    expect(keptTokens).toBeGreaterThanOrEqual(3000)
  })

  it('handles assistant tool_call followed by tool result pairs', () => {
    const msgs: ModelMessage[] = [
      userMsg('start'),
      assistantToolCall('a', {}),
      toolResult('a', 'result a'),
      assistantToolCall('b', {}),
      toolResult('b', 'result b'),
      assistantToolCall('c', {}),
      toolResult('c', repeat('z', 4000)),
      assistantMsg('final answer'),
    ]

    const result = findSafeSplitPoint(msgs, 500)
    if (result.splitIndex !== -1) {
      const kept = msgs.slice(result.splitIndex)
      for (let i = 0; i < kept.length; i++) {
        if (kept[i].role === 'tool') {
          expect(i).toBeGreaterThan(0)
          expect(kept[i - 1].role).toBe('assistant')
        }
      }
    }
  })
})

// ---------------------------------------------------------------------------
// findSafeSplitPoint — split turn detection
// ---------------------------------------------------------------------------

describe('findSafeSplitPoint — split turn detection', () => {
  it('detects split turn when cut lands mid-turn (user+assistant+tool+assistant+tool)', () => {
    const msgs: ModelMessage[] = [
      userMsg('first request'),
      assistantMsg('done with first'),
      userMsg('order MacBook on Amazon'), // index 2 — turn start
      assistantToolCall('navigate', { url: 'https://amazon.com' }), // index 3
      toolResult('navigate', repeat('x', 4000)), // index 4
      assistantToolCall('click', { selector: '#buy' }), // index 5 — cut here
      toolResult('click', repeat('y', 4000)), // index 6
      assistantMsg(repeat('z', 8000)), // index 7
    ]

    // keepRecent should land the cut around index 5 (mid-turn)
    const result = findSafeSplitPoint(msgs, 2500)
    if (result.splitIndex !== -1 && result.splitIndex > 2) {
      expect(result.isSplitTurn).toBe(true)
      expect(result.turnStartIndex).toBe(2)
    }
  })

  it('does not flag split turn when cut is at user message', () => {
    const msgs: ModelMessage[] = [
      userMsg('first request'),
      assistantMsg('done'),
      userMsg(repeat('x', 8000)), // index 2 — this is where cut lands
      assistantMsg(repeat('y', 8000)),
    ]

    const result = findSafeSplitPoint(msgs, 2100)
    if (result.splitIndex !== -1 && msgs[result.splitIndex].role === 'user') {
      expect(result.isSplitTurn).toBe(false)
      expect(result.turnStartIndex).toBe(-1)
    }
  })

  it('does not flag split turn when user message is at index 0 (single turn)', () => {
    // One user message followed by many tool exchanges
    const msgs: ModelMessage[] = [
      userMsg('do everything'), // index 0
    ]
    for (let i = 0; i < 10; i++) {
      msgs.push(assistantToolCall(`action_${i}`, { step: i }))
      msgs.push(toolResult(`action_${i}`, repeat('x', 4000)))
    }
    msgs.push(assistantMsg(repeat('z', 8000)))

    const result = findSafeSplitPoint(msgs, 3000)
    if (result.splitIndex !== -1) {
      // When the only user message is at index 0, it's NOT a split turn
      // Regular summarization is better for this case
      expect(result.isSplitTurn).toBe(false)
      expect(result.turnStartIndex).toBe(-1)
    }
  })
})

// ---------------------------------------------------------------------------
// Splitting mechanics at different model sizes
// ---------------------------------------------------------------------------

describe('splitting at different context windows', () => {
  it('32K model — splits with realistic browser automation', () => {
    const config = computeConfig(32_000)
    const msgs = buildBrowserConversation(5000, 12)
    const totalTokens = estimateTokens(msgs)
    expect(totalTokens).toBeGreaterThan(12_800)

    const result = findSafeSplitPoint(msgs, config.keepRecentTokens)
    expect(result.splitIndex).toBeGreaterThan(0)
    expect(msgs[result.splitIndex].role).not.toBe('tool')

    const kept = msgs.slice(result.splitIndex)
    const keptTokens = estimateTokens(kept)
    expect(keptTokens).toBeGreaterThanOrEqual(config.keepRecentTokens)

    const toSummarize = msgs.slice(0, result.splitIndex)
    expect(toSummarize.length).toBeGreaterThan(0)
  })

  it('200K model — splits with long conversation', () => {
    const config = computeConfig(200_000)
    const msgs = buildBrowserConversation(10000, 50)
    const totalTokens = estimateTokens(msgs)
    expect(totalTokens).toBeGreaterThan(100_000)

    const result = findSafeSplitPoint(msgs, config.keepRecentTokens)
    expect(result.splitIndex).toBeGreaterThan(0)

    const kept = msgs.slice(result.splitIndex)
    const keptTokens = estimateTokens(kept)
    expect(keptTokens).toBeGreaterThanOrEqual(config.keepRecentTokens)
  })

  it('16K model — handles tight context', () => {
    const config = computeConfig(16_000)
    const msgs = buildBrowserConversation(2000, 5)
    const totalTokens = estimateTokens(msgs)

    if (totalTokens > 16_000 * config.triggerRatio) {
      const result = findSafeSplitPoint(msgs, config.keepRecentTokens)
      if (result.splitIndex !== -1) {
        expect(msgs[result.splitIndex].role).not.toBe('tool')
        const toSummarize = msgs.slice(0, result.splitIndex)
        expect(estimateTokens(toSummarize)).toBeGreaterThan(0)
      }
    }
  })

  it('keeps tool call + result pairs together after split', () => {
    for (const contextWindow of [16_000, 32_000, 64_000, 200_000, 1_000_000]) {
      const config = computeConfig(contextWindow)
      const msgs = buildBrowserConversation(4000, 8)
      const result = findSafeSplitPoint(msgs, config.keepRecentTokens)

      if (result.splitIndex === -1) continue

      const kept = msgs.slice(result.splitIndex)
      for (let i = 0; i < kept.length; i++) {
        if (kept[i].role === 'tool' && i === 0) {
          throw new Error(
            `Orphaned tool result at start of kept messages for ${contextWindow} context window`,
          )
        }
      }
    }
  })
})

// ---------------------------------------------------------------------------
// truncateToolOutputs
// ---------------------------------------------------------------------------

describe('truncateToolOutputs', () => {
  it('truncates text output exceeding maxChars', () => {
    const msgs = [toolResult('test', 'a'.repeat(20_000))]
    const truncated = truncateToolOutputs(msgs, 15_000)

    const output = (
      truncated[0].content as Array<{ output: { value: string } }>
    )[0].output.value
    expect(output.length).toBeLessThan(20_000)
    expect(output).toContain('[... truncated')
  })

  it('truncates JSON output exceeding maxChars', () => {
    const msgs = [toolResultJson('test', { data: 'x'.repeat(20_000) })]
    const truncated = truncateToolOutputs(msgs, 15_000)

    const part = (
      truncated[0].content as Array<{ output: { type: string; value: string } }>
    )[0]
    expect(part.output.type).toBe('text')
    expect(part.output.value).toContain('[... truncated')
  })

  it('does not modify outputs under maxChars', () => {
    const msgs = [toolResult('test', 'short output')]
    const truncated = truncateToolOutputs(msgs, 15_000)

    const output = (
      truncated[0].content as Array<{ output: { value: string } }>
    )[0].output.value
    expect(output).toBe('short output')
  })

  it('does not modify non-tool messages', () => {
    const msgs = [userMsg('hello'), assistantMsg('world')]
    const truncated = truncateToolOutputs(msgs, 100)
    expect(truncated).toEqual(msgs)
  })
})

// ---------------------------------------------------------------------------
// slidingWindow
// ---------------------------------------------------------------------------

describe('slidingWindow', () => {
  it('keeps tool+assistant pairs together', () => {
    const msgs: ModelMessage[] = [
      assistantToolCall('a', {}),
      toolResult('a', repeat('x', 4000)),
      assistantToolCall('b', {}),
      toolResult('b', repeat('y', 4000)),
      userMsg('continue'),
    ]

    // maxTokens small enough to force dropping
    const windowed = slidingWindow(msgs, 1500)

    // Should not start with a tool result (that would be orphaned)
    if (windowed.length > 0 && windowed[0].role === 'tool') {
      // If it starts with tool, the next should be assistant
      expect(windowed.length).toBeGreaterThan(1)
    }
  })

  it('preserves at least 2 messages', () => {
    const msgs = [userMsg(repeat('x', 10000)), assistantMsg(repeat('y', 10000))]
    const windowed = slidingWindow(msgs, 100)
    expect(windowed.length).toBeGreaterThanOrEqual(2)
  })

  it('returns original when under threshold', () => {
    const msgs = [userMsg('hello'), assistantMsg('hi')]
    const windowed = slidingWindow(msgs, 100_000)
    expect(windowed).toEqual(msgs)
  })
})

// ---------------------------------------------------------------------------
// compaction-prompt: buildSummarizationPrompt
// ---------------------------------------------------------------------------

describe('buildSummarizationPrompt', () => {
  it('returns initial prompt when no existing summary', () => {
    const prompt = buildSummarizationPrompt(null)
    expect(prompt).toContain('Summarize the following')
    expect(prompt).toContain('## Goal')
    expect(prompt).toContain('## Active State')
    expect(prompt).not.toContain('<previous_summary>')
  })

  it('returns update prompt with previous summary', () => {
    const prompt = buildSummarizationPrompt('## Goal\nold stuff')
    expect(prompt).toContain('Update the existing summary')
    expect(prompt).toContain('PRESERVE all existing information')
    expect(prompt).toContain('<previous_summary>')
    expect(prompt).toContain('old stuff')
  })
})

// ---------------------------------------------------------------------------
// compaction-prompt: buildTurnPrefixPrompt
// ---------------------------------------------------------------------------

describe('buildTurnPrefixPrompt', () => {
  it('returns turn prefix prompt with expected sections', () => {
    const prompt = buildTurnPrefixPrompt()
    expect(prompt).toContain('PREFIX of a turn')
    expect(prompt).toContain('## Original Request')
    expect(prompt).toContain('## Early Progress')
    expect(prompt).toContain('## Context for Suffix')
  })
})

// ---------------------------------------------------------------------------
// compaction-prompt: messagesToTranscript
// ---------------------------------------------------------------------------

describe('messagesToTranscript', () => {
  it('serializes user messages', () => {
    const transcript = messagesToTranscript([userMsg('hello world')])
    expect(transcript).toBe('[User]: hello world')
  })

  it('serializes assistant text', () => {
    const transcript = messagesToTranscript([assistantMsg('I will help')])
    expect(transcript).toBe('[Assistant]: I will help')
  })

  it('serializes tool calls', () => {
    const transcript = messagesToTranscript([
      assistantToolCall('navigate_to', { url: 'https://example.com' }),
    ])
    expect(transcript).toContain('[Tool Call]: navigate_to(')
    expect(transcript).toContain('https://example.com')
  })

  it('serializes tool results', () => {
    const transcript = messagesToTranscript([
      toolResult('navigate_to', 'Navigated to Example'),
    ])
    expect(transcript).toContain(
      '[Tool Result] navigate_to: Navigated to Example',
    )
  })

  it('truncates large tool results to 2K', () => {
    const transcript = messagesToTranscript([
      toolResult('snapshot', repeat('x', 5000)),
    ])
    expect(transcript).toContain('[... truncated')
    // The tool output should be capped
    expect(transcript.length).toBeLessThan(5000)
  })

  it('replaces images with [Image]', () => {
    const transcript = messagesToTranscript([userMsgWithImage('look at this')])
    expect(transcript).toContain('[Image]')
    expect(transcript).toContain('look at this')
  })

  it('handles a full conversation', () => {
    const msgs: ModelMessage[] = [
      userMsg('Open google.com'),
      assistantMsg("I'll navigate to Google."),
      assistantToolCall('navigate_to', { url: 'https://google.com' }),
      toolResult('navigate_to', 'Navigated to Google'),
      assistantMsg('I opened Google. What next?'),
      userMsg('Search for flights'),
    ]

    const transcript = messagesToTranscript(msgs)
    expect(transcript).toContain('[User]: Open google.com')
    expect(transcript).toContain("[Assistant]: I'll navigate to Google.")
    expect(transcript).toContain('[Tool Call]: navigate_to(')
    expect(transcript).toContain(
      '[Tool Result] navigate_to: Navigated to Google',
    )
    expect(transcript).toContain('[User]: Search for flights')
  })
})

// ---------------------------------------------------------------------------
// End-to-end: config + split coherence at all model sizes
// ---------------------------------------------------------------------------

describe('end-to-end config coherence', () => {
  const modelSizes = [
    8_000, 16_000, 32_000, 64_000, 128_000, 200_000, 1_000_000,
  ]

  for (const size of modelSizes) {
    it(`${(size / 1000).toFixed(0)}K model — trigger budget is partitioned into keep + summarize`, () => {
      const config = computeConfig(size)
      const triggerTokens = config.triggerThreshold

      // Trigger budget is partitioned into kept + summarizable portions.
      // For large windows the cap means leftover budget exists, so use >=.
      expect(triggerTokens).toBeGreaterThanOrEqual(
        config.keepRecentTokens + config.maxSummarizationInput,
      )
      expect(config.maxSummarizationInput).toBeGreaterThanOrEqual(
        config.minSummarizableTokens,
      )

      // keepRecent should never exceed context window
      expect(config.keepRecentTokens).toBeLessThan(size)

      // maxSummarizationInput should never exceed context window
      expect(config.maxSummarizationInput).toBeLessThanOrEqual(size)
    })
  }

  it('reserve is either half-context (tiny models) or fixed 16,384 (larger models)', () => {
    for (const size of [
      8_000, 16_000, 32_000, 64_000, 128_000, 200_000, 1_000_000,
    ]) {
      const config = computeConfig(size)
      const expectedReserve = size <= 16_000 ? Math.floor(size * 0.5) : 16_384
      expect(config.reserveTokens).toBe(expectedReserve)
    }
  })
})

// ---------------------------------------------------------------------------
// getCurrentTokenCount — Pi-style additive counting
// ---------------------------------------------------------------------------

describe('getCurrentTokenCount — Pi-style additive', () => {
  const config = computeConfig(200_000)

  it('returns estimated with safety margin when no steps exist', () => {
    const msgs = [userMsg('a'.repeat(400))]
    const result = getCurrentTokenCount([], msgs, config)
    const rawEstimate = estimateTokens(msgs, config.imageTokenEstimate)
    const expected =
      Math.ceil(rawEstimate * config.safetyMultiplier) + config.fixedOverhead
    expect(result).toBe(expected)
  })

  it('returns estimated when last step has no usage', () => {
    const steps: StepWithUsage[] = [{ usage: undefined }]
    const msgs = [userMsg('hello')]
    const result = getCurrentTokenCount(steps, msgs, config)
    const rawEstimate = estimateTokens(msgs, config.imageTokenEstimate)
    const expected =
      Math.ceil(rawEstimate * config.safetyMultiplier) + config.fixedOverhead
    expect(result).toBe(expected)
  })

  it('adds outputTokens to base when no trailing tool results', () => {
    const steps: StepWithUsage[] = [
      { usage: { inputTokens: 50_000, outputTokens: 2_000 } },
    ]
    const msgs = [userMsg('hello'), assistantMsg('response')]
    const result = getCurrentTokenCount(steps, msgs, config)
    expect(result).toBe(52_000)
  })

  it('adds trailing tool result tokens to base + output', () => {
    const toolOutput = 'x'.repeat(40_000) // ~10K tokens
    const steps: StepWithUsage[] = [
      { usage: { inputTokens: 100_000, outputTokens: 1_000 } },
    ]
    const msgs = [
      userMsg('hello'),
      assistantToolCall('snapshot', {}),
      toolResult('snapshot', toolOutput),
    ]

    const result = getCurrentTokenCount(steps, msgs, config)
    const expectedTrailing = estimateTokens(
      [toolResult('snapshot', toolOutput)],
      config.imageTokenEstimate,
    )
    expect(result).toBe(100_000 + 1_000 + expectedTrailing)
  })

  it('catches large DOM snapshot that would bypass threshold', () => {
    // Simulates the original bug: last step saw 150K tokens,
    // then a 100K-char tool result (~25K tokens) is added
    const largeSnapshot = 'x'.repeat(100_000)
    const steps: StepWithUsage[] = [
      { usage: { inputTokens: 150_000, outputTokens: 500 } },
    ]
    const msgs = [
      userMsg('navigate to site'),
      assistantToolCall('snapshot', {}),
      toolResult('snapshot', largeSnapshot),
    ]

    const result = getCurrentTokenCount(steps, msgs, config)
    // Must be significantly above 150K — the old code returned 150K (stale)
    expect(result).toBeGreaterThan(170_000)
  })

  it('counts multiple trailing tool results', () => {
    const steps: StepWithUsage[] = [
      { usage: { inputTokens: 80_000, outputTokens: 1_000 } },
    ]
    const msgs = [
      userMsg('do things'),
      assistantToolCall('click', { selector: '#btn' }),
      toolResult('click', 'x'.repeat(4_000)),
      toolResult('snapshot', 'y'.repeat(8_000)),
    ]

    const result = getCurrentTokenCount(steps, msgs, config)
    const trailing1 = estimateTokens(
      [toolResult('click', 'x'.repeat(4_000))],
      config.imageTokenEstimate,
    )
    const trailing2 = estimateTokens(
      [toolResult('snapshot', 'y'.repeat(8_000))],
      config.imageTokenEstimate,
    )
    expect(result).toBe(80_000 + 1_000 + trailing1 + trailing2)
  })

  it('stops counting trailing at first non-tool message', () => {
    const steps: StepWithUsage[] = [
      { usage: { inputTokens: 50_000, outputTokens: 500 } },
    ]
    // assistant message after tool results — trailing should be 0
    const msgs = [
      userMsg('hello'),
      assistantToolCall('click', {}),
      toolResult('click', 'x'.repeat(4_000)),
      assistantMsg('done'),
    ]

    const result = getCurrentTokenCount(steps, msgs, config)
    // No trailing tool results (last message is assistant)
    expect(result).toBe(50_500)
  })

  it('handles zero outputTokens gracefully', () => {
    const steps: StepWithUsage[] = [{ usage: { inputTokens: 50_000 } }]
    const msgs = [userMsg('hello')]
    const result = getCurrentTokenCount(steps, msgs, config)
    expect(result).toBe(50_000)
  })
})

// ---------------------------------------------------------------------------
// Context overflow middleware
// ---------------------------------------------------------------------------

describe('createContextOverflowMiddleware', () => {
  it('passes through when model succeeds', async () => {
    const middleware = createContextOverflowMiddleware(200_000)
    const mockResult = { text: 'hello' }
    const params = {
      prompt: [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'hi' },
      ],
    }

    const result = await middleware.wrapGenerate!({
      doGenerate: async () => mockResult,
      params,
    } as any)

    expect(result).toBe(mockResult)
  })

  it('rethrows non-context errors', async () => {
    const middleware = createContextOverflowMiddleware(200_000)
    const params = {
      prompt: [{ role: 'user', content: 'hi' }],
    }

    await expect(
      middleware.wrapGenerate!({
        doGenerate: async () => {
          throw new Error('network timeout')
        },
        params,
      } as any),
    ).rejects.toThrow('network timeout')
  })

  it('truncates and retries on context_length error', async () => {
    const middleware = createContextOverflowMiddleware(200_000)
    let callCount = 0
    const params = {
      prompt: [
        { role: 'system', content: 'system prompt' },
        { role: 'user', content: 'old message 1' },
        { role: 'assistant', content: 'old response 1' },
        { role: 'user', content: 'old message 2' },
        { role: 'assistant', content: 'old response 2' },
        { role: 'user', content: 'recent message' },
      ],
    }

    const result = await middleware.wrapGenerate!({
      doGenerate: async () => {
        callCount++
        if (callCount === 1) {
          throw new Error('context_length_exceeded')
        }
        return { text: 'success after truncation' }
      },
      params,
    } as any)

    expect(callCount).toBe(2)
    expect(result).toEqual({ text: 'success after truncation' })
    // System message should be preserved
    expect(params.prompt.some((m: any) => m.role === 'system')).toBe(true)
    // Prompt should be shorter after truncation
    expect(params.prompt.length).toBeLessThanOrEqual(6)
  })

  it('preserves system messages during truncation', async () => {
    const middleware = createContextOverflowMiddleware(10_000)
    let truncatedPrompt: any[] = []
    const params = {
      prompt: [
        { role: 'system', content: 'important system prompt' },
        { role: 'user', content: 'a'.repeat(50_000) },
        { role: 'assistant', content: 'b'.repeat(50_000) },
        { role: 'user', content: 'recent' },
      ],
    }

    await middleware.wrapGenerate!({
      doGenerate: async () => {
        if (truncatedPrompt.length === 0) {
          truncatedPrompt = [...params.prompt]
          throw new Error('maximum context length exceeded')
        }
        truncatedPrompt = [...params.prompt]
        return { text: 'ok' }
      },
      params,
    } as any)

    const systemMsgs = truncatedPrompt.filter((m: any) => m.role === 'system')
    expect(systemMsgs.length).toBe(1)
    expect(systemMsgs[0].content).toBe('important system prompt')
  })

  it('handles wrapStream the same way', async () => {
    const middleware = createContextOverflowMiddleware(200_000)
    let callCount = 0
    const params = {
      prompt: [
        { role: 'system', content: 'system' },
        { role: 'user', content: 'message' },
      ],
    }

    const result = await middleware.wrapStream!({
      doStream: async () => {
        callCount++
        if (callCount === 1) {
          throw new Error('token limit exceeded')
        }
        return { stream: 'mock-stream' }
      },
      params,
    } as any)

    expect(callCount).toBe(2)
    expect(result).toEqual({ stream: 'mock-stream' })
  })

  it('detects provider-specific context overflow errors', async () => {
    const middleware = createContextOverflowMiddleware(200_000)
    const errorMessages = [
      'context_length_exceeded', // Generic
      'prompt is too long: 213462 tokens > 200000 maximum', // Anthropic
      'Your input exceeds the context window of this model', // OpenAI
      'The input token count (1196265) exceeds the maximum number of tokens allowed', // Google
      "This model's maximum prompt length is 131072 but the request contains 537812 tokens", // xAI
      'Please reduce the length of the messages or completion', // Groq
      'maximum context length is 128000 tokens', // OpenRouter
      'token limit exceeded', // Generic
      'too many tokens', // Generic
      'exceeded model token limit', // Kimi
      'input is too long for requested model', // Amazon Bedrock
    ]

    for (const errMsg of errorMessages) {
      let callCount = 0
      const params = {
        prompt: [{ role: 'user', content: 'hi' }],
      }

      await middleware.wrapGenerate!({
        doGenerate: async () => {
          callCount++
          if (callCount === 1) throw new Error(errMsg)
          return { text: 'ok' }
        },
        params,
      } as any)

      expect(callCount).toBe(2)
    }
  })

  it('does not false-positive on unrelated errors', () => {
    const unrelatedErrors = [
      'URL is too long',
      'Invalid max_tokens: must be between 1 and 4096',
      'session token is too long',
      'file name is too long',
      'network timeout',
      'rate limit exceeded',
    ]

    for (const errMsg of unrelatedErrors) {
      expect(isContextOverflowError(new Error(errMsg))).toBe(false)
    }
  })

  it('keeps at least the last non-system message when it exceeds target', async () => {
    const middleware = createContextOverflowMiddleware(1_000)
    let truncatedPrompt: any[] = []
    const params = {
      prompt: [
        { role: 'system', content: 'system' },
        { role: 'user', content: 'x'.repeat(100_000) },
      ],
    }

    await middleware.wrapGenerate!({
      doGenerate: async () => {
        if (truncatedPrompt.length === 0) {
          truncatedPrompt = [...params.prompt]
          throw new Error('context_length_exceeded')
        }
        truncatedPrompt = [...params.prompt]
        return { text: 'ok' }
      },
      params,
    } as any)

    // Must keep system + at least the last user message (not empty)
    expect(truncatedPrompt.length).toBe(2)
    expect(truncatedPrompt[0].role).toBe('system')
    expect(truncatedPrompt[1].role).toBe('user')
  })
})

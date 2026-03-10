import { AGENT_LIMITS } from '@browseros/shared/constants/limits'
import type { LanguageModel } from 'ai'
import { stepCountIs, ToolLoopAgent, type ToolSet, tool } from 'ai'
import { z } from 'zod'
import { logger } from '../lib/logger'
import { createCompactionPrepareStep } from './compaction'

export interface DelegateTaskDeps {
  model: LanguageModel
  instructions: string
  parentTools: ToolSet
  contextWindow: number
}

const SUB_AGENT_SUFFIX =
  '\n\nIMPORTANT: When you have finished, write a clear summary of your findings ' +
  'as your final response. This summary will be returned to the main agent, ' +
  'so include all relevant information.'

/**
 * Creates the `delegate_task` tool following the AI SDK subagent pattern.
 * The sub-agent is an exact replica of the parent agent — same model, same
 * instructions, same tools, same compaction — just with a fresh context
 * window and a lower step limit.
 *
 * @see https://ai-sdk.dev/docs/agents/subagents#basic-subagent-without-streaming
 */
export function createDelegateTaskTool(deps: DelegateTaskDeps) {
  // Filter out delegate_task to prevent recursive spawning
  const { delegate_task: _, ...subAgentTools } = deps.parentTools

  // Reuse parent's full instructions + summarization suffix
  const instructions = deps.instructions + SUB_AGENT_SUFFIX

  // Sub-agent gets its own compaction for context safety
  const prepareStep = createCompactionPrepareStep({
    contextWindow: deps.contextWindow,
  })

  // Create the sub-agent once — reused across invocations
  const subAgent = new ToolLoopAgent({
    model: deps.model,
    instructions,
    tools: subAgentTools,
    stopWhen: [stepCountIs(AGENT_LIMITS.SUB_AGENT_MAX_TURNS)],
    prepareStep,
  })

  return tool({
    description:
      'Delegate a focused subtask to an independent sub-agent with its own context window. ' +
      'Use for research across many pages, data extraction, deep filesystem exploration, ' +
      'or any task that would consume significant context. ' +
      'The sub-agent has full tool access and returns a text summary when done.',
    inputSchema: z.object({
      task: z
        .string()
        .describe(
          'Clear, self-contained description of the subtask. ' +
            'Include all necessary context — URLs, file paths, search terms, expected output format.',
        ),
    }),
    execute: async ({ task }, { abortSignal }) => {
      logger.info('Spawning sub-agent', {
        taskPreview: task.slice(0, 120),
      })

      try {
        const result = await subAgent.generate({
          prompt: task,
          abortSignal,
        })

        logger.info('Sub-agent completed', {
          steps: result.steps.length,
          finishReason: result.finishReason,
        })

        return result.text || 'Sub-agent completed but produced no text output.'
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        logger.error('Sub-agent failed', { error: message })
        return `Sub-agent failed: ${message}`
      }
    },
  })
}

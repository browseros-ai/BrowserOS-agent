import { z } from 'zod'
import { Logging } from '@/lib/utils/Logging'
import { PlannerTool } from '@/lib/tools'
import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import BrowserContext from '@/lib/browser/BrowserContext'
import { MessageManager } from '@/lib/runtime/MessageManager'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { TokenCounter } from '@/lib/utils/TokenCounter'
import { invokeWithRetry } from '@/lib/utils/retryable'
import { PubSub } from '@/lib/pubsub'

// Here let's use a higher max steps
const MAX_PLANNER_STEPS = 20

// Structured plan schema (compatible with PlannerTool schema, extended with metadata)
const PlanSchema = z.object({
  steps: z.array(
    z.object({
      action: z.string(),  // What to do
      reasoning: z.string()  // Why this step
    })
  ),
  goal: z.string().optional(),  // Concise one-line goal
  name: z.string().optional()   // 2-3 word agent title
})

// Agent metadata schema (goal + short name)
const AgentMetaSchema = z.object({
  goal: z.string(),  // One-line goal for the agent
  name: z.string()   // Short 2-3 word agent title
})

export type StructuredPlan = z.infer<typeof PlanSchema>

export interface SimplePlan { goal?: string; steps: string[] }

type UpdateFn = (update: { status: 'queued' | 'started' | 'thinking' | 'done' | 'error'; content?: string; structured?: StructuredPlan; error?: string }) => void

/**
 * PlanGeneratorService
 * Stateless service that generates or refines plans using the configured LLM.
 * Does not rely on BrowserContext; uses the same prompts as PlannerTool for consistency.
 */
export class PlanGeneratorService {
  async generatePlan(input: string, opts?: { context?: string; maxSteps?: number; onUpdate?: UpdateFn }): Promise<StructuredPlan> {
    const maxSteps = opts?.maxSteps ?? MAX_PLANNER_STEPS
    const context = opts?.context ?? ''
    const onUpdate = opts?.onUpdate

    onUpdate?.({ status: 'started', content: 'Generating plan…' })

    // Build a lightweight execution context mirroring BrowserAgent's planner path
    const executionContext = this._makeLightExecutionContext(context)
    const plannerTool = PlannerTool(executionContext)

    onUpdate?.({ status: 'thinking', content: 'Calling PlannerTool…' })

    const raw = await plannerTool.func({
      task: input,
      max_steps: maxSteps
    })

    const parsed = JSON.parse(raw)
    if (!parsed.ok) {
      const msg = parsed.output || 'Planning failed'
      onUpdate?.({ status: 'error', content: 'PlannerTool error', error: msg })
      throw new Error(msg)
    }

    const plan: StructuredPlan = PlanSchema.parse(parsed.output)

    // Generate concise goal + 2-3 word agent name based on the plan
    try {
      onUpdate?.({ status: 'thinking', content: 'Summarizing goal and agent name…' })
      const meta = await this._generateGoalAndName(executionContext, input, plan)
      plan.goal = meta.goal
      plan.name = meta.name
    } catch (e) {
      // Non-fatal: proceed with steps if meta generation fails
      Logging.log('PlanGeneratorService', `Meta generation failed: ${String(e)}`, 'warning')
    }

    Logging.log('PlanGeneratorService', `Generated plan with ${plan.steps?.length || 0} steps`, 'info')
    onUpdate?.({ status: 'done', content: 'Plan ready', structured: plan })
    return plan
  }

  async refinePlan(currentPlan: SimplePlan, feedback: string, opts?: { maxSteps?: number; onUpdate?: UpdateFn }): Promise<StructuredPlan> {
    const maxSteps = opts?.maxSteps ?? MAX_PLANNER_STEPS
    const onUpdate = opts?.onUpdate

    onUpdate?.({ status: 'started', content: 'Refining plan…' })

    // Build refinement context into the ephemeral message history
    const contextParts: string[] = []
    if (currentPlan.goal) contextParts.push(`Goal: ${currentPlan.goal}`)
    if (currentPlan.steps?.length) {
      contextParts.push('Current steps:')
      currentPlan.steps.forEach((s, i) => contextParts.push(`${i + 1}. ${s}`))
    }
    if (feedback) {
      contextParts.push('Refinement notes:')
      contextParts.push(feedback)
    }
    const refinementContext = contextParts.join('\n')

    const executionContext = this._makeLightExecutionContext(refinementContext)
    const plannerTool = PlannerTool(executionContext)

    onUpdate?.({ status: 'thinking', content: 'Calling PlannerTool for refinement…' })

    const raw = await plannerTool.func({
      task: currentPlan.goal ? `Refine plan for: ${currentPlan.goal}` : 'Refine existing plan',
      max_steps: maxSteps
    })

    const parsed = JSON.parse(raw)
    if (!parsed.ok) {
      const msg = parsed.output || 'Refinement failed'
      onUpdate?.({ status: 'error', content: 'PlannerTool error', error: msg })
      throw new Error(msg)
    }

    const plan: StructuredPlan = PlanSchema.parse(parsed.output)

    // Generate/refresh concise goal + name after refinement using latest steps
    try {
      onUpdate?.({ status: 'thinking', content: 'Updating goal and agent name…' })
      const meta = await this._generateGoalAndName(executionContext, currentPlan.goal || 'Refined agent', plan)
      plan.goal = meta.goal
      plan.name = meta.name
    } catch (e) {
      Logging.log('PlanGeneratorService', `Meta generation failed (refine): ${String(e)}`, 'warning')
    }

    Logging.log('PlanGeneratorService', `Refined plan with ${plan.steps?.length || 0} steps`, 'info')
    onUpdate?.({ status: 'done', content: 'Plan refined', structured: plan })
    return plan
  }

  // Generate a concise one-line goal and a 2-3 word agent name from input + steps
  private async _generateGoalAndName(executionContext: ExecutionContext, input: string, plan: StructuredPlan): Promise<z.infer<typeof AgentMetaSchema>> {
    const llm = await executionContext.getLLM()

    const systemPrompt = [
      'You are naming and summarizing a browser automation agent.',
      '- Generate a single, concise one-line goal that reflects what the user wants accomplished.',
      "- Propose a short agent title of 2-3 words. Avoid punctuation and quotes.",
      '- Keep it specific to the task (not generic like "Web Assistant").'
    ].join('\n')

    const stepsList = plan.steps.map((s, i) => `${i + 1}. ${s.action}`).join('\n')
    const humanPrompt = [
      `User input: ${input}`,
      'Planned steps:',
      stepsList || '(no steps)',
      '',
      'Return JSON with fields: goal, name.'
    ].join('\n')

    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage(humanPrompt)
    ]

    const tokenCount = TokenCounter.countMessages(messages)
    Logging.log('PlanGeneratorService', `Generating goal/name with ${TokenCounter.format(tokenCount)}`, 'info')

    const structuredLLM = llm.withStructuredOutput(AgentMetaSchema)
    const meta = await invokeWithRetry<z.infer<typeof AgentMetaSchema>>(structuredLLM, messages, 3)
    return meta
  }

  private _makeLightExecutionContext(historyOrContext: string): ExecutionContext {
    class MinimalBrowserContext extends BrowserContext {
      public async getBrowserStateString(_simplified: boolean = false): Promise<string> {
        return 'N/A'
      }
    }

    const browserContext = new MinimalBrowserContext()
    const messageManager = new MessageManager()

    if (historyOrContext && historyOrContext.trim()) {
      messageManager.addHuman(historyOrContext)
    }

    return new ExecutionContext({
      browserContext,
      messageManager,
      debugMode: false,
      supportsVision: false,
      limitedContextMode: false,  // Plan generation doesn't use limited context mode
      maxTokens: 128000,  // Default max tokens for plan generation
      pubsub: PubSub.getChannel('default')  // Use default channel for plan generation
    })
  }
}

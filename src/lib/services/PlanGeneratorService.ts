import { z } from 'zod'
import { Logging } from '@/lib/utils/Logging'
import { createPlannerTool } from '@/lib/tools/planning/PlannerTool'
import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import BrowserContext from '@/lib/browser/BrowserContext'
import { MessageManager } from '@/lib/runtime/MessageManager'

// Here let's use a higher max steps
const MAX_PLANNER_STEPS = 20

// Structured plan schema (matches PlannerTool schema)
const PlanSchema = z.object({
  steps: z.array(
    z.object({
      action: z.string(),  // What to do
      reasoning: z.string()  // Why this step
    })
  )
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

    // Build a lightweight execution context mirroring BrowserAgent’s planner path
    const executionContext = this._makeLightExecutionContext(context)
    const plannerTool = createPlannerTool(executionContext)

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
    const plannerTool = createPlannerTool(executionContext)

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
    Logging.log('PlanGeneratorService', `Refined plan with ${plan.steps?.length || 0} steps`, 'info')
    onUpdate?.({ status: 'done', content: 'Plan refined', structured: plan })
    return plan
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
      debugMode: false
    })
  }
}
